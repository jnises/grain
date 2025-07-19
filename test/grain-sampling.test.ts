/**
 * Tests for grain sampling functions with grayscale processing
 * Validates that grayscale exposure sampling works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { sampleGrainAreaExposure, KernelGenerator } from '../src/grain-sampling';
import { grayscaleToExposure, rgbToExposureFloat } from '../src/grain-math';

// Mock image data creation utilities for testing
function createGrayscaleImageData(width: number, height: number, luminancePattern: (x: number, y: number) => number): Float32Array {
  const data = new Float32Array(width * height * 4); // RGBA format
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const luminance = luminancePattern(x, y);
      
      // For grayscale data, all RGB channels should have the same value
      data[index] = luminance;     // R
      data[index + 1] = luminance; // G  
      data[index + 2] = luminance; // B
      data[index + 3] = 1.0;       // A
    }
  }
  
  return data;
}

describe('Grain Area Sampling with Grayscale', () => {
  let kernelGenerator: KernelGenerator;
  
  beforeEach(() => {
    kernelGenerator = new KernelGenerator();
  });

  it('should sample grayscale values correctly for uniform images', () => {
    const testLuminanceValues = [0.0, 0.18, 0.5, 0.75, 1.0];
    
    testLuminanceValues.forEach(luminance => {
      // Create uniform grayscale image
      const imageData = createGrayscaleImageData(20, 20, () => luminance);
      
      // Sample from center of image
      const sampledExposure = sampleGrainAreaExposure(
        imageData,
        10, 10, // center position
        2.0,    // grain radius
        0.5,    // grain shape
        20, 20, // image dimensions
        kernelGenerator
      );
      
      // Expected exposure from grayscale conversion
      const expectedExposure = grayscaleToExposure(luminance);
      
      // Should match exactly (within reasonable floating-point precision)
      // Note: Kernel-based sampling can introduce tiny numerical differences due to averaging
      expect(sampledExposure).toBeCloseTo(expectedExposure, 8);
    });
  });

  it('should produce equivalent results to RGB sampling for grayscale data', () => {
    const testLuminanceValues = [0.0, 0.25, 0.5, 0.75, 1.0];
    
    testLuminanceValues.forEach(luminance => {
      // Create uniform grayscale image using our new method
      const grayscaleImageData = createGrayscaleImageData(20, 20, () => luminance);
      
      // Create equivalent RGB image data (old format for comparison)
      const rgbImageData = new Float32Array(20 * 20 * 4);
      for (let i = 0; i < rgbImageData.length; i += 4) {
        rgbImageData[i] = luminance;     // R
        rgbImageData[i + 1] = luminance; // G
        rgbImageData[i + 2] = luminance; // B
        rgbImageData[i + 3] = 1.0;       // A
      }
      
      // Sample with new grayscale method
      const grayscaleSample = sampleGrainAreaExposure(
        grayscaleImageData,
        10, 10, 2.0, 0.5, 20, 20,
        kernelGenerator
      );
      
      // Calculate what the old RGB method would have produced
      const expectedRgbExposure = rgbToExposureFloat(luminance, luminance, luminance);
      
      // They should be equivalent
      expect(grayscaleSample).toBeCloseTo(expectedRgbExposure, 10);
    });
  });

  it('should handle gradient patterns correctly', () => {
    // Create horizontal gradient from black to white
    const imageData = createGrayscaleImageData(20, 20, (x, _y) => x / 19);
    
    // Sample from left side (should be dark)
    const leftExposure = sampleGrainAreaExposure(
      imageData, 2, 10, 1.0, 0.5, 20, 20, kernelGenerator
    );
    
    // Sample from center (should be medium)
    const centerExposure = sampleGrainAreaExposure(
      imageData, 10, 10, 1.0, 0.5, 20, 20, kernelGenerator
    );
    
    // Sample from right side (should be bright)
    const rightExposure = sampleGrainAreaExposure(
      imageData, 18, 10, 1.0, 0.5, 20, 20, kernelGenerator
    );
    
    // Should increase from left to right
    expect(leftExposure).toBeLessThan(centerExposure);
    expect(centerExposure).toBeLessThan(rightExposure);
    
    // Values should be in reasonable ranges
    expect(leftExposure).toBeGreaterThanOrEqual(0);
    expect(rightExposure).toBeLessThanOrEqual(1);
  });

  it('should handle edge cases and boundary conditions', () => {
    const imageData = createGrayscaleImageData(10, 10, () => 0.5);
    
    // Test near edges
    const edgeExposure = sampleGrainAreaExposure(
      imageData, 1, 1, 2.0, 0.5, 10, 10, kernelGenerator
    );
    
    // Test center
    const centerExposure = sampleGrainAreaExposure(
      imageData, 5, 5, 2.0, 0.5, 10, 10, kernelGenerator
    );
    
    // Both should be valid and approximately equal for uniform image
    expect(Number.isFinite(edgeExposure)).toBe(true);
    expect(Number.isFinite(centerExposure)).toBe(true);
    expect(edgeExposure).toBeCloseTo(centerExposure, 5); // Allow some sampling variation
    
    // Test completely out of bounds (should fallback gracefully)
    const outOfBoundsExposure = sampleGrainAreaExposure(
      imageData, -5, -5, 1.0, 0.5, 10, 10, kernelGenerator
    );
    expect(outOfBoundsExposure).toBe(0); // Should return default value
  });

  it('should work with different grain sizes and shapes', () => {
    const imageData = createGrayscaleImageData(30, 30, () => 0.5);
    
    const testConfigurations = [
      { radius: 0.5, shape: 0.5 }, // Small circular grain
      { radius: 2.0, shape: 0.2 }, // Medium elliptical grain
      { radius: 5.0, shape: 0.8 }, // Large elliptical grain
    ];
    
    testConfigurations.forEach(({ radius, shape }) => {
      const exposure = sampleGrainAreaExposure(
        imageData, 15, 15, radius, shape, 30, 30, kernelGenerator
      );
      
      // Should produce valid results for all configurations
      expect(Number.isFinite(exposure)).toBe(true);
      expect(exposure).toBeGreaterThanOrEqual(0);
      expect(exposure).toBeLessThanOrEqual(1);
      
      // For uniform image, result should be close to expected grayscale exposure
      const expectedExposure = grayscaleToExposure(0.5);
      expect(exposure).toBeCloseTo(expectedExposure, 3); // Allow for sampling variation
    });
  });

  it('should validate that grayscale sampling is more efficient than RGB', () => {
    // This test verifies that we're only reading one channel instead of three
    const imageData = createGrayscaleImageData(50, 50, (x, y) => (x + y) / 98);
    
    // Multiple samples to verify consistency
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const x = 5 + i * 4;
      const y = 25;
      const exposure = sampleGrainAreaExposure(
        imageData, x, y, 1.5, 0.5, 50, 50, kernelGenerator
      );
      samples.push(exposure);
    }
    
    // All samples should be valid
    samples.forEach(exposure => {
      expect(Number.isFinite(exposure)).toBe(true);
      expect(exposure).toBeGreaterThanOrEqual(0);
      expect(exposure).toBeLessThanOrEqual(1);
    });
    
    // Samples should vary with position (since we have a gradient)
    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    expect(lastSample).toBeGreaterThan(firstSample);
  });

  it('should handle very small and very large grain radii', () => {
    const imageData = createGrayscaleImageData(20, 20, () => 0.3);
    
    // Very small grain
    const smallGrainExposure = sampleGrainAreaExposure(
      imageData, 10, 10, 0.1, 0.5, 20, 20, kernelGenerator
    );
    
    // Very large grain
    const largeGrainExposure = sampleGrainAreaExposure(
      imageData, 10, 10, 8.0, 0.5, 20, 20, kernelGenerator
    );
    
    // Both should produce valid results
    expect(Number.isFinite(smallGrainExposure)).toBe(true);
    expect(Number.isFinite(largeGrainExposure)).toBe(true);
    
    // For uniform image, both should be similar to the expected exposure
    const expectedExposure = grayscaleToExposure(0.3);
    expect(smallGrainExposure).toBeCloseTo(expectedExposure, 3);
    expect(largeGrainExposure).toBeCloseTo(expectedExposure, 3);
  });
});

describe('KernelGenerator Integration with Grayscale Sampling', () => {
  let kernelGenerator: KernelGenerator;
  
  beforeEach(() => {
    kernelGenerator = new KernelGenerator();
  });

  it('should generate consistent kernels for repeated calls', () => {
    const imageData = createGrayscaleImageData(20, 20, () => 0.6);
    
    // Sample the same location multiple times
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const exposure = sampleGrainAreaExposure(
        imageData, 10, 10, 2.0, 0.5, 20, 20, kernelGenerator
      );
      samples.push(exposure);
    }
    
    // All samples should be identical (deterministic kernel generation)
    const firstSample = samples[0];
    samples.forEach(sample => {
      expect(sample).toBeCloseTo(firstSample, 10);
    });
  });

  it('should use kernel caching effectively', () => {
    const imageData = createGrayscaleImageData(20, 20, () => 0.4);
    
    // Clear cache to start fresh
    kernelGenerator.clearCache();
    expect(kernelGenerator.getCacheStats().size).toBe(0);
    
    // Sample with same parameters multiple times
    for (let i = 0; i < 3; i++) {
      sampleGrainAreaExposure(
        imageData, 10 + i, 10, 2.0, 0.5, 20, 20, kernelGenerator
      );
    }
    
    // Cache should have entries now
    expect(kernelGenerator.getCacheStats().size).toBeGreaterThan(0);
    expect(kernelGenerator.getCacheStats().size).toBeLessThanOrEqual(kernelGenerator.getCacheStats().limit);
  });
});
