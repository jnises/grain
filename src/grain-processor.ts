// Film Grain Processing Engine
// Implements physically plausible analog film grain algorithm

import { GrainGenerator } from './grain-generator';
import { SpatialLookupGrid } from './spatial-lookup-grid';
import { PerformanceTracker } from './performance-tracker';
import { KernelGenerator, sampleGrainAreaExposure } from './grain-sampling';
import { GrainDensityCalculator } from './grain-density';
import {
  convertSrgbToLinearFloat,
  convertLinearFloatToSrgb,
  calculateLightnessFactor,
  applyBeerLambertCompositingGrayscale,
} from './grain-math';
import { convertImageDataToGrayscale } from './color-space';
import { createGrainExposure } from './types';
import type {
  GrainSettings,
  GrainPoint,
  RandomNumberGenerator,
  GrainExposureMap,
  GrainIntrinsicDensityMap,
} from './types';
import {
  assertPositiveInteger,
  assertObject,
  assert,
  devAssert,
} from './utils';

// Progress reporting constants - module-specific to grain-processor
const PROGRESS_PERCENTAGES = {
  INITIAL: 0,
  GRAIN_GENERATION: 10,
  GRAIN_PROCESSING_START: 15,
  GRAIN_PROCESSING_END: 85,
  FINAL_PROCESSING: 95,
  COMPLETE: 100,
  ITERATION_START: 20,
  ITERATION_END: 80,
  ITERATION_RANGE: 60, // ITERATION_END - ITERATION_START
  PIXEL_PROCESSING: 85,
  DEBUG_DRAWING: 90,
} as const;

// Validation limits for grain processor
const VALIDATION_LIMITS = {
  MAX_ITERATIONS: 100,
  MIN_ITERATIONS: 1,
  MAX_ITERATIONS_LIMIT: 100,
  MIN_CONVERGENCE_THRESHOLD: 0.001,
  MAX_CONVERGENCE_THRESHOLD: 0.5,
  MIN_EXPOSURE_ADJUSTMENT: 0.1,
  MAX_EXPOSURE_ADJUSTMENT: 10.0,
  MAX_REASONABLE_DENSITY: 1000000, // Maximum reasonable grain density per unit area
} as const;

// Default iteration parameters for lightness convergence - only used in this module
const DEFAULT_ITERATION_PARAMETERS = {
  MAX_ITERATIONS: 5, // Maximum iterations for lightness convergence
  CONVERGENCE_THRESHOLD: 0.05, // 5% tolerance for lightness convergence
  TARGET_LIGHTNESS: 1.0, // Preserve original lightness
} as const;

// All operations should be done on linear colors. The incoming image is immediately converted from srgb to linear. Only convert back to srgb when writing the output image.
export class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private grainGenerator: GrainGenerator;
  private performanceTracker: PerformanceTracker;
  private kernelGenerator: KernelGenerator;
  private grainDensityCalculator: GrainDensityCalculator;

  constructor(
    width: number,
    height: number,
    settings: GrainSettings,
    rng?: RandomNumberGenerator
  ) {
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

    console.log(
      `Initializing GrainProcessor: ${width}x${height}, ISO: ${settings.iso}`
    );

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
    const basicValidation =
      typeof settings === 'object' &&
      settings !== null &&
      'iso' in settings &&
      typeof (settings as GrainSettings).iso === 'number' &&
      (settings as GrainSettings).iso > 0 &&
      'filmType' in settings &&
      typeof (settings as GrainSettings).filmType === 'string' &&
      ['kodak', 'fuji', 'ilford'].includes(
        (settings as GrainSettings).filmType
      );

    if (!basicValidation) return false;

    const s = settings as GrainSettings;

    // Validate optional iteration parameters if provided
    if (s.maxIterations !== undefined) {
      if (
        typeof s.maxIterations !== 'number' ||
        s.maxIterations < VALIDATION_LIMITS.MIN_ITERATIONS ||
        s.maxIterations > VALIDATION_LIMITS.MAX_ITERATIONS_LIMIT
      ) {
        return false;
      }
    }

    if (s.convergenceThreshold !== undefined) {
      if (
        typeof s.convergenceThreshold !== 'number' ||
        s.convergenceThreshold <= VALIDATION_LIMITS.MIN_CONVERGENCE_THRESHOLD ||
        s.convergenceThreshold > VALIDATION_LIMITS.MAX_CONVERGENCE_THRESHOLD
      ) {
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
  private calculateGrainExposures(
    grains: GrainPoint[],
    imageData: Float32Array
  ): GrainExposureMap {
    console.log(
      `Calculating kernel-based exposures for ${grains.length} grains...`
    );

    const exposureMap: GrainExposureMap = new Map();

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
      exposureMap.set(grain, createGrainExposure(averageExposure));
    }

    console.log(
      `Completed kernel-based exposure calculation for ${exposureMap.size} grains`
    );
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
  private createGrainGrid(grains: GrainPoint[]): SpatialLookupGrid {
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
        actualHeight: imageData.height,
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
    const incomingImageLinear = convertSrgbToLinearFloat(grayscaleImageData.data);

    const totalImagePixels = this.width * this.height;

    // Start overall benchmark
    this.performanceTracker.startBenchmark(
      'Total Processing',
      totalImagePixels
    );

    // Step 1: Generate grain structure (simulates film emulsion grain distribution)
    this.reportProgress(5, 'Generating grain structure...');
    this.performanceTracker.startBenchmark('Grain Generation');
    const grainStructure = this.generateGrainStructure();
    this.performanceTracker.endBenchmark('Grain Generation');

    // Step 2: Create spatial acceleration grid for efficient grain lookup
    this.reportProgress(6, 'Creating spatial grid...');
    this.performanceTracker.startBenchmark('Spatial Grid Creation');
    const grainGrid = this.createGrainGrid(grainStructure);
    this.performanceTracker.endBenchmark('Spatial Grid Creation');

    // Step 3: Calculate grain exposures using kernel-based sampling
    // This samples how much light each grain received from the input image
    this.reportProgress(7, 'Calculating kernel-based grain exposures...');
    this.performanceTracker.startBenchmark('Kernel Exposure Calculation');
    const grainExposureMap = this.calculateGrainExposures(
      grainStructure,
      incomingImageLinear
    );
    this.performanceTracker.endBenchmark('Kernel Exposure Calculation');

    // ========================================================================
    // ITERATIVE FILM DEVELOPMENT PHASE - Development Phase with Lightness Convergence
    // Iteratively adjust grain exposures until desired lightness is achieved.
    // This is more physically plausible than applying lightness correction at the end.
    // See ALGORITHM_DESIGN.md: "Film Development Phase"
    // ========================================================================

    // Constants for iterative lightness compensation
    const MAX_ITERATIONS =
      this.settings.maxIterations ??
      DEFAULT_ITERATION_PARAMETERS.MAX_ITERATIONS;
    const CONVERGENCE_THRESHOLD =
      this.settings.convergenceThreshold ??
      DEFAULT_ITERATION_PARAMETERS.CONVERGENCE_THRESHOLD;
    const TARGET_LIGHTNESS = DEFAULT_ITERATION_PARAMETERS.TARGET_LIGHTNESS;

    this.reportProgress(
      PROGRESS_PERCENTAGES.ITERATION_START,
      'Starting iterative film development...'
    );
    this.performanceTracker.startBenchmark('Iterative Development');

    // Initialize exposure compensation factor
    let lightnessCompensationFactor = 1.0;
    let convergedGrainIntrinsicDensityMap: GrainIntrinsicDensityMap | null =
      null;
    let actualIterations = 0;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Update progress for each iteration within the development phase (10% to 80%)
      const iterationProgress =
        PROGRESS_PERCENTAGES.ITERATION_START +
        (iteration / MAX_ITERATIONS) * PROGRESS_PERCENTAGES.ITERATION_RANGE;
      this.reportProgress(
        iterationProgress,
        `Film development iteration ${iteration + 1}/${MAX_ITERATIONS}...`
      );

      console.log(
        `Development iteration ${iteration + 1}/${MAX_ITERATIONS}, lightness compensation: ${lightnessCompensationFactor.toFixed(4)}`
      );

      // Track per-iteration performance
      this.performanceTracker.startBenchmark(
        `Development Iteration ${iteration + 1}`
      );

      // Apply exposure compensation to grain exposure map
      const adjustedGrainExposureMap = GrainProcessor.adjustGrainExposures(
        grainExposureMap,
        lightnessCompensationFactor
      );

      // Execute film development phase with adjusted exposures
      this.performanceTracker.startBenchmark(
        `Iteration ${iteration + 1} - Intrinsic Density Calculation`
      );
      const grainIntrinsicDensityMap =
        this.grainDensityCalculator.calculateIntrinsicGrainDensities(
          grainStructure,
          adjustedGrainExposureMap
        );
      this.performanceTracker.endBenchmark(
        `Iteration ${iteration + 1} - Intrinsic Density Calculation`
      );

      // TODO: this is too slow. we need the sampling estimation
      // Calculate full lightness factor using complete pixel processing (no sampling estimation)
      // This ensures consistency with the main pipeline and avoids code duplication
      this.performanceTracker.startBenchmark(
        `Iteration ${iteration + 1} - Pixel Processing`,
        this.width * this.height
      );
      const { resultFloatData: iterationProcessedFloatData } =
        this.processPixelEffects(
          grainStructure,
          grainGrid,
          grainIntrinsicDensityMap,
          this.width,
          this.height
        );
      this.performanceTracker.endBenchmark(
        `Iteration ${iteration + 1} - Pixel Processing`
      );

      const lightnessDeviationFactor = calculateLightnessFactor(
        incomingImageLinear,
        iterationProcessedFloatData
      );

      console.log(
        `Iteration ${iteration + 1}: lightness deviation factor = ${lightnessDeviationFactor.toFixed(4)}`
      );

      // End per-iteration benchmark
      this.performanceTracker.endBenchmark(
        `Development Iteration ${iteration + 1}`
      );
      actualIterations = iteration + 1;

      // Check convergence
      if (
        Math.abs(lightnessDeviationFactor - TARGET_LIGHTNESS) <
        CONVERGENCE_THRESHOLD
      ) {
        console.log(`Lightness converged after ${iteration + 1} iterations`);
        convergedGrainIntrinsicDensityMap = grainIntrinsicDensityMap;
        break;
      }

      // Adjust exposure for next iteration
      // If lightness factor > 1, image is too dark → increase exposure to make final print lighter
      // If lightness factor < 1, image is too bright → decrease exposure to make final print darker
      lightnessCompensationFactor *= lightnessDeviationFactor;

      // Store the density map from this iteration
      convergedGrainIntrinsicDensityMap = grainIntrinsicDensityMap;

      // Prevent extreme adjustments
      lightnessCompensationFactor = Math.max(
        VALIDATION_LIMITS.MIN_EXPOSURE_ADJUSTMENT,
        Math.min(
          VALIDATION_LIMITS.MAX_EXPOSURE_ADJUSTMENT,
          lightnessCompensationFactor
        )
      );
    }

    // If we completed max iterations without convergence, still count the final iteration
    if (actualIterations === 0) {
      actualIterations = MAX_ITERATIONS;
    }

    // Use the final converged grain densities
    const finalGrainIntrinsicDensityMap = convergedGrainIntrinsicDensityMap!;

    this.performanceTracker.endBenchmark('Iterative Development');
    console.log(
      `Film development completed after ${actualIterations} iteration${actualIterations === 1 ? '' : 's'} with lightness compensation factor: ${lightnessCompensationFactor.toFixed(4)}`
    );

    // Report completion of iterative development phase
    this.reportProgress(
      PROGRESS_PERCENTAGES.ITERATION_END,
      `Film development completed after ${actualIterations} iteration${actualIterations === 1 ? '' : 's'}`
    );

    // ========================================================================
    // DARKROOM PRINTING PHASE - Printing Phase
    // Apply the developed film negative to create the final photograph.
    // Light passes through developed grains (Phase 2 - position-dependent effects).
    // See ALGORITHM_DESIGN.md: "Darkroom Printing Phase"
    // ========================================================================

    // Step 4: Process each pixel (Phase 2 - position-dependent grain effects)
    // This simulates light passing through the developed film to create the final image
    this.reportProgress(
      PROGRESS_PERCENTAGES.PIXEL_PROCESSING,
      'Processing pixels...'
    );
    this.performanceTracker.startBenchmark(
      'Pixel Processing',
      this.width * this.height
    );

    // TODO: could we reuse the results from the processPixelEffects in the lightness iteration above?
    // Process pixel effects through extracted pure function
    const {
      resultFloatData: processedFloatData,
      grainEffectCount,
      processedPixels,
    } = this.processPixelEffects(
      grainStructure,
      grainGrid,
      finalGrainIntrinsicDensityMap,
      this.width,
      this.height
    );

    // End pixel processing benchmark
    this.performanceTracker.endBenchmark('Pixel Processing');

    // ========================================================================
    // FINAL OUTPUT PROCESSING
    // Convert from linear space back to sRGB.
    // All color operations are done in linear space as specified in ALGORITHM_DESIGN.md.
    // ========================================================================

    // Convert back to Uint8ClampedArray with gamma encoding (sRGB packing at pipeline boundary)
    const finalData = convertLinearFloatToSrgb(processedFloatData);

    // Create ImageData result - handle both browser and Node.js environments
    const result =
      typeof ImageData !== 'undefined'
        ? new ImageData(finalData, this.width, this.height)
        : ({
            width: this.width,
            height: this.height,
            data: finalData,
          } as ImageData);

    // End overall benchmark
    this.performanceTracker.endBenchmark('Total Processing');

    console.log(`=== Processing Summary ===`);
    console.log(`Total pixels processed: ${processedPixels}`);
    console.log(`Pixels with grain effect: ${grainEffectCount}`);
    console.log(
      `Grain effect coverage: ${((grainEffectCount / processedPixels) * 100).toFixed(2)}%`
    );
    console.log(
      `Processing mode: Single Layer (Variable Sizes), Density Model`
    );

    // Log performance benchmarks including iteration breakdown
    this.performanceTracker.logSummary();
    this.performanceTracker.logIterationSummary();

    // Calculate and log performance metrics for multiple layers optimization
    const totalBenchmark =
      this.performanceTracker.getBenchmark('Total Processing');
    const pixelBenchmark =
      this.performanceTracker.getBenchmark('Pixel Processing');
    const layerBenchmark = this.performanceTracker.getBenchmark(
      'Single Layer Processing'
    );

    if (totalBenchmark && pixelBenchmark) {
      console.log(`\n=== Performance Metrics ===`);
      console.log(
        `Total processing speed: ${(totalBenchmark.pixelsPerSecond! / 1000000).toFixed(2)}M pixels/sec`
      );
      console.log(
        `Pixel processing speed: ${(pixelBenchmark.pixelsPerSecond! / 1000000).toFixed(2)}M pixels/sec`
      );
      console.log(
        `Processing overhead: ${(((totalBenchmark.duration! - pixelBenchmark.duration!) / totalBenchmark.duration!) * 100).toFixed(1)}%`
      );

      if (layerBenchmark) {
        console.log(`Layer processing mode: Single Layer (Variable Sizes)`);
        console.log(
          `Layer processing time: ${layerBenchmark.duration!.toFixed(2)}ms`
        );
        console.log(
          `Layer processing efficiency: ${(pixelBenchmark.duration! / layerBenchmark.duration!).toFixed(2)}x pixel processing speed`
        );
      }
    }

    // Debug: Draw grain center points if requested
    if (this.settings.debugGrainCenters) {
      this.reportProgress(
        PROGRESS_PERCENTAGES.DEBUG_DRAWING,
        'Drawing debug grain centers...'
      );
      console.log('Debug mode: Drawing grain center points');
      GrainProcessor.drawGrainCenters(result, grainStructure, this.width, this.height);
    }

    this.reportProgress(PROGRESS_PERCENTAGES.COMPLETE, 'Complete!');
    return result;
  }

  /**
   * Adjust grain exposures by a factor for iterative lightness compensation
   * Uses logarithmic scaling to stay within reasonable bounds while preserving relative differences
   *
   * @param originalExposureMap - Original grain exposure map
   * @param adjustmentFactor - Factor to adjust exposures by
   * @returns New adjusted exposure map with values clamped to [0, 1]
   */
  private static adjustGrainExposures(
    originalExposureMap: GrainExposureMap,
    adjustmentFactor: number
  ): GrainExposureMap {
    const adjustedMap: GrainExposureMap = new Map();

    // Use smaller, more conservative adjustment steps to avoid exceeding bounds
    // Convert factor to logarithmic adjustment for more stable iteration
    const logAdjustment = Math.log(adjustmentFactor);
    const clampedLogAdjustment = Math.max(-2.0, Math.min(2.0, logAdjustment)); // Limit to reasonable range
    const safeAdjustmentFactor = Math.exp(clampedLogAdjustment * 0.3); // Apply with dampening

    for (const [grain, exposure] of originalExposureMap.entries()) {
      const adjustedExposure = exposure * safeAdjustmentFactor;
      // Strictly clamp to [0, 1] range as required by grain density calculator
      const clampedExposure = Math.max(0.0, Math.min(1.0, adjustedExposure));
      adjustedMap.set(grain, createGrainExposure(clampedExposure));
    }

    return adjustedMap;
  }

  /**
   * Helper to report progress - can be overridden in worker vs direct usage
   */
  protected reportProgress(progress: number, stage: string): void {
    // Default implementation does nothing - overridden in worker
    console.debug(`Progress: ${progress}% - ${stage}`);
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
    grainGrid: SpatialLookupGrid,
    grainIntrinsicDensityMap: GrainIntrinsicDensityMap, // Grain densities from development phase
    outputWidth: number,
    outputHeight: number
  ): {
    resultFloatData: Float32Array;
    grainEffectCount: number;
    processedPixels: number;
  } {
    // Create new result array starting with uniform white light (darkroom enlarger light)
    // This simulates the light that will pass through the developed film negative
    const resultFloatData = new Float32Array(outputWidth * outputHeight * 4);
    // Initialize all pixels to maximum brightness (white light from enlarger)
    for (let i = 0; i < resultFloatData.length; i += 4) {
      resultFloatData[i] = 1.0; // Red channel
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
        // Get all nearby grains using the efficient spatial lookup
        const GRAIN_LOOKUP_RADIUS = grainGrid.getGridSize() * 1.5; // Search radius for nearby grains
        const nearbyGrains = grainGrid.getGrainsNear(x, y, GRAIN_LOOKUP_RADIUS);

        // Process nearby grains directly (already filtered by spatial grid)
        for (const grain of nearbyGrains) {
          const distance = Math.sqrt((x - grain.x) ** 2 + (y - grain.y) ** 2);

          // Constant for grain influence radius
          const GRAIN_INFLUENCE_RADIUS_FACTOR = 2;
          if (distance < grain.size * GRAIN_INFLUENCE_RADIUS_FACTOR) {
            const weight = Math.exp(-distance / grain.size);

            // Use pre-calculated intrinsic grain density
            const intrinsicDensity = grainIntrinsicDensityMap.get(grain);
            devAssert(
              intrinsicDensity !== undefined,
              'Intrinsic grain density not found in calculated map - this indicates a logic error',
              {
                grain: { x: grain.x, y: grain.y, size: grain.size },
                mapSize: grainIntrinsicDensityMap.size,
                grainStructureLength: grainStructure.length,
              }
            );

            // Calculate pixel-level grain effects using pre-calculated intrinsic density
            const pixelGrainEffect =
              this.grainDensityCalculator.calculatePixelGrainEffect(
                intrinsicDensity,
                grain,
                x,
                y
              );

            // For monochrome processing, use simple grayscale density accumulation
            // Skip color-specific effects (channel sensitivity, color shifts, chromatic aberration)
            // pixelGrainEffect is already the final optical density contribution
            totalGrainDensity += pixelGrainEffect * weight;

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

          // Apply Beer-Lambert law to calculate light transmission through developed grains
          // Dense grains (heavily exposed) block more light during printing
          const lightTransmission =
            applyBeerLambertCompositingGrayscale(normalizedDensity);

          // Simulate photographic paper response: more light exposure = darker paper
          // Dense grains → low transmission → less light hits paper → lighter final result
          // Transparent grains → high transmission → more light hits paper → darker final result
          // This matches ALGORITHM_DESIGN.md: "Dense grains create lighter areas in the print"
          finalGrayscale = 1.0 - lightTransmission;
        } else {
          // If no grains affect this pixel, film is completely transparent
          // Maximum light transmission → maximum light hits paper → darkest result
          finalGrayscale = 0.0; // Full transmission through clear film = maximum paper exposure = dark result
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
  private static drawGrainCenters(
    imageData: ImageData,
    grainStructure: GrainPoint[],
    imageWidth: number,
    imageHeight: number
  ): void {
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
        if (x >= 0 && x < imageWidth && centerY >= 0 && centerY < imageHeight) {
          const pixelIndex = (centerY * imageWidth + x) * 4;
          imageData.data[pixelIndex] = color.r;
          imageData.data[pixelIndex + 1] = color.g;
          imageData.data[pixelIndex + 2] = color.b;
          // Keep alpha unchanged
        }
      }

      // Draw vertical line
      for (let dy = -crossSize; dy <= crossSize; dy++) {
        const y = centerY + dy;
        if (centerX >= 0 && centerX < imageWidth && y >= 0 && y < imageHeight) {
          const pixelIndex = (y * imageWidth + centerX) * 4;
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
