// Web Worker for Film Grain Processing
// Implements physically plausible analog film grain algorithm

import { GrainGenerator } from './grain-generator';
import { PerformanceTracker } from './performance-tracker';
import { KernelGenerator, sampleGrainAreaExposure } from './grain-sampling';
import { GrainDensityCalculator } from './grain-density';
import { 
  convertSrgbToLinearFloat, 
  convertLinearFloatToSrgb,
  applyLightnessScaling,
  calculateLightnessFactor,
  applyBeerLambertCompositingGrayscale
} from './grain-math';
import { convertImageDataToGrayscale } from './color-space';
import { DEFAULT_ITERATION_PARAMETERS } from './constants';
import type {
  GrainSettings,
  GrainPoint,
  ProcessMessage,
  ProgressMessage,
  ResultMessage,
  ErrorMessage,
  RandomNumberGenerator
} from './types';
import { 
  assertPositiveInteger, 
  assertObject, 
  assertImageData, 
  assert
} from './utils';

// Helper function to handle postMessage in both browser and Node.js environments
function safePostMessage(message: ProgressMessage | ResultMessage | ErrorMessage): void {
  if (typeof postMessage !== 'undefined' && typeof postMessage === 'function') {
    try {
      postMessage(message);
    } catch {
      // Silently ignore postMessage errors in test environment
      console.debug('PostMessage skipped in test environment:', message);
    }
  }
}

// Utility functions for grain generation
// All operations should be done on linear colors. The incoming image is immedeately converted from srgb to linear. Only convert back to srgb when writing the output image.
export class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private grainGenerator: GrainGenerator;
  private performanceTracker: PerformanceTracker;
  private kernelGenerator: KernelGenerator;
  private grainDensityCalculator: GrainDensityCalculator;

  constructor(width: number, height: number, settings: GrainSettings, rng?: RandomNumberGenerator) {
    // Validate input parameters with custom assertions that provide type narrowing
    assertPositiveInteger(width, 'width');
    assertPositiveInteger(height, 'height');
    assertObject(settings, 'settings');

    // Type guard for settings object using custom assertion
    assert(
      this.isValidGrainSettings(settings),
      'Invalid grain settings provided',
      { settings, requiredProperties: ['iso', 'filmType'] }
    );

    console.log(`Initializing GrainProcessor: ${width}x${height}, ISO: ${settings.iso}`);

    this.width = width;
    this.height = height;
    this.settings = settings;
    this.grainGenerator = new GrainGenerator(width, height, settings, rng);
    this.performanceTracker = new PerformanceTracker();
    this.kernelGenerator = new KernelGenerator(rng);
    this.grainDensityCalculator = new GrainDensityCalculator(settings);
  }

  // Type guard for GrainSettings
  private isValidGrainSettings(settings: unknown): settings is GrainSettings {
    const basicValidation = typeof settings === 'object' &&
           settings !== null &&
           'iso' in settings &&
           typeof (settings as GrainSettings).iso === 'number' && (settings as GrainSettings).iso > 0 &&
           'filmType' in settings &&
           typeof (settings as GrainSettings).filmType === 'string' &&
           ['kodak', 'fuji', 'ilford'].includes((settings as GrainSettings).filmType);

    if (!basicValidation) return false;

    const s = settings as GrainSettings;
    
    // Validate optional iteration parameters if provided
    if (s.maxIterations !== undefined) {
      if (typeof s.maxIterations !== 'number' || s.maxIterations < 1 || s.maxIterations > 20) {
        return false;
      }
    }
    
    if (s.convergenceThreshold !== undefined) {
      if (typeof s.convergenceThreshold !== 'number' || s.convergenceThreshold <= 0 || s.convergenceThreshold > 1) {
        return false;
      }
    }
    
    return true;
  }

  // Kernel-based grain area sampling methods
  
  /**
   * Calculates average exposure for all grains using kernel-based sampling
   * LIGHT EXPOSURE PHASE - Sample how much light each grain received
   * 
   * This simulates how photons from the input image strike each grain in the film emulsion.
   * The input image represents the light pattern that would have exposed the film.
   * Each grain samples light from its local area using kernel-based area sampling.
   * 
   * See ALGORITHM_DESIGN.md: "Camera Exposure Phase"
   */
  private calculateGrainExposures(grains: GrainPoint[], imageData: Float32Array): Map<GrainPoint, number> {
    console.log(`Calculating kernel-based exposures for ${grains.length} grains...`);
    
    const exposureMap = new Map<GrainPoint, number>();
    
    for (const grain of grains) {
      const averageExposure = sampleGrainAreaExposure(
        imageData, 
        grain.x, 
        grain.y, 
        grain.size, 
        this.width,
        this.height,
        this.kernelGenerator
      );
      exposureMap.set(grain, averageExposure);
    }
    
    console.log(`Completed kernel-based exposure calculation for ${exposureMap.size} grains`);
    return exposureMap;
  }

  /**
   * Generate grain structure (film emulsion simulation)
   * PREPARATION PHASE - Create the film's grain structure
   * 
   * This simulates the physical distribution of photosensitive crystals (grains) in film emulsion.
   * Each grain has individual properties: position, size, sensitivity, development threshold.
   * This represents the film before any light exposure.
   */
  private generateGrainStructure(): GrainPoint[] {
    return this.grainGenerator.generateGrainStructure();
  }

  /**
   * Create spatial grid for grain acceleration
   * OPTIMIZATION - Spatial indexing for efficient grain lookup during printing phase
   */
  private createGrainGrid(grains: GrainPoint[]): Map<string, GrainPoint[]> {
    return this.grainGenerator.createGrainGrid(grains);
  }

  // Apply grain to image
  public async processImage(imageData: ImageData): Promise<ImageData> {
    // Assert that the incoming image dimensions match the processor dimensions
    assert(
      imageData.width === this.width && imageData.height === this.height,
      'Image dimensions must match processor dimensions',
      {
        expectedWidth: this.width,
        expectedHeight: this.height,
        actualWidth: imageData.width,
        actualHeight: imageData.height
      }
    );

    // ========================================================================
    // LIGHT EXPOSURE PHASE - Camera Exposure Phase
    // The input image represents the light that struck the film emulsion.
    // See ALGORITHM_DESIGN.md: "Camera Exposure Phase"
    // ========================================================================

    // Convert input to grayscale at the start for monochrome processing
    const grayscaleImageData = convertImageDataToGrayscale(imageData);

    // Convert input to linear floating-point for precision preservation and gamma correctness
    const floatData = convertSrgbToLinearFloat(grayscaleImageData.data);
    
    // Create floating-point result buffer
    const resultFloatData = new Float32Array(floatData.length);
    // Copy original data as starting point
    resultFloatData.set(floatData);
    
    const totalImagePixels = this.width * this.height;
    
    // Start overall benchmark
    this.performanceTracker.startBenchmark('Total Processing', totalImagePixels);
    
    // Step 1: Generate grain structure (simulates film emulsion grain distribution)
    this.reportProgress(10, 'Generating grain structure...');
    this.performanceTracker.startBenchmark('Grain Generation');
    const grainStructure = this.generateGrainStructure();
    this.performanceTracker.endBenchmark('Grain Generation');
    
    // Step 2: Create spatial acceleration grid for efficient grain lookup
    this.reportProgress(20, 'Creating spatial grid...');
    this.performanceTracker.startBenchmark('Spatial Grid Creation');
    const grainGrid = this.createGrainGrid(grainStructure);
    this.performanceTracker.endBenchmark('Spatial Grid Creation');
    
    // Step 3: Calculate grain exposures using kernel-based sampling
    // This samples how much light each grain received from the input image
    this.reportProgress(25, 'Calculating kernel-based grain exposures...');
    this.performanceTracker.startBenchmark('Kernel Exposure Calculation');
    const grainExposureMap = this.calculateGrainExposures(grainStructure, floatData);
    this.performanceTracker.endBenchmark('Kernel Exposure Calculation');

    // ========================================================================
    // ITERATIVE FILM DEVELOPMENT PHASE - Development Phase with Lightness Convergence
    // Iteratively adjust grain exposures until desired lightness is achieved.
    // This is more physically plausible than applying lightness correction at the end.
    // See ALGORITHM_DESIGN.md: "Film Development Phase"
    // ========================================================================
    
    // Determine grid size for spatial lookup (needed for lightness estimation)
    let maxGrainSize = 1;
    if (Array.isArray(grainStructure) && grainStructure.length > 0) {
      // Single layer with varying grain sizes
      const grains = grainStructure as GrainPoint[];
      maxGrainSize = Math.max(...grains.map(g => g.size));
    }
    // Constants for grid size calculation
    const MIN_GRID_SIZE = 8;
    const GRID_SIZE_FACTOR = 2;
    const gridSize = Math.max(MIN_GRID_SIZE, Math.floor(maxGrainSize * GRID_SIZE_FACTOR));
    
    // Constants for iterative lightness compensation
    const MAX_ITERATIONS = this.settings.maxIterations ?? DEFAULT_ITERATION_PARAMETERS.MAX_ITERATIONS;
    const CONVERGENCE_THRESHOLD = this.settings.convergenceThreshold ?? DEFAULT_ITERATION_PARAMETERS.CONVERGENCE_THRESHOLD;
    const TARGET_LIGHTNESS = DEFAULT_ITERATION_PARAMETERS.TARGET_LIGHTNESS;
    
    this.reportProgress(27, 'Starting iterative film development...');
    this.performanceTracker.startBenchmark('Iterative Development');
    
    // Initialize exposure adjustment factor
    let exposureAdjustmentFactor = 1.0;
    let convergedGrainIntrinsicDensityMap: Map<GrainPoint, number> | null = null;
    
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`Development iteration ${iteration + 1}/${MAX_ITERATIONS}, exposure adjustment: ${exposureAdjustmentFactor.toFixed(4)}`);
      
      // Apply exposure adjustment to grain exposure map
      const adjustedGrainExposureMap = this.adjustGrainExposures(grainExposureMap, exposureAdjustmentFactor);
      
      // Execute film development phase with adjusted exposures
      this.performanceTracker.startBenchmark('Intrinsic Density Calculation');
      const grainIntrinsicDensityMap = this.grainDensityCalculator.calculateIntrinsicGrainDensities(grainStructure, adjustedGrainExposureMap);
      this.performanceTracker.endBenchmark('Intrinsic Density Calculation');
      
      // Calculate full lightness factor using complete pixel processing (no sampling estimation)
      // This ensures consistency with the main pipeline and avoids code duplication
      const { resultFloatData: iterationProcessedFloatData } = this.processPixelEffects(
        grainStructure,
        grainGrid,
        grainIntrinsicDensityMap,
        this.width,
        this.height,
        gridSize
      );
      
      const estimatedLightnessFactor = calculateLightnessFactor(floatData, iterationProcessedFloatData);
      
      console.log(`Iteration ${iteration + 1}: estimated lightness factor = ${estimatedLightnessFactor.toFixed(4)}`);
      
      // Check convergence
      if (Math.abs(estimatedLightnessFactor - TARGET_LIGHTNESS) < CONVERGENCE_THRESHOLD) {
        console.log(`Lightness converged after ${iteration + 1} iterations`);
        convergedGrainIntrinsicDensityMap = grainIntrinsicDensityMap;
        break;
      }
      
      // Adjust exposure for next iteration
      // If lightness factor > 1, image is too dark → increase exposure
      // If lightness factor < 1, image is too bright → decrease exposure
      exposureAdjustmentFactor *= estimatedLightnessFactor;
      
      // Store the density map from this iteration
      convergedGrainIntrinsicDensityMap = grainIntrinsicDensityMap;
      
      // Prevent extreme adjustments
      exposureAdjustmentFactor = Math.max(0.1, Math.min(10.0, exposureAdjustmentFactor));
    }
    
    // Use the final converged grain densities
    const finalGrainIntrinsicDensityMap = convergedGrainIntrinsicDensityMap!;
    
    this.performanceTracker.endBenchmark('Iterative Development');
    console.log(`Film development completed with exposure adjustment factor: ${exposureAdjustmentFactor.toFixed(4)}`);

    // ========================================================================
    // DARKROOM PRINTING PHASE - Printing Phase
    // Apply the developed film negative to create the final photograph.
    // Light passes through developed grains (Phase 2 - position-dependent effects).
    // See ALGORITHM_DESIGN.md: "Darkroom Printing Phase"
    // ========================================================================
    
    // Step 4: Process each pixel (Phase 2 - position-dependent grain effects)
    // This simulates light passing through the developed film to create the final image
    this.reportProgress(30, 'Processing pixels...');
    this.performanceTracker.startBenchmark('Pixel Processing', this.width * this.height);
    
    // Process pixel effects through extracted pure function
    const { resultFloatData: processedFloatData, grainEffectCount, processedPixels } = this.processPixelEffects(
      grainStructure,
      grainGrid,
      finalGrainIntrinsicDensityMap,
      this.width,
      this.height,
      gridSize
    );
    
    // End pixel processing benchmark
    this.performanceTracker.endBenchmark('Pixel Processing');

    // ========================================================================
    // FINAL OUTPUT PROCESSING
    // Convert from linear space back to sRGB and preserve image lightness.
    // All color operations are done in linear space as specified in ALGORITHM_DESIGN.md.
    // ========================================================================

    // Calculate lightness correction factor to preserve overall image lightness
    // Now operates on linear RGB values for physically correct lightness calculation
    const lightnessFactor = calculateLightnessFactor(floatData, processedFloatData);
    console.log(`Lightness correction factor: ${lightnessFactor.toFixed(4)}`);
    
    // Apply lightness scaling in linear space
    const lightnessAdjustedData = applyLightnessScaling(processedFloatData, lightnessFactor);
    
    // Convert back to Uint8ClampedArray with gamma encoding (sRGB packing at pipeline boundary)
    const finalData = convertLinearFloatToSrgb(lightnessAdjustedData);

    
    
    // Create ImageData result - handle both browser and Node.js environments
    const result = typeof ImageData !== 'undefined' 
      ? new ImageData(finalData, this.width, this.height)
      : { width: this.width, height: this.height, data: finalData } as ImageData;
    
    // End overall benchmark
    this.performanceTracker.endBenchmark('Total Processing');
    
    console.log(`=== Processing Summary ===`);
    console.log(`Total pixels processed: ${processedPixels}`);
    console.log(`Pixels with grain effect: ${grainEffectCount}`);
    console.log(`Grain effect coverage: ${(grainEffectCount / processedPixels * 100).toFixed(2)}%`);
    console.log(`Processing mode: Single Layer (Variable Sizes), Density Model`);
    
    // Log performance benchmarks
    this.performanceTracker.logSummary();
    
    // Calculate and log performance metrics for multiple layers optimization
    const totalBenchmark = this.performanceTracker.getBenchmark('Total Processing');
    const pixelBenchmark = this.performanceTracker.getBenchmark('Pixel Processing');
    const layerBenchmark = this.performanceTracker.getBenchmark('Single Layer Processing');
    
    if (totalBenchmark && pixelBenchmark) {
      console.log(`\n=== Performance Metrics ===`);
      console.log(`Total processing speed: ${(totalBenchmark.pixelsPerSecond! / 1000000).toFixed(2)}M pixels/sec`);
      console.log(`Pixel processing speed: ${(pixelBenchmark.pixelsPerSecond! / 1000000).toFixed(2)}M pixels/sec`);
      console.log(`Processing overhead: ${((totalBenchmark.duration! - pixelBenchmark.duration!) / totalBenchmark.duration! * 100).toFixed(1)}%`);
      
      if (layerBenchmark) {
        console.log(`Layer processing mode: Single Layer (Variable Sizes)`);
        console.log(`Layer processing time: ${layerBenchmark.duration!.toFixed(2)}ms`);
        console.log(`Layer processing efficiency: ${(pixelBenchmark.duration! / layerBenchmark.duration!).toFixed(2)}x pixel processing speed`);
      }
    }
    
    // Debug: Draw grain center points if requested
    if (this.settings.debugGrainCenters) {
      this.reportProgress(95, 'Drawing debug grain centers...');
      console.log('Debug mode: Drawing grain center points');
      this.drawGrainCenters(result, grainStructure);
    }
    
    this.reportProgress(100, 'Complete!');
    return result;
  }

  // Calculate grain density for density-based compositing
  private calculateGrainDensity(grainStrength: number, grain: GrainPoint): number {
    // Convert grain strength to optical density
    const baseDensity = grainStrength * grain.sensitivity;
    
    // Normalize density to [0, 1] range for film curve
    // Maximum reasonable density is around 3.0 (very dense grain)
    const normalizedDensity = Math.min(baseDensity / 3.0, 1.0);
    
    // Apply film characteristic curve for density response
    const densityResponse = this.grainDensityCalculator.filmCurve(normalizedDensity);
    
    // Return the density response directly from film curve
    return densityResponse;
  }

  /**
   * Adjust grain exposures by a factor for iterative lightness compensation
   * Uses logarithmic scaling to stay within reasonable bounds while preserving relative differences
   * 
   * @param originalExposureMap - Original grain exposure map
   * @param adjustmentFactor - Factor to adjust exposures by
   * @returns New adjusted exposure map with values clamped to [0, 1]
   */
  private adjustGrainExposures(
    originalExposureMap: Map<GrainPoint, number>, 
    adjustmentFactor: number
  ): Map<GrainPoint, number> {
    const adjustedMap = new Map<GrainPoint, number>();
    
    // Use smaller, more conservative adjustment steps to avoid exceeding bounds
    // Convert factor to logarithmic adjustment for more stable iteration
    const logAdjustment = Math.log(adjustmentFactor);
    const clampedLogAdjustment = Math.max(-2.0, Math.min(2.0, logAdjustment)); // Limit to reasonable range
    const safeAdjustmentFactor = Math.exp(clampedLogAdjustment * 0.3); // Apply with dampening
    
    for (const [grain, exposure] of originalExposureMap.entries()) {
      const adjustedExposure = exposure * safeAdjustmentFactor;
      // Strictly clamp to [0, 1] range as required by grain density calculator
      const clampedExposure = Math.max(0.0, Math.min(1.0, adjustedExposure));
      adjustedMap.set(grain, clampedExposure);
    }
    
    return adjustedMap;
  }

  /**
   * Helper to report progress with standardized messaging
   */
  private reportProgress(progress: number, stage: string): void {
    safePostMessage({ 
      type: 'progress', 
      progress, 
      stage 
    } as ProgressMessage);
  }

  /**
   * Process pixel effects with grain compositing
   * DARKROOM PRINTING PHASE (Phase 2 - Position-dependent effects)
   * 
   * This simulates light passing through the developed film negative to create the final photograph.
   * Dense grains (heavily exposed) block more light, creating lighter areas in the final print.
   * Transparent grains (unexposed) allow more light through, creating darker areas in the final print.
   * 
   * See ALGORITHM_DESIGN.md: "Darkroom Printing Phase"
   */
  private processPixelEffects(
    grainStructure: GrainPoint[],
    grainGrid: Map<string, GrainPoint[]>,
    grainIntrinsicDensityMap: Map<GrainPoint, number>, // Grain densities from development phase
    outputWidth: number,
    outputHeight: number,
    gridSize: number
  ): { resultFloatData: Float32Array; grainEffectCount: number; processedPixels: number } {
    // Create new result array starting with uniform white light (darkroom enlarger light)
    // This simulates the light that will pass through the developed film negative
    const resultFloatData = new Float32Array(outputWidth * outputHeight * 4);
    // Initialize all pixels to maximum brightness (white light from enlarger)
    for (let i = 0; i < resultFloatData.length; i += 4) {
      resultFloatData[i] = 1.0;     // Red channel
      resultFloatData[i + 1] = 1.0; // Green channel  
      resultFloatData[i + 2] = 1.0; // Blue channel
      resultFloatData[i + 3] = 1.0; // Alpha channel
    }
    
    let grainEffectCount = 0;
    let processedPixels = 0;
    
    for (let y = 0; y < outputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        const pixelIndex = (y * outputWidth + x) * 4;
        processedPixels++;
        
        // Initialize grain density for monochrome processing
        let totalGrainDensity = 0;
        let totalWeight = 0;
        
        // Get grains from nearby grid cells
        const pixelGridX = Math.floor(x / gridSize);
        const pixelGridY = Math.floor(y / gridSize);
        const nearbyGrains: GrainPoint[] = [];
        
        // Check surrounding grid cells (3x3 neighborhood)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const gridKey = `${pixelGridX + dx},${pixelGridY + dy}`;
            const cellGrains = grainGrid.get(gridKey);
            if (cellGrains) {
              nearbyGrains.push(...cellGrains);
            }
          }
        }
        
        // Process nearby grains directly (already filtered by spatial grid)
        for (const grain of nearbyGrains) {
          const distance = Math.sqrt((x - grain.x) ** 2 + (y - grain.y) ** 2);

          // Constant for grain influence radius
          const GRAIN_INFLUENCE_RADIUS_FACTOR = 2;
          if (distance < grain.size * GRAIN_INFLUENCE_RADIUS_FACTOR) {
            const weight = Math.exp(-distance / grain.size);
            
            // Use pre-calculated intrinsic grain density
            const intrinsicDensity = grainIntrinsicDensityMap.get(grain);
            assert(
              intrinsicDensity !== undefined,
              'Intrinsic grain density not found in calculated map - this indicates a logic error',
              { 
                grain: { x: grain.x, y: grain.y, size: grain.size },
                mapSize: grainIntrinsicDensityMap.size,
                grainStructureLength: grainStructure.length
              }
            );
            
            // Calculate pixel-level grain effects using pre-calculated intrinsic density
            const pixelGrainEffect = this.grainDensityCalculator.calculatePixelGrainEffect(intrinsicDensity, grain, x, y);
            const grainDensity = this.calculateGrainDensity(pixelGrainEffect, grain);
            
            // For monochrome processing, use simple grayscale density accumulation
            // Skip color-specific effects (channel sensitivity, color shifts, chromatic aberration)
            totalGrainDensity += grainDensity * weight;
            
            totalWeight += weight;
          }
        }
        
        // Apply grain effects using proper darkroom printing physics
        // Start with uniform white enlarger light, apply grain density to simulate light passing through developed film
        let finalGrayscale = 1.0; // Start with maximum brightness (white enlarger light)
        
        if (totalWeight > 0) {
          grainEffectCount++;
          
          // Normalize by total weight for grayscale processing
          const normalizedDensity = totalGrainDensity / totalWeight;
          
          // Use Beer-Lambert law to calculate light transmission through developed grains
          // Dense grains (heavily exposed) block more light
          const lightTransmission = applyBeerLambertCompositingGrayscale(normalizedDensity);
          
          // In darkroom printing: less light transmission = lighter final print
          // This simulates how photographic paper works (less exposure = lighter result)
          finalGrayscale = 1.0 - lightTransmission;
        } else {
          // If no grains affect this pixel, full enlarger light passes through → darkest areas
          finalGrayscale = 0.0; // Maximum exposure on paper = darkest result
        }
        
        // Set the final pixel value (duplicate grayscale to RGB channels)
        resultFloatData[pixelIndex] = finalGrayscale;
        resultFloatData[pixelIndex + 1] = finalGrayscale;
        resultFloatData[pixelIndex + 2] = finalGrayscale;
      }
    }
    
    return { resultFloatData, grainEffectCount, processedPixels };
  }

  /**
   * Debug function to draw grain center points on the image
   * Only available in development mode for debugging grain placement
   */
  private drawGrainCenters(imageData: ImageData, grainStructure: GrainPoint[]): void {
    console.log(`Drawing grain centers for ${grainStructure.length} grains`);
    
    for (const grain of grainStructure) {
      const centerX = Math.round(grain.x);
      const centerY = Math.round(grain.y);
      
      // Draw a small cross at the grain center
      // Use bright magenta color that's unlikely to be in the original image
      const crossSize = Math.max(1, Math.floor(grain.size * 0.3)); // Scale cross size with grain size
      const color = { r: 255, g: 0, b: 255 }; // Bright magenta
      
      // Draw horizontal line
      for (let dx = -crossSize; dx <= crossSize; dx++) {
        const x = centerX + dx;
        if (x >= 0 && x < this.width && centerY >= 0 && centerY < this.height) {
          const pixelIndex = (centerY * this.width + x) * 4;
          imageData.data[pixelIndex] = color.r;
          imageData.data[pixelIndex + 1] = color.g;
          imageData.data[pixelIndex + 2] = color.b;
          // Keep alpha unchanged
        }
      }
      
      // Draw vertical line
      for (let dy = -crossSize; dy <= crossSize; dy++) {
        const y = centerY + dy;
        if (centerX >= 0 && centerX < this.width && y >= 0 && y < this.height) {
          const pixelIndex = (y * this.width + centerX) * 4;
          imageData.data[pixelIndex] = color.r;
          imageData.data[pixelIndex + 1] = color.g;
          imageData.data[pixelIndex + 2] = color.b;
          // Keep alpha unchanged
        }
      }
    }
    
    console.log(`Debug: Drew ${grainStructure.length} grain center markers`);
  }
}

// TODO: this should probably be the only thing in this file, all the non-worker-specific code should move to a separate file.
// Worker message handler
self.onmessage = async function(e: MessageEvent<ProcessMessage>) {
  try {
    // Validate message structure with custom assertion
    assertObject(e.data, 'worker message data');

    const { type, imageData, settings } = e.data;
    
    // Validate message type
    assert(
      type === 'process',
      'Worker received unknown message type',
      { type, expectedType: 'process' }
    );

    // Validate imageData and settings with custom assertions
    assertImageData(imageData, 'worker imageData');
    assertObject(settings, 'worker settings');

    console.log(`Worker processing image: ${imageData.width}x${imageData.height}, ISO: ${settings.iso}`);

    const processor = new GrainProcessor(imageData.width, imageData.height, settings);
    const result = await processor.processImage(imageData);
    
    // Validate result with custom assertion
    assertImageData(result, 'processing result');

    safePostMessage({ type: 'result', imageData: result } as ResultMessage);
  } catch (error) {
    console.error('Worker processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during processing';
    
    // Log additional error context for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    safePostMessage({ type: 'error', error: errorMessage });
  }
};

export {};
