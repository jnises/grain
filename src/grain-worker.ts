// Web Worker for Film Grain Processing
// Implements physically plausible analog film grain algorithm

import { GrainGenerator } from './grain-generator';
import { FILM_CHARACTERISTICS, EXPOSURE_CONVERSION } from './constants';
import type {
  GrainSettings,
  LabColor,
  GrainPoint,
  GrainDensity,
  ProcessMessage,
  ProgressMessage,
  ResultMessage
} from './types';
import { 
  assertPositiveInteger, 
  assertObject, 
  assertImageData, 
  assertInRange,
  assert
} from './utils';

// File-level constants shared across methods
const RGB_MAX_VALUE = 255;

// Performance benchmarking interface
interface PerformanceBenchmark {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pixelsProcessed?: number;
  pixelsPerSecond?: number;
}

// Performance tracking utility
class PerformanceTracker {
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();
  
  startBenchmark(operation: string, pixelsProcessed?: number): void {
    this.benchmarks.set(operation, {
      operation,
      startTime: performance.now(),
      pixelsProcessed
    });
  }
  
  endBenchmark(operation: string): PerformanceBenchmark | null {
    const benchmark = this.benchmarks.get(operation);
    if (!benchmark) return null;
    
    benchmark.endTime = performance.now();
    benchmark.duration = benchmark.endTime - benchmark.startTime;
    
    if (benchmark.pixelsProcessed) {
      benchmark.pixelsPerSecond = benchmark.pixelsProcessed / (benchmark.duration / 1000);
    }
    
    return benchmark;
  }
  
  getBenchmark(operation: string): PerformanceBenchmark | null {
    return this.benchmarks.get(operation) || null;
  }
  
  getAllBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values()).filter(b => b.duration !== undefined);
  }
  
  logSummary(): void {
    console.log('\n=== Performance Benchmarks ===');
    for (const benchmark of this.getAllBenchmarks()) {
      console.log(`${benchmark.operation}: ${benchmark.duration?.toFixed(2)}ms`);
      if (benchmark.pixelsPerSecond) {
        console.log(`  - ${(benchmark.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec`);
      }
    }
  }
}

// Utility functions for grain generation
class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private grainGenerator: GrainGenerator;
  private performanceTracker: PerformanceTracker;

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
  }

  // Type guard for GrainSettings
  private isValidGrainSettings(settings: any): settings is GrainSettings {
    return settings &&
           typeof settings.iso === 'number' && settings.iso > 0 &&
           typeof settings.filmType === 'string' &&
           ['kodak', 'fuji', 'ilford'].includes(settings.filmType) &&
           typeof settings.grainIntensity === 'number' && settings.grainIntensity >= 0 &&
           typeof settings.upscaleFactor === 'number' && settings.upscaleFactor > 0;
  }

  // 2D Perlin noise implementation
  private noise(x: number, y: number): number {
    // Noise generation constants
    const NOISE_GRID_MASK = 255;
    const PERLIN_FADE_COEFFICIENT_A = 3;
    const PERLIN_FADE_COEFFICIENT_B = 2;
    
    const X = Math.floor(x) & NOISE_GRID_MASK;
    const Y = Math.floor(y) & NOISE_GRID_MASK;
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const a = this.grainGenerator.seededRandom(X + Y * 256);
    const b = this.grainGenerator.seededRandom(X + 1 + Y * 256);
    const c = this.grainGenerator.seededRandom(X + (Y + 1) * 256);
    const d = this.grainGenerator.seededRandom(X + 1 + (Y + 1) * 256);
    
    const u = x * x * (PERLIN_FADE_COEFFICIENT_A - PERLIN_FADE_COEFFICIENT_B * x);
    const v = y * y * (PERLIN_FADE_COEFFICIENT_A - PERLIN_FADE_COEFFICIENT_B * y);
    
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  // Convert RGB to LAB color space
  // Currently unused but preserved for potential future color processing features
  // @ts-expect-error - Preserved for future use
  private rgbToLab(r: number, g: number, b: number): LabColor {
    // Validate input parameters with custom assertions
    assertInRange(r, 0, 255, 'r');
    assertInRange(g, 0, 255, 'g');
    assertInRange(b, 0, 255, 'b');

    // Color space conversion constants
    const RGB_GAMMA_THRESHOLD = 0.04045;
    const RGB_GAMMA_LINEAR_DIVISOR = 12.92;
    const RGB_GAMMA_POWER = 2.4;
    const RGB_GAMMA_OFFSET = 0.055;
    const RGB_GAMMA_MULTIPLIER = 1.055;

    const RGB_TO_XYZ_MATRIX = {
      x: { r: 0.4124564, g: 0.3575761, b: 0.1804375 },
      y: { r: 0.2126729, g: 0.7151522, b: 0.0721750 },
      z: { r: 0.0193339, g: 0.1191920, b: 0.9503041 }
    } as const;

    const D65_ILLUMINANT = {
      x: 0.95047,
      y: 1.00000,
      z: 1.08883
    } as const;

    const LAB_EPSILON = 0.008856;
    const LAB_KAPPA = 7.787;
    const LAB_DELTA = 16 / 116;
    const LAB_L_MULTIPLIER = 116;
    const LAB_L_OFFSET = 16;
    const LAB_A_MULTIPLIER = 500;
    const LAB_B_MULTIPLIER = 200;

    // Normalize RGB values
    r /= RGB_MAX_VALUE;
    g /= RGB_MAX_VALUE;
    b /= RGB_MAX_VALUE;

    // Apply gamma correction
    r = r > RGB_GAMMA_THRESHOLD ? ((r + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER) ** RGB_GAMMA_POWER : r / RGB_GAMMA_LINEAR_DIVISOR;
    g = g > RGB_GAMMA_THRESHOLD ? ((g + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER) ** RGB_GAMMA_POWER : g / RGB_GAMMA_LINEAR_DIVISOR;
    b = b > RGB_GAMMA_THRESHOLD ? ((b + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER) ** RGB_GAMMA_POWER : b / RGB_GAMMA_LINEAR_DIVISOR;

    // Convert to XYZ
    let x = r * RGB_TO_XYZ_MATRIX.x.r + g * RGB_TO_XYZ_MATRIX.x.g + b * RGB_TO_XYZ_MATRIX.x.b;
    let y = r * RGB_TO_XYZ_MATRIX.y.r + g * RGB_TO_XYZ_MATRIX.y.g + b * RGB_TO_XYZ_MATRIX.y.b;
    let z = r * RGB_TO_XYZ_MATRIX.z.r + g * RGB_TO_XYZ_MATRIX.z.g + b * RGB_TO_XYZ_MATRIX.z.b;

    // Normalize for D65 illuminant
    x /= D65_ILLUMINANT.x;
    y /= D65_ILLUMINANT.y;
    z /= D65_ILLUMINANT.z;

    // Validate XYZ values with custom assertion
    assert(
      Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z),
      'Color space conversion produced invalid XYZ values',
      { 
        xyz: { x, y, z }, 
        originalRGB: { r: r * 255, g: g * 255, b: b * 255 },
        finite: { x: Number.isFinite(x), y: Number.isFinite(y), z: Number.isFinite(z) }
      }
    );

    // Convert to LAB
    x = x > LAB_EPSILON ? x ** (1/3) : (LAB_KAPPA * x + LAB_DELTA);
    y = y > LAB_EPSILON ? y ** (1/3) : (LAB_KAPPA * y + LAB_DELTA);
    z = z > LAB_EPSILON ? z ** (1/3) : (LAB_KAPPA * z + LAB_DELTA);

    const labResult = {
      l: LAB_L_MULTIPLIER * y - LAB_L_OFFSET,
      a: LAB_A_MULTIPLIER * (x - y),
      b: LAB_B_MULTIPLIER * (y - z)
    };

    // Validate LAB result with custom assertion
    assert(
      Number.isFinite(labResult.l) && Number.isFinite(labResult.a) && Number.isFinite(labResult.b),
      'Color space conversion produced invalid LAB values',
      { 
        lab: labResult, 
        originalRGB: { r: r * 255, g: g * 255, b: b * 255 },
        finite: { 
          l: Number.isFinite(labResult.l), 
          a: Number.isFinite(labResult.a), 
          b: Number.isFinite(labResult.b) 
        }
      }
    );

    return labResult;
  }

  // Enhanced film characteristic curve (photographic S-curve)
  // Implements proper photographic response with toe and shoulder compression
  private filmCurve(input: number): number {
    // Validate input
    assertInRange(input, 0, 1, 'input');
    
    // Get film-specific curve parameters
    const filmCharacteristics = FILM_CHARACTERISTICS[this.settings.filmType];
    const curve = filmCharacteristics.filmCurve;
    
    // Apply photographic S-curve with toe and shoulder compression
    // This replaces the basic sigmoid with realistic film characteristic curve
    
    // Ensure input is in valid range
    const x = Math.max(0, Math.min(1, input));
    
    // Apply gamma curve as base
    let output = Math.pow(x, 1.0 / curve.gamma);
    
    // Apply toe compression (shadow detail preservation)
    if (x < curve.toe) {
      const toeRatio = x / curve.toe;
      const compressedToe = Math.pow(toeRatio, curve.toeStrength);
      output = compressedToe * curve.toe;
    }
    
    // Apply shoulder compression (highlight detail preservation)
    if (x > curve.shoulder) {
      const shoulderRange = 1.0 - curve.shoulder;
      const shoulderRatio = (x - curve.shoulder) / shoulderRange;
      const compressedShoulder = 1.0 - Math.pow(1.0 - shoulderRatio, curve.shoulderStrength);
      output = curve.shoulder + compressedShoulder * shoulderRange;
    }
    
    // Ensure output stays in valid range
    return Math.max(0, Math.min(1, output));
  }

  // Convert RGB to photographic exposure using logarithmic scaling
  // This replaces the linear LAB luminance conversion with proper exposure simulation
  private rgbToExposure(r: number, g: number, b: number): number {
    // Validate input parameters
    assertInRange(r, 0, 255, 'r');
    assertInRange(g, 0, 255, 'g');
    assertInRange(b, 0, 255, 'b');

    // Normalize RGB values to [0, 1] range
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    // Calculate weighted luminance using photographic weights
    // These weights account for human eye sensitivity (ITU-R BT.709)
    const luminance = 
      rNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.red +
      gNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.green +
      bNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.blue;

    // Add small offset to prevent log(0) in pure black areas
    const safeLuminance = luminance + EXPOSURE_CONVERSION.LUMINANCE_OFFSET;

    // Convert to logarithmic exposure scale
    // This follows photographic principles where exposure is measured in stops (log scale)
    // Formula: exposure = log(luminance / middle_gray) * scale_factor
    const logExposure = Math.log(safeLuminance / EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE) / 
                       Math.log(EXPOSURE_CONVERSION.LOG_BASE);
    
    // Scale and normalize exposure to [0, 1] range for grain calculations
    // This maps the exposure range to usable values for grain strength calculations
    const normalizedExposure = (logExposure + EXPOSURE_CONVERSION.EXPOSURE_SCALE) / 
                              (2 * EXPOSURE_CONVERSION.EXPOSURE_SCALE);

    // Clamp to [0, 1] range to handle extreme values
    return Math.max(0, Math.min(1, normalizedExposure));
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
    const data = new Uint8ClampedArray(imageData.data);
    const result = new ImageData(data, this.width, this.height);
    const totalImagePixels = this.width * this.height;
    
    // Start overall benchmark
    this.performanceTracker.startBenchmark('Total Processing', totalImagePixels);
    
    // Step 1: Generate grain structure
    postMessage({ type: 'progress', progress: 10, stage: 'Generating grain structure...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Grain Generation');
    const grainStructure = this.generateGrainStructure();
    this.performanceTracker.endBenchmark('Grain Generation');
    
    // Step 2: Create spatial acceleration grid
    postMessage({ type: 'progress', progress: 20, stage: 'Creating spatial grid...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Spatial Grid Creation');
    const grainGrid = this.createGrainGrid(grainStructure);
    this.performanceTracker.endBenchmark('Spatial Grid Creation');
    
    // Determine grid size for spatial lookup
    let maxGrainSize = 1;
    if (Array.isArray(grainStructure) && grainStructure.length > 0) {
      // Single layer with varying grain sizes
      const grains = grainStructure as GrainPoint[];
      maxGrainSize = Math.max(...grains.map(g => g.size));
    }
    const gridSize = Math.max(8, Math.floor(maxGrainSize * 2));
    
    // Step 3: Process each pixel
    postMessage({ type: 'progress', progress: 30, stage: 'Processing pixels...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Pixel Processing', totalImagePixels);
    
    let grainEffectCount = 0;
    let processedPixels = 0;
    
    // Start performance benchmark for pixel processing
    this.performanceTracker.startBenchmark('Pixel Processing', this.width * this.height);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIndex = (y * this.width + x) * 4;
        processedPixels++;
        
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const a = data[pixelIndex + 3];
        
        // Convert RGB to photographic exposure using logarithmic scaling
        // This replaces the linear LAB luminance with proper exposure simulation
        const exposure = this.rgbToExposure(r, g, b);
        
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
        
        // Process grain effects (single layer with varying sizes)
        // Start benchmark for single layer processing (first pixel only)
        if (x === 0 && y === 0) {
          this.performanceTracker.startBenchmark('Single Layer Processing');
        }
        
        // Process nearby grains directly (already filtered by spatial grid)
        for (const grain of nearbyGrains) {
          const distance = Math.sqrt((x - grain.x) ** 2 + (y - grain.y) ** 2);
          
          if (distance < grain.size * 2) {
            const weight = Math.exp(-distance / grain.size);
            const grainStrength = this.calculateGrainStrength(exposure, grain, x, y);
            const grainDensity = this.calculateGrainDensity(grainStrength, grain, 1.0); // No layer multiplier
            
            // Apply film-specific channel characteristics with enhanced color effects
            const filmCharacteristics = FILM_CHARACTERISTICS[this.settings.filmType];
            const channelSensitivity = filmCharacteristics.channelSensitivity;
            const baseColorShift = filmCharacteristics.colorShift;
            
            // Calculate position-dependent color temperature shift
            const normalizedDistance = distance / grain.size;
            const temperatureShift = this.calculateTemperatureShift(grain, normalizedDistance);
            
            // Calculate chromatic aberration based on distance from grain center
            const chromaticAberration = this.calculateChromaticAberration(normalizedDistance);
            
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
        
        // End benchmark for single layer processing (last pixel only)
        if (x === this.width - 1 && y === this.height - 1) {
          this.performanceTracker.endBenchmark('Single Layer Processing');
        }
        
        // Apply final compositing
        if (totalWeight > 0) {
          grainEffectCount++;
          
          // Normalize by total weight
          totalGrainDensity.r /= totalWeight;
          totalGrainDensity.g /= totalWeight;
          totalGrainDensity.b /= totalWeight;
          
          let finalColor: [number, number, number];
          
          // Use density-based compositing (physically accurate)
          finalColor = this.applySimpleDensityCompositing([r, g, b], totalGrainDensity);
          
          result.data[pixelIndex] = finalColor[0];
          result.data[pixelIndex + 1] = finalColor[1];
          result.data[pixelIndex + 2] = finalColor[2];
          result.data[pixelIndex + 3] = a;
        }
      }
      
      // Update progress periodically
      if (y % Math.floor(this.height / 10) === 0) {
        const progress = 30 + (y / this.height) * 60;
        postMessage({ 
          type: 'progress', 
          progress, 
          stage: `Processing pixels... ${Math.floor(progress)}%` 
        } as ProgressMessage);
      }
    }
    
    // End pixel processing benchmark
    this.performanceTracker.endBenchmark('Pixel Processing');
    
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
    
    postMessage({ type: 'progress', progress: 100, stage: 'Complete!' } as ProgressMessage);
    return result;
  }

  // Calculate grain strength based on exposure and grain properties
  private calculateGrainStrength(exposure: number, grain: GrainPoint, x: number, y: number): number {
    // Noise texture generation constants
    const NOISE_SCALE_FINE = 0.15;
    const NOISE_SCALE_MEDIUM = 0.08;
    const NOISE_SCALE_COARSE = 0.03;
    const NOISE_WEIGHT_FINE = 0.6;
    const NOISE_WEIGHT_MEDIUM = 0.3;
    const NOISE_WEIGHT_COARSE = 0.1;

    // Enhanced exposure-dependent grain response based on photographic principles
    const exposureResponse = this.calculateExposureBasedGrainStrength(exposure);
    
    // Add noise for grain texture with multiple octaves
    const noiseValue = this.noise(x * NOISE_SCALE_FINE, y * NOISE_SCALE_FINE) * NOISE_WEIGHT_FINE + 
                      this.noise(x * NOISE_SCALE_MEDIUM, y * NOISE_SCALE_MEDIUM) * NOISE_WEIGHT_MEDIUM + 
                      this.noise(x * NOISE_SCALE_COARSE, y * NOISE_SCALE_COARSE) * NOISE_WEIGHT_COARSE;
    
    // Film characteristic curve
    const filmResponse = this.filmCurve(exposure);
    
    // Combine all factors
    const baseStrength = grain.sensitivity * exposureResponse * filmResponse;
    const finalStrength = baseStrength * (0.3 + Math.abs(noiseValue) * 0.7);
    
    // Apply grain shape variation
    const shapeModifier = 0.7 + grain.shape * 0.6;
    
    return finalStrength * shapeModifier * 1.0; // Increased multiplier for better visibility
  }

  // Enhanced exposure-dependent grain response following photographic principles
  private calculateExposureBasedGrainStrength(exposure: number): number {
    // Define key exposure zones for film-like grain response
    const SHADOW_THRESHOLD = 0.2;    // Below this: deep shadows
    const MIDTONE_START = 0.25;      // Start of mid-tone emphasis
    const MIDTONE_PEAK = 0.5;        // Peak grain visibility
    const MIDTONE_END = 0.75;        // End of strong mid-tone response
    const HIGHLIGHT_THRESHOLD = 0.85; // Above this: highlight saturation reduction
    
    // Strength multipliers for different zones
    const SHADOW_STRENGTH = 1.4;     // Strong grain in shadows
    const MIDTONE_STRENGTH = 1.8;    // Maximum grain in mid-tones
    const HIGHLIGHT_STRENGTH = 0.4;  // Reduced grain in highlights
    const BLOWN_HIGHLIGHT_STRENGTH = 0.1; // Minimal grain in blown highlights
    
    if (exposure <= SHADOW_THRESHOLD) {
      // Deep shadows: strong grain with slight variation
      const shadowFactor = exposure / SHADOW_THRESHOLD;
      return SHADOW_STRENGTH * (0.8 + shadowFactor * 0.2);
    } else if (exposure <= MIDTONE_START) {
      // Shadow to mid-tone transition: increasing grain strength
      const transitionFactor = (exposure - SHADOW_THRESHOLD) / (MIDTONE_START - SHADOW_THRESHOLD);
      return SHADOW_STRENGTH + (MIDTONE_STRENGTH - SHADOW_STRENGTH) * transitionFactor;
    } else if (exposure <= MIDTONE_PEAK) {
      // Rising mid-tones: approach peak grain visibility
      const midtoneFactor = (exposure - MIDTONE_START) / (MIDTONE_PEAK - MIDTONE_START);
      // Use a slight curve to make the peak more pronounced
      const curvedFactor = Math.sin(midtoneFactor * Math.PI * 0.5);
      return SHADOW_STRENGTH + (MIDTONE_STRENGTH - SHADOW_STRENGTH) * curvedFactor;
    } else if (exposure <= MIDTONE_END) {
      // Peak mid-tones: maximum grain visibility with slight variation
      const peakVariation = Math.sin((exposure - MIDTONE_PEAK) / (MIDTONE_END - MIDTONE_PEAK) * Math.PI);
      return MIDTONE_STRENGTH * (0.95 + peakVariation * 0.05);
    } else if (exposure <= HIGHLIGHT_THRESHOLD) {
      // Mid-tone to highlight transition: decreasing grain strength
      const transitionFactor = (exposure - MIDTONE_END) / (HIGHLIGHT_THRESHOLD - MIDTONE_END);
      // Use exponential decay for more realistic highlight rolloff
      const decayFactor = (1 - transitionFactor) ** 2;
      return MIDTONE_STRENGTH * decayFactor + HIGHLIGHT_STRENGTH * (1 - decayFactor);
    } else {
      // Highlights: strong saturation reduction (grain becomes less visible)
      const highlightFactor = (exposure - HIGHLIGHT_THRESHOLD) / (1.0 - HIGHLIGHT_THRESHOLD);
      // Exponential saturation reduction in highlights
      const saturationReduction = (1 - highlightFactor) ** 3;
      return HIGHLIGHT_STRENGTH * saturationReduction + BLOWN_HIGHLIGHT_STRENGTH * (1 - saturationReduction);
    }
  }

  // Calculate grain density for density-based compositing
  private calculateGrainDensity(grainStrength: number, grain: GrainPoint, layerMultiplier: number = 1.0): number {
    // Convert grain strength to optical density
    const baseDensity = grainStrength * grain.sensitivity * layerMultiplier;
    
    // Normalize density to [0, 1] range for film curve
    // Maximum reasonable density is around 3.0 (very dense grain)
    const normalizedDensity = Math.min(baseDensity / 3.0, 1.0);
    
    // Apply film characteristic curve for density response
    const densityResponse = this.filmCurve(normalizedDensity);
    
    // Scale by grain intensity setting and restore density range
    return densityResponse * this.settings.grainIntensity * 0.8; // Increased multiplier for density model
  }

  // Apply simplified multiplicative compositing
  private applySimpleDensityCompositing(originalColor: [number, number, number], grainDensity: GrainDensity): [number, number, number] {
    const [r, g, b] = originalColor;
    
    // Simplified model: final = original * (1 - density)
    return [
      r * (1 - Math.min(0.8, grainDensity.r)), // Clamp density to prevent full black
      g * (1 - Math.min(0.8, grainDensity.g)),
      b * (1 - Math.min(0.8, grainDensity.b))
    ];
  }

  /**
   * Calculate temperature-dependent color shift based on grain properties
   * Simulates color temperature variations within individual grains
   */
  private calculateTemperatureShift(grain: GrainPoint, normalizedDistance: number): { red: number; green: number; blue: number } {
    // Use grain's shape and sensitivity properties to create per-grain color variation
    const grainVariation = grain.shape * grain.sensitivity * 0.01; // Small variation factor
    
    // Simulate warmer center, cooler edges (typical of film grain)
    const distanceFactor = 1 - normalizedDistance;
    const temperatureIntensity = grainVariation * distanceFactor;
    
    return {
      red: temperatureIntensity * 0.02,    // Warmer tones toward grain center
      green: temperatureIntensity * 0.005, // Slight green adjustment
      blue: -temperatureIntensity * 0.015  // Cooler at edges
    };
  }

  /**
   * Calculate chromatic aberration effect
   * Simulates slight color separation based on distance from grain center
   */
  private calculateChromaticAberration(normalizedDistance: number): { red: number; green: number; blue: number } {
    // Chromatic aberration is strongest at edges
    const aberrationStrength = normalizedDistance * 0.02; // Very subtle effect
    
    return {
      red: 1 + aberrationStrength * 0.5,   // Red slightly displaced outward
      green: 1,                             // Green remains centered (reference)
      blue: 1 - aberrationStrength * 0.3   // Blue slightly displaced inward
    };
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

    postMessage({ type: 'result', imageData: result } as ResultMessage);
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
    
    postMessage({ type: 'error', error: errorMessage });
  }
};

export {};
