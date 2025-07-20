// Grain sampling kernel generation and area sampling utilities
// Provides adaptive sampling patterns for grain exposure calculation and rendering

import { calculateSampleWeight, grayscaleToExposure } from './grain-math';
import { devAssert } from './utils';
import type { RandomNumberGenerator } from './types';
import { DefaultRandomNumberGenerator } from './grain-generator';

// Sampling kernel constants
export const KERNEL_SAMPLE_COUNT_SMALL = 4;   // For grains < 1.5px radius
export const KERNEL_SAMPLE_COUNT_MEDIUM = 8;  // For grains 1.5-4px radius  
export const KERNEL_SAMPLE_COUNT_LARGE = 16;  // For grains > 4px radius
export const KERNEL_CACHE_SIZE_LIMIT = 100;   // Maximum cached kernel patterns

// Sampling kernel interfaces
export interface SamplePoint {
  x: number;
  y: number;
  weight: number;
}

export interface SamplingKernel {
  points: SamplePoint[];
  radius: number;
  sampleCount: number;
}

/**
 * Sampling kernel generator for grain area sampling
 * Provides cached sampling patterns for grain exposure calculation
 */
export class KernelGenerator {
  private kernelCache: Map<string, SamplingKernel> = new Map();
  private rng: RandomNumberGenerator;

  constructor(rng?: RandomNumberGenerator) {
    this.rng = rng || new DefaultRandomNumberGenerator();
  }

  /**
   * Determines appropriate sample count based on grain radius
   * @param grainRadius - Radius of the grain in pixels
   * @returns Number of sample points to generate
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
   * Uses adaptive sampling count and enhanced distribution patterns for circular grains
   * @param grainRadius - Radius of the grain
   * @returns Cached or newly generated sampling kernel
   */
  generateSamplingKernel(grainRadius: number): SamplingKernel {
    devAssert(grainRadius > 0 && Number.isFinite(grainRadius), 'grainRadius must be a positive finite number', { grainRadius });
    
    const grainShape = 0.5; // Always circular
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
        // Single ring for small sample counts with circular grains
        this.generateSingleRingSamples(points, remainingSamples, grainRadius);
      } else {
        // Multi-ring distribution for larger sample counts
        this.generateMultiRingSamples(points, remainingSamples, grainRadius);
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
   * Generates sample points in a single ring for circular grains
   * @param points - Array to add generated points to
   * @param sampleCount - Number of points to generate
   * @param grainRadius - Radius of the grain
   */
  private generateSingleRingSamples(
    points: SamplePoint[], 
    sampleCount: number, 
    grainRadius: number
  ): void {
    const baseRadius = grainRadius * 0.7; // 70% of grain radius for good coverage
    const angleStep = (2 * Math.PI) / sampleCount;
    
    for (let i = 0; i < sampleCount; i++) {
      const baseAngle = i * angleStep;
      
      // Add small jitter for more organic sampling
      const jitterMagnitude = angleStep * 0.1; // 10% of angle step
      const jitterAngle = (this.rng.random() - 0.5) * jitterMagnitude;
      const angle = baseAngle + jitterAngle;
      
      // Circular grains - no shape modulation needed
      const radius = baseRadius;
      
      // Small radial jitter for organic variation
      const radiusJitter = 1.0 + (this.rng.random() - 0.5) * 0.1; // ±5% radius variation
      const finalRadius = radius * radiusJitter;
      
      const x = Math.cos(angle) * finalRadius;
      const y = Math.sin(angle) * finalRadius;
      const distance = Math.sqrt(x * x + y * y);
      
      // Enhanced weighting with shape awareness
      const weight = calculateSampleWeight(distance, grainRadius);
      points.push({ x, y, weight });
    }
  }

  /**
   * Generates sample points in multiple rings for larger sample counts
   * @param points - Array to add generated points to
   * @param totalSamples - Total number of samples to distribute
   * @param grainRadius - Radius of the grain
   */
  private generateMultiRingSamples(
    points: SamplePoint[], 
    totalSamples: number, 
    grainRadius: number
  ): void {
    const innerSamples = Math.floor(totalSamples * 0.4);
    const outerSamples = totalSamples - innerSamples;
    
    // Inner ring at 40% radius
    const innerRadius = grainRadius * 0.4;
    this.generateRingSamples(points, innerSamples, innerRadius, grainRadius, 0);
    
    // Outer ring at 80% radius with offset
    const outerRadius = grainRadius * 0.8;
    const angleOffset = Math.PI / outerSamples; // Offset for better distribution
    this.generateRingSamples(points, outerSamples, outerRadius, grainRadius, angleOffset);
  }

  /**
   * Generates sample points for a specific ring
   * @param points - Array to add generated points to
   * @param sampleCount - Number of points to generate in this ring
   * @param baseRadius - Base radius of the ring
   * @param grainRadius - Overall grain radius for weight calculation
   * @param angleOffset - Angular offset for ring positioning
   */
  private generateRingSamples(
    points: SamplePoint[], 
    sampleCount: number, 
    baseRadius: number, 
    grainRadius: number, 
    angleOffset: number
  ): void {
    const angleStep = (2 * Math.PI) / sampleCount;
    
    for (let i = 0; i < sampleCount; i++) {
      const baseAngle = i * angleStep + angleOffset;
      
      // Add jitter for organic sampling
      const jitterMagnitude = angleStep * 0.08; // 8% of angle step for rings
      const jitterAngle = (this.rng.random() - 0.5) * jitterMagnitude;
      const angle = baseAngle + jitterAngle;
      
      // Circular grains - no shape modulation needed
      const radius = baseRadius;
      
      // Radial jitter
      const radiusJitter = 1.0 + (this.rng.random() - 0.5) * 0.08; // ±4% for rings
      const finalRadius = radius * radiusJitter;
      
      const x = Math.cos(angle) * finalRadius;
      const y = Math.sin(angle) * finalRadius;
      const distance = Math.sqrt(x * x + y * y);
      
      const weight = calculateSampleWeight(distance, grainRadius);
      points.push({ x, y, weight });
    }
  }

  /**
   * Clear the kernel cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.kernelCache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; limit: number } {
    return {
      size: this.kernelCache.size,
      limit: KERNEL_CACHE_SIZE_LIMIT
    };
  }
}

/**
 * Samples exposure values using kernel-based area sampling instead of point sampling
 * Averages exposure across multiple points within the grain area with shape awareness
 * @param imageData - Float32Array containing image data
 * @param grainX - X coordinate of grain center
 * @param grainY - Y coordinate of grain center  
 * @param grainRadius - Radius of the grain
 * @param width - Image width
 * @param height - Image height
 * @param kernelGenerator - Kernel generator instance
 * @returns Average exposure value for the grain area
 */
export function sampleGrainAreaExposure(
  imageData: Float32Array, 
  grainX: number, 
  grainY: number, 
  grainRadius: number,
  width: number,
  height: number,
  kernelGenerator: KernelGenerator
): number {
  // Validate input parameters (dev-only for performance in hot path)
  devAssert(imageData.length > 0, 'imageData must not be empty', { length: imageData.length });
  devAssert(imageData.length % 4 === 0, 'imageData length must be divisible by 4 (RGBA format)', { length: imageData.length });
  devAssert(Number.isFinite(grainX), 'grainX must be a finite number', { grainX });
  devAssert(Number.isFinite(grainY), 'grainY must be a finite number', { grainY });
  devAssert(grainRadius > 0 && Number.isFinite(grainRadius), 'grainRadius must be a positive finite number', { grainRadius });
  devAssert(width > 0 && Number.isFinite(width), 'width must be a positive finite number', { width });
  devAssert(height > 0 && Number.isFinite(height), 'height must be a positive finite number', { height });
  // KernelGenerator type is guaranteed by TypeScript, but we validate it provides expected methods
  devAssert(typeof kernelGenerator.generateSamplingKernel === 'function', 'kernelGenerator must have generateSamplingKernel method', { kernelGenerator });
  
  const kernel = kernelGenerator.generateSamplingKernel(grainRadius);
  
  let totalExposure = 0;
  let totalWeight = 0;
  let validSamples = 0;
  
  for (const samplePoint of kernel.points) {
    // Calculate sample position in image coordinates
    const sampleX = Math.round(grainX + samplePoint.x);
    const sampleY = Math.round(grainY + samplePoint.y);
    
    // Check bounds
    if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
      const pixelIndex = (sampleY * width + sampleX) * 4;
      // For grayscale data, all RGB channels have the same value, so we only need the red channel
      const grayscaleValue = imageData[pixelIndex];
      
      const exposure = grayscaleToExposure(grayscaleValue);
      
      totalExposure += exposure * samplePoint.weight;
      totalWeight += samplePoint.weight;
      validSamples++;
    }
  }
  
  // Fallback to center point if no valid samples (edge case)
  if (validSamples === 0) {
    const centerX = Math.round(grainX);
    const centerY = Math.round(grainY);
    
    if (centerX >= 0 && centerX < width && centerY >= 0 && centerY < height) {
      const pixelIndex = (centerY * width + centerX) * 4;
      // For grayscale data, all RGB channels have the same value, so we only need the red channel
      const grayscaleValue = imageData[pixelIndex];
      return grayscaleToExposure(grayscaleValue);
    }
    
    return 0; // Default exposure for completely out-of-bounds grains
  }
  
  return totalWeight > 0 ? totalExposure / totalWeight : 0;
}
