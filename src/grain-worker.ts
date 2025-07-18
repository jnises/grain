// Web Worker for Film Grain Processing
// Implements physically plausible analog film grain algorithm

import { GrainGenerator } from './grain-generator';
import { FILM_CHARACTERISTICS } from './constants';
import { PerformanceTracker } from './performance-tracker';
import { KernelGenerator, sampleGrainAreaExposure } from './grain-sampling';
import { GrainDensityCalculator } from './grain-density';
import { 
  convertSrgbToLinearFloat, 
  convertLinearFloatToSrgb,
  applyLightnessScaling,
  calculateLightnessFactor,
  applyBeerLambertCompositingFloat,
  calculateChromaticAberration
} from './grain-math';
import type {
  GrainSettings,
  GrainPoint,
  GrainDensity,
  ProcessMessage,
  ProgressMessage,
  ResultMessage,
  ErrorMessage
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
export class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private grainGenerator: GrainGenerator;
  private performanceTracker: PerformanceTracker;
  private kernelGenerator: KernelGenerator;
  private grainDensityCalculator: GrainDensityCalculator;

  constructor(width: number, height: number, settings: GrainSettings) {
    // Validate input parameters with custom assertions that provide type narrowing
    assertPositiveInteger(width, 'width');
    assertPositiveInteger(height, 'height');
    assertObject(settings, 'settings');

    // Type guard for settings object using custom assertion
    assert(
      this.isValidGrainSettings(settings),
      'Invalid grain settings provided',
      { settings, requiredProperties: ['iso', 'filmType', 'grainIntensity', 'upscaleFactor'] }
    );

    console.log(`Initializing GrainProcessor: ${width}x${height}, ISO: ${settings.iso}`);

    this.width = width;
    this.height = height;
    this.settings = settings;
    this.grainGenerator = new GrainGenerator(width, height, settings);
    this.performanceTracker = new PerformanceTracker();
    this.kernelGenerator = new KernelGenerator();
    this.grainDensityCalculator = new GrainDensityCalculator(settings);
  }

  // Type guard for GrainSettings
  private isValidGrainSettings(settings: unknown): settings is GrainSettings {
    return typeof settings === 'object' &&
           settings !== null &&
           'iso' in settings &&
           typeof (settings as GrainSettings).iso === 'number' && (settings as GrainSettings).iso > 0 &&
           'filmType' in settings &&
           typeof (settings as GrainSettings).filmType === 'string' &&
           ['kodak', 'fuji', 'ilford'].includes((settings as GrainSettings).filmType) &&
           'grainIntensity' in settings &&
           typeof (settings as GrainSettings).grainIntensity === 'number' && (settings as GrainSettings).grainIntensity >= 0 &&
           'upscaleFactor' in settings &&
           typeof (settings as GrainSettings).upscaleFactor === 'number' && (settings as GrainSettings).upscaleFactor > 0;
  }

  // Kernel-based grain area sampling methods
  
  /**
   * Calculates average exposure for all grains using kernel-based sampling
   * This replaces point sampling with area-based exposure calculation
   * Returns a Map for better functional design and testability
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
        grain.shape,
        this.width,
        this.height,
        this.kernelGenerator
      );
      exposureMap.set(grain, averageExposure);
    }
    
    console.log(`Completed kernel-based exposure calculation for ${exposureMap.size} grains`);
    return exposureMap;
  }

  // Generate grain structure (single layer with varying sizes)
  private generateGrainStructure(): GrainPoint[] {
    return this.grainGenerator.generateGrainStructure();
  }

  // Create spatial grid for grain acceleration (single layer)
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

    // Convert input to linear floating-point for precision preservation and gamma correctness
    const floatData = convertSrgbToLinearFloat(imageData.data);
    
    // Create floating-point result buffer
    const resultFloatData = new Float32Array(floatData.length);
    // Copy original data as starting point
    resultFloatData.set(floatData);
    
    const totalImagePixels = this.width * this.height;
    
    // Start overall benchmark
    this.performanceTracker.startBenchmark('Total Processing', totalImagePixels);
    
    // Step 1: Generate grain structure
    this.reportProgress(10, 'Generating grain structure...');
    this.performanceTracker.startBenchmark('Grain Generation');
    const grainStructure = this.generateGrainStructure();
    this.performanceTracker.endBenchmark('Grain Generation');
    
    // Step 2: Create spatial acceleration grid
    this.reportProgress(20, 'Creating spatial grid...');
    this.performanceTracker.startBenchmark('Spatial Grid Creation');
    const grainGrid = this.createGrainGrid(grainStructure);
    this.performanceTracker.endBenchmark('Spatial Grid Creation');
    
    // Step 3: Calculate grain exposures using kernel-based sampling
    this.reportProgress(25, 'Calculating kernel-based grain exposures...');
    this.performanceTracker.startBenchmark('Kernel Exposure Calculation');
    const grainExposureMap = this.calculateGrainExposures(grainStructure, floatData);
    this.performanceTracker.endBenchmark('Kernel Exposure Calculation');
    
    // Step 3.5: Pre-calculate intrinsic grain densities (Phase 1)
    this.reportProgress(27, 'Pre-calculating intrinsic grain densities...');
    this.performanceTracker.startBenchmark('Intrinsic Density Calculation');
    const grainIntrinsicDensityMap = this.grainDensityCalculator.calculateIntrinsicGrainDensities(grainStructure, grainExposureMap);
    this.performanceTracker.endBenchmark('Intrinsic Density Calculation');
    
    // Determine grid size for spatial lookup
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
    
    // Step 4: Process each pixel
    this.reportProgress(30, 'Processing pixels...');
    this.performanceTracker.startBenchmark('Pixel Processing', this.width * this.height);
    
    // Process pixel effects through extracted pure function
    const { grainEffectCount, processedPixels } = this.processPixelEffects(
      grainStructure,
      grainGrid,
      grainIntrinsicDensityMap,
      resultFloatData,
      gridSize
    );
    
    // End pixel processing benchmark
    this.performanceTracker.endBenchmark('Pixel Processing');

    // Invert the image to go from a "negative" to a "positive"
    for (let i = 0; i < resultFloatData.length; i+=4) {
        resultFloatData[i] = 1.0 - resultFloatData[i];
        resultFloatData[i+1] = 1.0 - resultFloatData[i+1];
        resultFloatData[i+2] = 1.0 - resultFloatData[i+2];
    }

    // Invert the image to go from a "negative" to a "positive"
    for (let i = 0; i < resultFloatData.length; i+=4) {
        resultFloatData[i] = 1.0 - resultFloatData[i];
        resultFloatData[i+1] = 1.0 - resultFloatData[i+1];
        resultFloatData[i+2] = 1.0 - resultFloatData[i+2];
    }

    // Calculate lightness correction factor to preserve overall image lightness
    // Now operates on linear RGB values for physically correct lightness calculation
    const lightnessFactor = calculateLightnessFactor(floatData, resultFloatData);
    console.log(`Lightness correction factor: ${lightnessFactor.toFixed(4)}`);
    
    // Apply lightness scaling in linear space
    const lightnessAdjustedData = applyLightnessScaling(resultFloatData, lightnessFactor);
    
    // Convert back to Uint8ClampedArray with gamma encoding
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
    
    // Scale by grain intensity setting and restore density range
    return densityResponse * this.settings.grainIntensity * 0.8; // Increased multiplier for density model
  }

  /**
   * Calculate temperature-dependent color shift based on grain properties
   * Simulates color temperature variations within individual grains
   */
  private calculateTemperatureShift(grain: GrainPoint, normalizedDistance: number): { red: number; green: number; blue: number } {
    // Use grain's shape and sensitivity properties to create per-grain color variation
    // Constants for temperature shift
    const VARIATION_FACTOR = 0.01;
    const RED_TEMP_SHIFT = 0.02;
    const GREEN_TEMP_SHIFT = 0.005;
    const BLUE_TEMP_SHIFT = 0.015;

    const grainVariation = grain.shape * grain.sensitivity * VARIATION_FACTOR; // Small variation factor

    // Simulate warmer center, cooler edges (typical of film grain)
    const distanceFactor = 1 - normalizedDistance;
    const temperatureIntensity = grainVariation * distanceFactor;

    return {
      red: temperatureIntensity * RED_TEMP_SHIFT,    // Warmer tones toward grain center
      green: temperatureIntensity * GREEN_TEMP_SHIFT, // Slight green adjustment
      blue: -temperatureIntensity * BLUE_TEMP_SHIFT  // Cooler at edges
    };
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
   * Pure function that applies grain effects to image data
   */
  private processPixelEffects(
    grainStructure: GrainPoint[],
    grainGrid: Map<string, GrainPoint[]>,
    grainIntrinsicDensityMap: Map<GrainPoint, number>,
    resultFloatData: Float32Array,
    gridSize: number
  ): { grainEffectCount: number; processedPixels: number } {
    let grainEffectCount = 0;
    let processedPixels = 0;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIndex = (y * this.width + x) * 4;
        processedPixels++;
        
        // Initialize grain density
        let totalGrainDensity: GrainDensity = { r: 0, g: 0, b: 0 };
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
            
            // Apply film-specific channel characteristics with enhanced color effects
            const filmCharacteristics = FILM_CHARACTERISTICS[this.settings.filmType];
            const channelSensitivity = filmCharacteristics.channelSensitivity;
            const baseColorShift = filmCharacteristics.colorShift;
            
            // Calculate position-dependent color temperature shift
            const normalizedDistance = distance / grain.size;
            const temperatureShift = this.calculateTemperatureShift(grain, normalizedDistance);
            
            // Calculate chromatic aberration based on distance from grain center
            const chromaticAberration = calculateChromaticAberration(normalizedDistance);
            
            // Apply enhanced color response with temperature and chromatic effects
            const redSensitivity = channelSensitivity.red * (1 + baseColorShift.red + temperatureShift.red);
            const greenSensitivity = channelSensitivity.green * (1 + baseColorShift.green + temperatureShift.green);
            const blueSensitivity = channelSensitivity.blue * (1 + baseColorShift.blue + temperatureShift.blue);
            
            totalGrainDensity.r += grainDensity * weight * redSensitivity * chromaticAberration.red;
            totalGrainDensity.g += grainDensity * weight * greenSensitivity * chromaticAberration.green;
            totalGrainDensity.b += grainDensity * weight * blueSensitivity * chromaticAberration.blue;
            
            totalWeight += weight;
          }
        }
        
        // Apply final compositing
        if (totalWeight > 0) {
          grainEffectCount++;
          
          // Normalize by total weight
          totalGrainDensity.r /= totalWeight;
          totalGrainDensity.g /= totalWeight;
          totalGrainDensity.b /= totalWeight;
          
          // Use Beer-Lambert law compositing for physically accurate results (floating-point)
          const finalColor = applyBeerLambertCompositingFloat(totalGrainDensity);
          
          resultFloatData[pixelIndex] = finalColor[0];
          resultFloatData[pixelIndex + 1] = finalColor[1];
          resultFloatData[pixelIndex + 2] = finalColor[2];
        }
      }
    }
    
    return { grainEffectCount, processedPixels };
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
