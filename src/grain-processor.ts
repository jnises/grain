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
  convertGrayscaleLinearToSingleChannel,
  applyBeerLambertCompositingGrayscale,
  calculateGrainFalloffFromSquaredDistance,
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
import { DefaultRandomNumberGenerator } from './grain-generator';
import {
  assertPositiveInteger,
  assertObject,
  assert,
  devAssert,
  assertFiniteNumber,
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
    this.grainGenerator = new GrainGenerator(
      width,
      height,
      settings,
      rng || new DefaultRandomNumberGenerator()
    );
    this.performanceTracker = new PerformanceTracker();
    this.kernelGenerator = new KernelGenerator(
      rng || new DefaultRandomNumberGenerator()
    );
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

    if (s.lightnessEstimationSamplingDensity !== undefined) {
      if (
        typeof s.lightnessEstimationSamplingDensity !== 'number' ||
        s.lightnessEstimationSamplingDensity <= 0 ||
        s.lightnessEstimationSamplingDensity > 1.0
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
   * See ALGORITHM_DESIGN.md: "Core Design Principles" - light exposure and grain scaling
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
  public async processImage(
    imageData: ImageData,
    customGrains?: GrainPoint[]
  ): Promise<ImageData> {
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
    // See ALGORITHM_DESIGN.md: "Core Design Principles" - linear color space and grain scaling
    // ========================================================================

    // Convert input to grayscale at the start for monochrome processing
    const grayscaleImageData = convertImageDataToGrayscale(imageData);

    // Convert input to linear floating-point for precision preservation and gamma correctness
    const incomingImageLinear4Channel = convertSrgbToLinearFloat(
      grayscaleImageData.data
    );

    // Convert to single-channel for more efficient grain exposure calculations
    const incomingImageLinear = convertGrayscaleLinearToSingleChannel(
      incomingImageLinear4Channel
    );

    const totalImagePixels = this.width * this.height;

    // Start overall benchmark
    this.performanceTracker.startBenchmark(
      'Total Processing',
      totalImagePixels
    );

    // Step 1: Generate grain structure (simulates film emulsion grain distribution)
    this.reportProgress(5, 'Generating grain structure...');
    this.performanceTracker.startBenchmark('Grain Generation');
    const grainStructure = customGrains ?? this.generateGrainStructure();
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
    // See ALGORITHM_DESIGN.md: "2. Iterative Development Process"
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

      // Use sampling estimation for fast lightness factor calculation during iterations
      // This replaces the expensive full pixel processing with representative sampling
      this.performanceTracker.startBenchmark(
        `Iteration ${iteration + 1} - Lightness Sampling`
      );
      const lightnessDeviationFactor = this.estimateLightnessBySampling(
        incomingImageLinear,
        grainGrid,
        grainIntrinsicDensityMap,
        this.width,
        this.height,
        this.settings.lightnessEstimationSamplingDensity ?? 0.1
      );
      this.performanceTracker.endBenchmark(
        `Iteration ${iteration + 1} - Lightness Sampling`
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
    // See ALGORITHM_DESIGN.md: "Critical Implementation Rule: Film Negative Behavior"
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
      GrainProcessor.drawGrainCenters(
        result,
        grainStructure,
        this.width,
        this.height
      );
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
   * Calculate the grain effect for a single pixel at the given coordinates.
   * This is the core pixel processing logic extracted into a pure function
   * for reuse in both full processing and sampling estimation.
   *
   * @param x - Pixel x coordinate
   * @param y - Pixel y coordinate
   * @param grainGrid - Spatial lookup grid for efficient grain queries
   * @param grainIntrinsicDensityMap - Pre-calculated grain densities from development phase
   * @returns Object with finalGrayscale value and whether grains affected this pixel
   */
  private calculatePixelGrainEffect(
    x: number,
    y: number,
    grainGrid: SpatialLookupGrid,
    grainIntrinsicDensityMap: GrainIntrinsicDensityMap
  ): { finalGrayscale: number; hasGrainEffect: boolean } {
    // Initialize grain density for monochrome processing
    let totalGrainDensity = 0;
    let totalWeight = 0;

    // Get grains from nearby grid cells
    // Get all nearby grains using the efficient spatial lookup
    const nearbyGrains = grainGrid.getGrainsNear(
      x,
      y,
      grainGrid.getGrainLookupRadius()
    );

    // Constant for grain influence radius
    const GRAIN_INFLUENCE_RADIUS_FACTOR = 2;

    // Process nearby grains directly (already filtered by spatial grid)
    for (const grain of nearbyGrains) {
      // Calculate squared distance first to avoid expensive sqrt
      const dx = x - grain.x;
      const dy = y - grain.y;
      const distanceSquared = dx * dx + dy * dy;

      // Check influence radius using squared distance to avoid sqrt
      const influenceRadius = grain.size * GRAIN_INFLUENCE_RADIUS_FACTOR;
      const influenceRadiusSquared = influenceRadius * influenceRadius;

      if (distanceSquared < influenceRadiusSquared) {
        // Use pre-calculated intrinsic grain density
        const intrinsicDensity = grainIntrinsicDensityMap.get(grain);
        devAssert(
          intrinsicDensity !== undefined,
          'Intrinsic grain density not found in calculated map - this indicates a logic error',
          {
            grain: { x: grain.x, y: grain.y, size: grain.size },
            mapSize: grainIntrinsicDensityMap.size,
          }
        );

        // Calculate pixel-level grain effects using pre-calculated intrinsic density
        // This already includes the Gaussian falloff.
        const pixelGrainEffect =
          this.grainDensityCalculator.calculatePixelGrainEffect(
            intrinsicDensity,
            grain,
            x,
            y,
            distanceSquared
          );

        // The weight for averaging should be based on the Gaussian falloff.
        // Compute the Gaussian falloff factor directly.
        const falloffFactor = calculateGrainFalloffFromSquaredDistance(
          distanceSquared,
          grain.size
        );

        totalGrainDensity += pixelGrainEffect;
        totalWeight += falloffFactor;
      }
    }

    // Apply grain effects using proper darkroom printing physics
    // Start with uniform white enlarger light, apply grain density to simulate light passing through developed film
    let finalGrayscale = 1.0; // Start with maximum brightness (white enlarger light)
    let hasGrainEffect = false;

    if (totalWeight > 0) {
      hasGrainEffect = true;

      // Normalize by total weight for grayscale processing
      const normalizedDensity = totalGrainDensity / totalWeight;

      // Apply Beer-Lambert law to calculate light transmission through developed grains
      // Dense grains (heavily exposed) block more light during printing
      const lightTransmission =
        applyBeerLambertCompositingGrayscale(normalizedDensity);

      // Simulate photographic paper response: more light exposure = darker paper
      // Dense grains → low transmission → less light hits paper → lighter final result
      // Transparent grains → high transmission → more light hits paper → darker final result
      // This matches ALGORITHM_DESIGN.md: "Critical Implementation Rule: Film Negative Behavior"
      finalGrayscale = 1.0 - lightTransmission;
    } else {
      // If no grains affect this pixel, film is completely transparent
      // Maximum light transmission → maximum light hits paper → darkest result
      finalGrayscale = 0.0; // Full transmission through clear film = maximum paper exposure = dark result
    }

    return { finalGrayscale, hasGrainEffect };
  }

  /**
   * Estimate lightness factor by sampling a subset of pixels instead of processing the entire image.
   * This provides a significant performance improvement during iterative lightness compensation.
   *
   * @param originalImageData - Original image data in linear RGB format
   * @param grainGrid - Spatial lookup grid for efficient grain queries
   * @param grainIntrinsicDensityMap - Pre-calculated grain densities from development phase
   * @param outputWidth - Width of the output image
   * @param outputHeight - Height of the output image
   * @param samplingDensity - Fraction of pixels to sample (0.0 to 1.0), defaults to 0.1 (10%)
   * @returns Estimated lightness factor based on sampled pixels
   */
  private estimateLightnessBySampling(
    originalImageData: Float32Array,
    grainGrid: SpatialLookupGrid,
    grainIntrinsicDensityMap: GrainIntrinsicDensityMap,
    outputWidth: number,
    outputHeight: number,
    samplingDensity: number = 0.1
  ): number {
    assertFiniteNumber(samplingDensity, 'samplingDensity');
    assert(
      samplingDensity > 0 && samplingDensity <= 1.0,
      'samplingDensity must be between 0 and 1',
      { samplingDensity }
    );

    const totalPixels = outputWidth * outputHeight;
    const sampleCount = Math.max(1, Math.floor(totalPixels * samplingDensity));

    // Use grid-based sampling for better spatial distribution
    const gridSize = Math.ceil(Math.sqrt(sampleCount));
    const stepX = outputWidth / gridSize;
    const stepY = outputHeight / gridSize;

    let originalSum = 0;
    let processedSum = 0;
    let actualSampleCount = 0;

    // Sample pixels in a regular grid pattern for representative coverage
    for (let gridY = 0; gridY < gridSize; gridY++) {
      for (let gridX = 0; gridX < gridSize; gridX++) {
        if (actualSampleCount >= sampleCount) break;

        // Calculate pixel coordinates with some jitter to avoid aliasing
        const x = Math.floor(gridX * stepX + stepX * 0.5);
        const y = Math.floor(gridY * stepY + stepY * 0.5);

        // Ensure coordinates are within bounds
        if (x >= 0 && x < outputWidth && y >= 0 && y < outputHeight) {
          const pixelIndex = y * outputWidth + x;

          // Get original pixel value from single-channel data
          const originalLuminance = originalImageData[pixelIndex];

          // Calculate processed pixel value using the extracted logic
          const { finalGrayscale } = this.calculatePixelGrainEffect(
            x,
            y,
            grainGrid,
            grainIntrinsicDensityMap
          );

          originalSum += originalLuminance;
          processedSum += finalGrayscale;
          actualSampleCount++;
        }
      }
    }

    // Calculate lightness factor based on sampled pixels
    if (actualSampleCount === 0 || processedSum === 0) {
      return 1.0; // Fallback to no adjustment if no valid samples
    }

    const originalAverage = originalSum / actualSampleCount;
    const processedAverage = processedSum / actualSampleCount;

    // Apply the same logic as calculateLightnessFactor for consistency
    if (originalAverage <= 0.01) {
      // For very dark images, clamp correction factor to avoid amplifying noise
      return Math.min(originalAverage / Math.max(processedAverage, 0.001), 1.0);
    }

    // For normal images, calculate correction factor with reasonable bounds
    const lightnessDeviationFactor =
      originalAverage / Math.max(processedAverage, 0.001);
    return Math.max(0.01, Math.min(100.0, lightnessDeviationFactor));
  }

  /**
   * Process pixel effects with grain compositing
   * DARKROOM PRINTING PHASE (Phase 2 - Position-dependent effects)
   *
   * This simulates light passing through the developed film negative to create the final photograph.
   * Dense grains (heavily exposed) block more light, creating lighter areas in the final print.
   * Transparent grains (unexposed) allow more light through, creating darker areas in the final print.
   *
   * See ALGORITHM_DESIGN.md: "Critical Implementation Rule: Film Negative Behavior"
   */
  protected processPixelEffects(
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

        // Use the extracted pixel processing logic
        const { finalGrayscale, hasGrainEffect } =
          this.calculatePixelGrainEffect(
            x,
            y,
            grainGrid,
            grainIntrinsicDensityMap
          );

        if (hasGrainEffect) {
          grainEffectCount++;
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
   * Grain centers are color-coded by size: small=red, medium=orange, large=yellow
   */
  private static drawGrainCenters(
    imageData: ImageData,
    grainStructure: GrainPoint[],
    imageWidth: number,
    imageHeight: number
  ): void {
    console.log(`Drawing grain centers for ${grainStructure.length} grains`);

    if (grainStructure.length === 0) return;

    // Calculate size range for color coding
    const sizes = grainStructure.map((g) => g.size);
    let minSize = sizes[0];
    let maxSize = sizes[0];
    for (const size of sizes) {
      if (size < minSize) minSize = size;
      if (size > maxSize) maxSize = size;
    }
    const sizeRange = maxSize - minSize;

    const smallThreshold = minSize + sizeRange * 0.33;
    const mediumThreshold = minSize + sizeRange * 0.66;

    for (const grain of grainStructure) {
      const centerX = Math.round(grain.x);
      const centerY = Math.round(grain.y);

      // Draw a small cross at the grain center
      // Color-code by grain size: small=red, medium=orange, large=yellow
      const crossSize = Math.max(1, Math.floor(grain.size * 0.3)); // Scale cross size with grain size

      let color: { r: number; g: number; b: number };
      if (grain.size <= smallThreshold) {
        color = { r: 255, g: 68, b: 0 }; // Red-orange (#ff4400)
      } else if (grain.size <= mediumThreshold) {
        color = { r: 255, g: 136, b: 0 }; // Orange (#ff8800)
      } else {
        color = { r: 255, g: 255, b: 0 }; // Yellow (#ffff00)
      }

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

    console.log(
      `Debug: Drew ${grainStructure.length} grain center markers color-coded by size`
    );
  }
}
