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
  ResultMessage,
  ErrorMessage
} from './types';
import { 
  assertPositiveInteger, 
  assertObject, 
  assertImageData, 
  assertInRange,
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

// File-level constants shared across methods
const RGB_MAX_VALUE = 255;

// Sampling kernel constants
const KERNEL_SAMPLE_COUNT_SMALL = 4;   // For grains < 1.5px radius
const KERNEL_SAMPLE_COUNT_MEDIUM = 8;  // For grains 1.5-4px radius  
const KERNEL_SAMPLE_COUNT_LARGE = 16;  // For grains > 4px radius
const KERNEL_CACHE_SIZE_LIMIT = 100;   // Maximum cached kernel patterns

// Sampling kernel interfaces
interface SamplePoint {
  x: number;
  y: number;
  weight: number;
}

interface SamplingKernel {
  points: SamplePoint[];
  radius: number;
  sampleCount: number;
}

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
export class GrainProcessor {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private grainGenerator: GrainGenerator;
  private performanceTracker: PerformanceTracker;
  private kernelCache: Map<string, SamplingKernel> = new Map();

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
   * Determines the appropriate sample count based on grain size
   * Uses adaptive sampling: fewer points for small grains, more for large grains
   */
  private determineSampleCount(grainRadius: number): number {
    if (grainRadius < 1.5) {
      return KERNEL_SAMPLE_COUNT_SMALL;  // 4 samples for small grains
    } else if (grainRadius < 4.0) {
      return KERNEL_SAMPLE_COUNT_MEDIUM; // 8 samples for medium grains
    } else {
      return KERNEL_SAMPLE_COUNT_LARGE;  // 16 samples for large grains
    }
  }

  /**
   * Generates a sampling kernel for grain area sampling
   * Uses adaptive sampling count, enhanced distribution patterns, and shape awareness
   */
  private generateSamplingKernel(grainRadius: number, grainShape: number = 0.5): SamplingKernel {
    const sampleCount = this.determineSampleCount(grainRadius);
    
    // Create cache key based on radius and shape (rounded to 0.1 precision for caching efficiency)
    const roundedRadius = Math.round(grainRadius * 10) / 10;
    const roundedShape = Math.round(grainShape * 10) / 10;
    const cacheKey = `${roundedRadius}_${roundedShape}_${sampleCount}`;
    
    // Check cache first
    if (this.kernelCache.has(cacheKey)) {
      return this.kernelCache.get(cacheKey)!;
    }
    
    const points: SamplePoint[] = [];
    
    if (sampleCount === 1) {
      // Single point at center for very small grains
      points.push({ x: 0, y: 0, weight: 1.0 });
    } else {
      // Distribute points using enhanced shape-aware patterns
      // Center point always included
      points.push({ x: 0, y: 0, weight: 1.0 });
      
      const remainingSamples = sampleCount - 1;
      
      if (remainingSamples <= 6) {
        // Single ring for small sample counts with shape-aware jittering
        this.generateSingleRingSamples(points, remainingSamples, grainRadius, grainShape);
      } else {
        // Multi-ring distribution for larger sample counts
        this.generateMultiRingSamples(points, remainingSamples, grainRadius, grainShape);
      }
    }
    
    const kernel: SamplingKernel = {
      points,
      radius: grainRadius,
      sampleCount
    };
    
    // Cache the kernel (with size limit)
    if (this.kernelCache.size < KERNEL_CACHE_SIZE_LIMIT) {
      this.kernelCache.set(cacheKey, kernel);
    }
    
    return kernel;
  }

  /**
   * Generates sample points in a single ring with shape-aware distribution
   */
  private generateSingleRingSamples(
    points: SamplePoint[], 
    sampleCount: number, 
    grainRadius: number, 
    grainShape: number
  ): void {
    const baseRadius = grainRadius * 0.7; // 70% of grain radius for good coverage
    const angleStep = (2 * Math.PI) / sampleCount;
    
    for (let i = 0; i < sampleCount; i++) {
      const baseAngle = i * angleStep;
      
      // Add small jitter for more organic sampling
      const jitterMagnitude = angleStep * 0.1; // 10% of angle step
      const jitterAngle = (Math.random() - 0.5) * jitterMagnitude;
      const angle = baseAngle + jitterAngle;
      
      // Shape-aware radius modulation (elliptical distortion)
      const shapeModulation = 1.0 + (grainShape - 0.5) * 0.3 * Math.cos(2 * angle);
      const radius = baseRadius * shapeModulation;
      
      // Small radial jitter for organic variation
      const radiusJitter = 1.0 + (Math.random() - 0.5) * 0.1; // ±5% radius variation
      const finalRadius = radius * radiusJitter;
      
      const x = Math.cos(angle) * finalRadius;
      const y = Math.sin(angle) * finalRadius;
      const distance = Math.sqrt(x * x + y * y);
      
      // Enhanced weighting with shape awareness
      const weight = GrainProcessor.calculateSampleWeight(distance, grainRadius, grainShape);
      points.push({ x, y, weight });
    }
  }

  /**
   * Generates sample points in multiple rings for larger sample counts
   */
  private generateMultiRingSamples(
    points: SamplePoint[], 
    totalSamples: number, 
    grainRadius: number, 
    grainShape: number
  ): void {
    const innerSamples = Math.floor(totalSamples * 0.4);
    const outerSamples = totalSamples - innerSamples;
    
    // Inner ring at 40% radius
    const innerRadius = grainRadius * 0.4;
    this.generateRingSamples(points, innerSamples, innerRadius, grainRadius, grainShape, 0);
    
    // Outer ring at 80% radius with offset
    const outerRadius = grainRadius * 0.8;
    const angleOffset = Math.PI / outerSamples; // Offset for better distribution
    this.generateRingSamples(points, outerSamples, outerRadius, grainRadius, grainShape, angleOffset);
  }

  /**
   * Generates sample points for a specific ring
   */
  private generateRingSamples(
    points: SamplePoint[], 
    sampleCount: number, 
    baseRadius: number, 
    grainRadius: number, 
    grainShape: number,
    angleOffset: number
  ): void {
    const angleStep = (2 * Math.PI) / sampleCount;
    
    for (let i = 0; i < sampleCount; i++) {
      const baseAngle = i * angleStep + angleOffset;
      
      // Add jitter for organic sampling
      const jitterMagnitude = angleStep * 0.08; // 8% of angle step for rings
      const jitterAngle = (Math.random() - 0.5) * jitterMagnitude;
      const angle = baseAngle + jitterAngle;
      
      // Shape-aware radius modulation
      const shapeModulation = 1.0 + (grainShape - 0.5) * 0.2 * Math.cos(2 * angle);
      const radius = baseRadius * shapeModulation;
      
      // Radial jitter
      const radiusJitter = 1.0 + (Math.random() - 0.5) * 0.08; // ±4% for rings
      const finalRadius = radius * radiusJitter;
      
      const x = Math.cos(angle) * finalRadius;
      const y = Math.sin(angle) * finalRadius;
      const distance = Math.sqrt(x * x + y * y);
      
      const weight = GrainProcessor.calculateSampleWeight(distance, grainRadius, grainShape);
      points.push({ x, y, weight });
    }
  }

  /**
   * Calculates sample weight using enhanced weighting profiles
   */
  private static calculateSampleWeight(distance: number, grainRadius: number, grainShape: number): number {
    // Base Gaussian weighting
    const gaussianSigma = grainRadius * 0.7; // Adjust spread based on grain radius
    const gaussianWeight = Math.exp(-(distance * distance) / (2 * gaussianSigma * gaussianSigma));
    
    // Shape-aware weight modification
    // More angular grains (higher shape values) have sharper falloff
    const shapeInfluence = 0.5 + grainShape * 0.5; // Range: 0.5 to 1.0
    const shapedWeight = Math.pow(gaussianWeight, shapeInfluence);
    
    // Ensure minimum weight for edge samples
    const minWeight = 0.05;
    return Math.max(shapedWeight, minWeight);
  }

  /**
   * Samples exposure values using kernel-based area sampling instead of point sampling
   * Averages exposure across multiple points within the grain area with shape awareness
   */
  private sampleGrainAreaExposure(
    imageData: Float32Array, 
    grainX: number, 
    grainY: number, 
    grainRadius: number,
    grainShape: number = 0.5
  ): number {
    const kernel = this.generateSamplingKernel(grainRadius, grainShape);
    
    let totalExposure = 0;
    let totalWeight = 0;
    let validSamples = 0;
    
    for (const samplePoint of kernel.points) {
      // Calculate sample position in image coordinates
      const sampleX = Math.round(grainX + samplePoint.x);
      const sampleY = Math.round(grainY + samplePoint.y);
      
      // Check bounds
      if (sampleX >= 0 && sampleX < this.width && sampleY >= 0 && sampleY < this.height) {
        const pixelIndex = (sampleY * this.width + sampleX) * 4;
        const r = imageData[pixelIndex];
        const g = imageData[pixelIndex + 1];
        const b = imageData[pixelIndex + 2];
        
        const exposure = this.rgbToExposureFloat(r, g, b);
        
        totalExposure += exposure * samplePoint.weight;
        totalWeight += samplePoint.weight;
        validSamples++;
      }
    }
    
    // Fallback to center point if no valid samples (edge case)
    if (validSamples === 0) {
      const centerX = Math.round(grainX);
      const centerY = Math.round(grainY);
      
      if (centerX >= 0 && centerX < this.width && centerY >= 0 && centerY < this.height) {
        const pixelIndex = (centerY * this.width + centerX) * 4;
        const r = imageData[pixelIndex];
        const g = imageData[pixelIndex + 1];
        const b = imageData[pixelIndex + 2];
        return this.rgbToExposureFloat(r, g, b);
      }
      
      return 0; // Default exposure for completely out-of-bounds grains
    }
    
    return totalWeight > 0 ? totalExposure / totalWeight : 0;
  }

  /**
   * Calculates average exposure for all grains using kernel-based sampling
   * This replaces point sampling with area-based exposure calculation
   * Returns a Map for better functional design and testability
   */
  private calculateGrainExposures(grains: GrainPoint[], imageData: Float32Array): Map<GrainPoint, number> {
    console.log(`Calculating kernel-based exposures for ${grains.length} grains...`);
    
    const exposureMap = new Map<GrainPoint, number>();
    
    for (const grain of grains) {
      const averageExposure = this.sampleGrainAreaExposure(imageData, grain.x, grain.y, grain.size, grain.shape);
      exposureMap.set(grain, averageExposure);
    }
    
    console.log(`Completed kernel-based exposure calculation for ${exposureMap.size} grains`);
    return exposureMap;
  }

  /**
   * Pre-calculate intrinsic grain densities for all grains (Phase 1 optimization)
   * This computes grain-specific properties that don't depend on pixel position
   * and caches them for efficient pixel processing
   */
  private calculateIntrinsicGrainDensities(grains: GrainPoint[], grainExposureMap: Map<GrainPoint, number>): Map<GrainPoint, number> {
    console.log(`Pre-calculating intrinsic densities for ${grains.length} grains...`);
    
    const intrinsicDensityMap = new Map<GrainPoint, number>();
    
    for (const grain of grains) {
      const grainExposure = grainExposureMap.get(grain);
      assert(
        grainExposure !== undefined,
        'Grain exposure not found in calculated map during intrinsic density calculation',
        { 
          grain: { x: grain.x, y: grain.y, size: grain.size },
          mapSize: grainExposureMap.size,
          grainsLength: grains.length
        }
      );
      
      const intrinsicDensity = this.calculateIntrinsicGrainDensity(grainExposure, grain);
      intrinsicDensityMap.set(grain, intrinsicDensity);
    }
    
    console.log(`Completed intrinsic density calculation for ${intrinsicDensityMap.size} grains`);
    return intrinsicDensityMap;
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
    
    const a = GrainGenerator.seededRandom(X + Y * 256);
    const b = GrainGenerator.seededRandom(X + 1 + Y * 256);
    const c = GrainGenerator.seededRandom(X + (Y + 1) * 256);
    const d = GrainGenerator.seededRandom(X + 1 + (Y + 1) * 256);
    
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
  protected rgbToExposure(r: number, g: number, b: number): number {
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

  /**
   * Convert floating-point RGB to photographic exposure
   * Same logic as rgbToExposure but operates on floating-point values (0.0-1.0)
   */
  protected rgbToExposureFloat(r: number, g: number, b: number): number {
    // Validate inputs and clamp to valid range
    r = Math.max(0, Math.min(1, r || 0));
    g = Math.max(0, Math.min(1, g || 0));
    b = Math.max(0, Math.min(1, b || 0));
    
    // Calculate weighted luminance using photographic weights
    const luminance = 
      r * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.red +
      g * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.green +
      b * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.blue;

    // Add small offset to prevent log(0) in pure black areas
    const safeLuminance = luminance + EXPOSURE_CONVERSION.LUMINANCE_OFFSET;

    // Convert to logarithmic exposure scale
    const logExposure = Math.log(safeLuminance / EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE) / 
                       Math.log(EXPOSURE_CONVERSION.LOG_BASE);
    
    // Scale and normalize exposure to [0, 1] range
    const normalizedExposure = (logExposure + EXPOSURE_CONVERSION.EXPOSURE_SCALE) / 
                              (2 * EXPOSURE_CONVERSION.EXPOSURE_SCALE);

    // Clamp to [0, 1] range and validate result
    const result = Math.max(0, Math.min(1, normalizedExposure));
    return Number.isFinite(result) ? result : 0;
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

    // Convert input to floating-point for precision preservation
    const floatData = GrainProcessor.convertToFloatingPoint(imageData.data);
    
    // Create floating-point result buffer
    const resultFloatData = new Float32Array(floatData.length);
    // Copy original data as starting point
    resultFloatData.set(floatData);
    
    const totalImagePixels = this.width * this.height;
    
    // Start overall benchmark
    this.performanceTracker.startBenchmark('Total Processing', totalImagePixels);
    
    // Step 1: Generate grain structure
    safePostMessage({ type: 'progress', progress: 10, stage: 'Generating grain structure...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Grain Generation');
    const grainStructure = this.generateGrainStructure();
    this.performanceTracker.endBenchmark('Grain Generation');
    
    // Step 2: Create spatial acceleration grid
    safePostMessage({ type: 'progress', progress: 20, stage: 'Creating spatial grid...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Spatial Grid Creation');
    const grainGrid = this.createGrainGrid(grainStructure);
    this.performanceTracker.endBenchmark('Spatial Grid Creation');
    
    // Step 3: Calculate grain exposures using kernel-based sampling
    safePostMessage({ type: 'progress', progress: 25, stage: 'Calculating kernel-based grain exposures...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Kernel Exposure Calculation');
    const grainExposureMap = this.calculateGrainExposures(grainStructure, floatData);
    this.performanceTracker.endBenchmark('Kernel Exposure Calculation');
    
    // Step 3.5: Pre-calculate intrinsic grain densities (Phase 1)
    safePostMessage({ type: 'progress', progress: 27, stage: 'Pre-calculating intrinsic grain densities...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Intrinsic Density Calculation');
    const grainIntrinsicDensityMap = this.calculateIntrinsicGrainDensities(grainStructure, grainExposureMap);
    this.performanceTracker.endBenchmark('Intrinsic Density Calculation');
    
    // Determine grid size for spatial lookup
    let maxGrainSize = 1;
    if (Array.isArray(grainStructure) && grainStructure.length > 0) {
      // Single layer with varying grain sizes
      const grains = grainStructure as GrainPoint[];
      maxGrainSize = Math.max(...grains.map(g => g.size));
    }
    const gridSize = Math.max(8, Math.floor(maxGrainSize * 2));
    
    // Step 4: Process each pixel
    safePostMessage({ type: 'progress', progress: 30, stage: 'Processing pixels...' } as ProgressMessage);
    this.performanceTracker.startBenchmark('Pixel Processing', totalImagePixels);
    
    let grainEffectCount = 0;
    let processedPixels = 0;
    
    // Start performance benchmark for pixel processing
    this.performanceTracker.startBenchmark('Pixel Processing', this.width * this.height);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIndex = (y * this.width + x) * 4;
        processedPixels++;
        
        const a = resultFloatData[pixelIndex + 3];
        
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
            const pixelGrainEffect = this.calculatePixelGrainEffect(intrinsicDensity, grain, x, y);
            const grainDensity = this.calculateGrainDensity(pixelGrainEffect, grain);
            
            // Apply film-specific channel characteristics with enhanced color effects
            const filmCharacteristics = FILM_CHARACTERISTICS[this.settings.filmType];
            const channelSensitivity = filmCharacteristics.channelSensitivity;
            const baseColorShift = filmCharacteristics.colorShift;
            
            // Calculate position-dependent color temperature shift
            const normalizedDistance = distance / grain.size;
            const temperatureShift = this.calculateTemperatureShift(grain, normalizedDistance);
            
            // Calculate chromatic aberration based on distance from grain center
            const chromaticAberration = GrainProcessor.calculateChromaticAberration(normalizedDistance);
            
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
          
          // Use Beer-Lambert law compositing for physically accurate results (floating-point)
          finalColor = GrainProcessor.applyBeerLambertCompositingFloat(totalGrainDensity);
          
          resultFloatData[pixelIndex] = finalColor[0];
          resultFloatData[pixelIndex + 1] = finalColor[1];
          resultFloatData[pixelIndex + 2] = finalColor[2];
          resultFloatData[pixelIndex + 3] = a;
        }
      }
      
      // Update progress periodically
      if (y % Math.floor(this.height / 10) === 0) {
        const progress = 30 + (y / this.height) * 60;
        safePostMessage({ 
          type: 'progress', 
          progress, 
          stage: `Processing pixels... ${Math.floor(progress)}%` 
        } as ProgressMessage);
      }
    }
    
    // End pixel processing benchmark
    this.performanceTracker.endBenchmark('Pixel Processing');
    
    // Calculate brightness correction factor to preserve overall image brightness
    const brightnessFactor = GrainProcessor.calculateBrightnessFactor(floatData, resultFloatData);
    console.log(`Brightness correction factor: ${brightnessFactor.toFixed(4)}`);
    
    // Convert back to Uint8ClampedArray with brightness correction
    const finalData = GrainProcessor.convertToUint8(resultFloatData, brightnessFactor);
    
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
      safePostMessage({ type: 'progress', progress: 95, stage: 'Drawing debug grain centers...' } as ProgressMessage);
      console.log('Debug mode: Drawing grain center points');
      this.drawGrainCenters(result, grainStructure);
    }
    
    safePostMessage({ type: 'progress', progress: 100, stage: 'Complete!' } as ProgressMessage);
    return result;
  }

  /**
   * Convert Uint8ClampedArray to floating-point values (0.0-1.0 range)
   * for precision preservation during processing
   */
  private static convertToFloatingPoint(uint8Data: Uint8ClampedArray): Float32Array {
    const floatData = new Float32Array(uint8Data.length);
    for (let i = 0; i < uint8Data.length; i++) {
      floatData[i] = uint8Data[i] / 255.0;
    }
    return floatData;
  }

  /**
   * Convert floating-point values back to Uint8ClampedArray
   * with optional brightness correction to preserve overall image brightness
   */
  private static convertToUint8(floatData: Float32Array, brightnessFactor: number = 1.0): Uint8ClampedArray {
    const uint8Data = new Uint8ClampedArray(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
      // Apply brightness correction and clamp to valid range
      const correctedValue = floatData[i] * brightnessFactor;
      uint8Data[i] = Math.round(Math.max(0, Math.min(255, correctedValue * 255)));
    }
    return uint8Data;
  }

  /**
   * Calculate average brightness ratio between original and processed image
   * for brightness preservation
   */
  private static calculateBrightnessFactor(originalData: Float32Array, processedData: Float32Array): number {
    let originalSum = 0;
    let processedSum = 0;

    // Calculate average brightness for RGB channels only (skip alpha)
    for (let i = 0; i < originalData.length; i += 4) {
      const originalBrightness = (originalData[i] + originalData[i + 1] + originalData[i + 2]) / 3;
      const processedBrightness = (processedData[i] + processedData[i + 1] + processedData[i + 2]) / 3;
      
      originalSum += originalBrightness;
      processedSum += processedBrightness;
    }

    if (processedSum === 0) return 1.0;
    return originalSum / processedSum;
  }

  // Calculate intrinsic grain density based on exposure and grain properties (Phase 1)
  // This method computes grain-specific properties that don't depend on pixel position
  private calculateIntrinsicGrainDensity(exposure: number, grain: GrainPoint): number {
    // Validate exposure input
    if (!Number.isFinite(exposure)) {
      console.warn(`Invalid exposure value: ${exposure}, defaulting to 0`);
      exposure = 0;
    }
    
    // Implementation of development threshold system as designed
    // Formula: grain_activation = (local_exposure + random_sensitivity) > development_threshold
    
    // Calculate random sensitivity variation for this grain
    // Use grain-based randomness for consistent grain behavior (position-independent)
    const randomSeed = (grain.x * 12345 + grain.y * 67890) % 1000000;
    const randomSensitivity = (randomSeed / 1000000) * 0.3 - 0.15; // Range: [-0.15, +0.15]
    
    // Calculate activation strength
    const activationStrength = exposure + randomSensitivity;
    
    // Check if grain is activated (above development threshold)
    if (activationStrength <= grain.developmentThreshold) {
      return 0; // Grain not developed - no visible effect
    }
    
    // Calculate how much above threshold the grain is
    const thresholdExcess = activationStrength - grain.developmentThreshold;
    
    // Apply sigmoid function for smooth grain density response
    // sigmoid_function(activation_strength - threshold)
    const sigmoidSteepness = 8.0; // Controls how sharp the activation transition is
    const normalizedExcess = thresholdExcess * sigmoidSteepness;
    const sigmoidResponse = 1.0 / (1.0 + Math.exp(-normalizedExcess));
    
    // Base grain density from sigmoid response
    let grainDensity = sigmoidResponse;
    
    // Apply grain sensitivity for individual grain variation
    grainDensity *= grain.sensitivity;
    
    // Apply grain shape variation (intrinsic property)
    const shapeModifier = 0.8 + grain.shape * 0.4;
    grainDensity *= shapeModifier;
    
    // Ensure grainDensity is within [0,1] range before applying film curve
    grainDensity = Math.max(0, Math.min(1, grainDensity));
    
    // Additional validation to prevent NaN
    if (!Number.isFinite(grainDensity)) {
      console.warn(`Invalid grainDensity: ${grainDensity}, defaulting to 0`);
      grainDensity = 0;
    }
    
    // Apply film characteristic curve for density response
    const filmResponse = this.filmCurve(grainDensity);
    
    return filmResponse * 1.2; // Slight multiplier for visibility
  }

  // Calculate pixel-level grain effects (Phase 2)
  // This method computes position-dependent visual effects that vary by pixel location
  private calculatePixelGrainEffect(intrinsicDensity: number, grain: GrainPoint, pixelX: number, pixelY: number): number {
    // If grain not activated, return 0
    if (intrinsicDensity === 0) {
      return 0;
    }
    
    // Calculate offset from grain center
    const offsetX = pixelX - grain.x;
    const offsetY = pixelY - grain.y;
    
    // Calculate distance from grain center
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    
    // Add distance falloff calculation based on grain position and radius
    const falloffRadius = grain.size * 2; // Grain influence extends to 2x grain size
    if (distance >= falloffRadius) {
      return 0; // No effect beyond falloff radius
    }
    
    // Apply distance-based falloff (exponential decay)
    const falloffFactor = Math.exp(-distance / grain.size);
    
    // Add grain shape effects (elliptical distortion) based on pixel offset from grain center
    const angle = Math.atan2(offsetY, offsetX);
    const ellipticalDistortion = this.calculateEllipticalDistortion(grain, angle, distance);
    
    // Add pixel-level noise texture using x,y coordinates
    const NOISE_SCALE_FINE = 0.15;
    const NOISE_SCALE_MEDIUM = 0.08;
    const NOISE_SCALE_COARSE = 0.03;
    const NOISE_WEIGHT_FINE = 0.3;
    const NOISE_WEIGHT_MEDIUM = 0.2;
    const NOISE_WEIGHT_COARSE = 0.1;
    
    const noiseValue = this.noise(pixelX * NOISE_SCALE_FINE, pixelY * NOISE_SCALE_FINE) * NOISE_WEIGHT_FINE + 
                      this.noise(pixelX * NOISE_SCALE_MEDIUM, pixelY * NOISE_SCALE_MEDIUM) * NOISE_WEIGHT_MEDIUM + 
                      this.noise(pixelX * NOISE_SCALE_COARSE, pixelY * NOISE_SCALE_COARSE) * NOISE_WEIGHT_COARSE;
    
    // Combine all effects: intrinsic density × distance falloff × shape distortion × noise modulation
    const noiseModulation = 0.7 + Math.abs(noiseValue) * 0.3;
    const pixelEffect = intrinsicDensity * falloffFactor * ellipticalDistortion * noiseModulation;
    
    return pixelEffect;
  }

  // Calculate elliptical distortion for grain shape effects
  private calculateEllipticalDistortion(grain: GrainPoint, angle: number, distance: number): number {
    // Use grain.shape to control elliptical distortion
    // shape = 0.5 is circular, < 0.5 is horizontally elongated, > 0.5 is vertically elongated
    const shapeAngle = grain.shape * Math.PI; // Convert shape to angle for orientation
    
    // Calculate ellipse parameters
    const majorAxis = 1.0 + (Math.abs(grain.shape - 0.5) * 0.6); // Up to 30% elongation
    const minorAxis = 1.0 / majorAxis; // Maintain area
    
    // Rotate coordinate system based on grain orientation
    const rotatedAngle = angle - shapeAngle;
    const cosAngle = Math.cos(rotatedAngle);
    const sinAngle = Math.sin(rotatedAngle);
    
    // Transform to elliptical coordinates using distance
    const ellipticalX = distance * cosAngle / majorAxis;
    const ellipticalY = distance * sinAngle / minorAxis;
    const ellipticalDistance = Math.sqrt(ellipticalX * ellipticalX + ellipticalY * ellipticalY);
    
    // Apply shape-based modulation
    // Stronger effect along the major axis, weaker along minor axis
    const normalizedEllipticalDistance = ellipticalDistance / grain.size;
    const shapeModulation = 0.8 + 0.4 * Math.exp(-normalizedEllipticalDistance);
    
    return shapeModulation;
  }

  // Calculate grain density for density-based compositing
  private calculateGrainDensity(grainStrength: number, grain: GrainPoint): number {
    // Convert grain strength to optical density
    const baseDensity = grainStrength * grain.sensitivity;
    
    // Normalize density to [0, 1] range for film curve
    // Maximum reasonable density is around 3.0 (very dense grain)
    const normalizedDensity = Math.min(baseDensity / 3.0, 1.0);
    
    // Apply film characteristic curve for density response
    const densityResponse = this.filmCurve(normalizedDensity);
    
    // Scale by grain intensity setting and restore density range
    return densityResponse * this.settings.grainIntensity * 0.8; // Increased multiplier for density model
  }

  // Apply Beer-Lambert law compositing for physically accurate results (floating-point version)
  protected static applyBeerLambertCompositingFloat(grainDensity: GrainDensity): [number, number, number] {
    // PHYSICAL CORRECTION: The input image was used to determine grain exposure during "photography".
    // When "viewing" the film, WHITE printing light passes through the developed grains.
    // Beer-Lambert law: final = white_light * exp(-density)
    // This is correct physics - the original color should NOT be used here.
    const WHITE_LIGHT = 1.0; // Floating-point white light (normalized)
    
    return [
      WHITE_LIGHT * Math.exp(-grainDensity.r),
      WHITE_LIGHT * Math.exp(-grainDensity.g),
      WHITE_LIGHT * Math.exp(-grainDensity.b)
    ];
  }

  // Apply Beer-Lambert law compositing for physically accurate results
  protected static applyBeerLambertCompositing(grainDensity: GrainDensity): [number, number, number] {
    // PHYSICAL CORRECTION: The input image was used to determine grain exposure during "photography".
    // When "viewing" the film, WHITE printing light passes through the developed grains.
    // Beer-Lambert law: final = white_light * exp(-density)
    // This is correct physics - the original color should NOT be used here.
    const WHITE_LIGHT = 255;
    
    return [
      WHITE_LIGHT * Math.exp(-grainDensity.r),
      WHITE_LIGHT * Math.exp(-grainDensity.g),
      WHITE_LIGHT * Math.exp(-grainDensity.b)
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
  private static calculateChromaticAberration(normalizedDistance: number): { red: number; green: number; blue: number } {
    // Chromatic aberration is strongest at edges
    const aberrationStrength = normalizedDistance * 0.02; // Very subtle effect
    
    return {
      red: 1 + aberrationStrength * 0.5,   // Red slightly displaced outward
      green: 1,                             // Green remains centered (reference)
      blue: 1 - aberrationStrength * 0.3   // Blue slightly displaced inward
    };
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
