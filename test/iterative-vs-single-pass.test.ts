import { describe, it, expect } from 'vitest';
import { srgbToLinear } from '../src/color-space';
import type { GrainSettings } from '../src/types';
import { createTestGrainProcessor, createMockImageData } from './test-utils';

describe('Iterative vs Single-Pass Approach Quality', () => {
  const BASE_SETTINGS: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
  };

  /**
   * Calculate average lightness in linear space for accurate comparison
   */
  function calculateAverageLightness(imageData: { data: Uint8ClampedArray; width: number; height: number }): number {
    let totalLightness = 0;
    const pixelCount = imageData.width * imageData.height;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Since the image is grayscale (R=G=B), we only need to read one channel
      const grayValue = imageData.data[i] / 255.0;
      
      // Convert from sRGB to linear space for consistent lightness calculation
      const linearLightness = srgbToLinear(grayValue);
      
      totalLightness += linearLightness;
    }
    
    return totalLightness / pixelCount;
  }

  /**
   * Calculate lightness preservation error
   */
  function calculateLightnessError(inputImage: ImageData, outputImage: ImageData): number {
    const inputLightness = calculateAverageLightness(inputImage);
    const outputLightness = calculateAverageLightness(outputImage);
    
    // Return relative error as percentage
    return Math.abs(outputLightness - inputLightness) / inputLightness;
  }

  it('should demonstrate improved lightness preservation with iterative approach', async () => {
    const width = 100;
    const height = 100;
    const grayValue = Math.round(255 * 0.18); // 18% middle gray
    
    const inputImage = createMockImageData(width, height, grayValue);
    
    // Single-pass approach (maxIterations: 1)
    const singlePassSettings: GrainSettings = {
      ...BASE_SETTINGS,
      maxIterations: 1,
      convergenceThreshold: 0.01, // Strict threshold (won't be reached in 1 iteration)
    };
    
    // Iterative approach (default: 5 iterations)
    const iterativeSettings: GrainSettings = {
      ...BASE_SETTINGS,
      maxIterations: 5,
      convergenceThreshold: 0.05, // 5% tolerance
    };
    
    // Process with single-pass approach
    const singlePassProcessor = createTestGrainProcessor(width, height, singlePassSettings);
    const singlePassResult = await singlePassProcessor.processImage(inputImage);
    
    // Process with iterative approach (use different seed to ensure different processor instance)
    const iterativeProcessor = createTestGrainProcessor(width, height, iterativeSettings, 12346);
    const iterativeResult = await iterativeProcessor.processImage(inputImage);
    
    // Calculate lightness preservation errors
    const singlePassError = calculateLightnessError(inputImage, singlePassResult);
    const iterativeError = calculateLightnessError(inputImage, iterativeResult);
    
    const inputLightness = calculateAverageLightness(inputImage);
    const singlePassLightness = calculateAverageLightness(singlePassResult);
    const iterativeLightness = calculateAverageLightness(iterativeResult);
    
    console.log(`\n=== Lightness Preservation Comparison ===`);
    console.log(`Input lightness: ${inputLightness.toFixed(4)}`);
    console.log(`Single-pass result: ${singlePassLightness.toFixed(4)} (error: ${(singlePassError * 100).toFixed(2)}%)`);
    console.log(`Iterative result: ${iterativeLightness.toFixed(4)} (error: ${(iterativeError * 100).toFixed(2)}%)`);
    console.log(`Improvement factor: ${(singlePassError / iterativeError).toFixed(2)}x better`);
    
    // The iterative approach should preserve lightness better than single-pass
    expect(iterativeError).toBeLessThan(singlePassError);
    
    // Both should be within reasonable bounds, but iterative should be significantly better
    expect(iterativeError).toBeLessThan(0.10); // Within 10% error for iterative
    expect(singlePassError).toBeGreaterThan(0.05); // Single-pass should have some measurable error
    
    // The improvement should be meaningful (at least 20% better)
    const improvementFactor = singlePassError / iterativeError;
    expect(improvementFactor).toBeGreaterThan(1.2);
  });

  it('should demonstrate quality improvements across different gray levels', async () => {
    const width = 80;
    const height = 80;
    const testGrayValues = [32, 128, 224]; // Dark, medium, light gray
    
    console.log(`\n=== Quality Comparison Across Gray Levels ===`);
    
    for (const grayValue of testGrayValues) {
      const inputImage = createMockImageData(width, height, grayValue);
      
      // Single-pass approach
      const singlePassSettings: GrainSettings = {
        ...BASE_SETTINGS,
        maxIterations: 1,
      };
      
      // Iterative approach
      const iterativeSettings: GrainSettings = {
        ...BASE_SETTINGS,
        maxIterations: 5,
        convergenceThreshold: 0.05,
      };
      
      // Process with both approaches
      const singlePassProcessor = createTestGrainProcessor(width, height, singlePassSettings);
      const singlePassResult = await singlePassProcessor.processImage(inputImage);
      
      const iterativeProcessor = createTestGrainProcessor(width, height, iterativeSettings, 12346);
      const iterativeResult = await iterativeProcessor.processImage(inputImage);
      
      // Calculate errors
      const singlePassError = calculateLightnessError(inputImage, singlePassResult);
      const iterativeError = calculateLightnessError(inputImage, iterativeResult);
      
      const grayPercent = Math.round((grayValue / 255) * 100);
      console.log(`Gray ${grayPercent}%: Single-pass error ${(singlePassError * 100).toFixed(2)}%, Iterative error ${(iterativeError * 100).toFixed(2)}%`);
      
      // Iterative should consistently perform better or at least as well
      expect(iterativeError).toBeLessThanOrEqual(singlePassError + 0.01); // Allow small tolerance for measurement variance
    }
  });

  it('should show convergence behavior with different iteration limits', async () => {
    const width = 60;
    const height = 60;
    const grayValue = Math.round(255 * 0.5); // 50% gray
    
    const inputImage = createMockImageData(width, height, grayValue);
    const iterations = [1, 2, 3, 5];
    
    console.log(`\n=== Convergence Analysis ===`);
    console.log(`Input lightness: ${calculateAverageLightness(inputImage).toFixed(4)}`);
    
    const errors: number[] = [];
    
    for (const maxIterations of iterations) {
      const settings: GrainSettings = {
        ...BASE_SETTINGS,
        maxIterations,
        convergenceThreshold: 0.01, // Strict threshold to force full iterations
      };
      
      const processor = createTestGrainProcessor(width, height, settings);
      const result = await processor.processImage(inputImage);
      
      const error = calculateLightnessError(inputImage, result);
      errors.push(error);
      
      console.log(`${maxIterations} iteration(s): ${(error * 100).toFixed(2)}% error`);
    }
    
    // Generally, more iterations should lead to better or stable results
    // (though there might be some variance due to the stochastic nature of grain)
    const firstError = errors[0];
    const lastError = errors[errors.length - 1];
    
    // The final result should be at least as good as the first iteration
    expect(lastError).toBeLessThanOrEqual(firstError + 0.05); // Allow some tolerance for grain variance
    
    // Most results should show improvement or stabilization
    let improvementCount = 0;
    for (let i = 1; i < errors.length; i++) {
      if (errors[i] <= errors[i - 1] + 0.02) { // Allow small tolerance
        improvementCount++;
      }
    }
    
    // At least 2 out of 3 successive iterations should show improvement or stability
    expect(improvementCount).toBeGreaterThanOrEqual(2);
  });
});
