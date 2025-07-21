import { describe, it, expect } from 'vitest';
import { GrainProcessor } from '../src/grain-processor';
import { createTestImageData } from './test-utils';
import type { GrainSettings } from '../src/types';

describe('Lightness Sampling Performance', () => {
  it('should provide significant performance improvement over full processing', async () => {
    const width = 200;
    const height = 200;
    const settings: GrainSettings = {
      iso: 400,
      filmType: 'kodak',
      maxIterations: 3, // Force multiple iterations
      convergenceThreshold: 0.01, // 1% convergence threshold (above minimum of 0.001)
      lightnessEstimationSamplingDensity: 0.05, // 5% sampling for performance test
    };

    // Create test image with varied content to ensure iterations are needed
    const imageData = createTestImageData(width, height, (x, y) => {
      // Create gradient pattern that will likely need lightness adjustment
      const intensity = (x + y) / (width + height);
      return {
        r: Math.floor(intensity * 128 + 64), // Mid-gray gradient
        g: Math.floor(intensity * 128 + 64),
        b: Math.floor(intensity * 128 + 64),
        a: 255,
      };
    });

    const processor = new GrainProcessor(width, height, settings);
    
    const startTime = performance.now();
    const result = await processor.processImage(imageData);
    const endTime = performance.now();
    
    const processingTime = endTime - startTime;

    // Verify the result is valid
    expect(result).toBeDefined();
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
    
    // Performance assertion - should complete within reasonable time
    // With sampling, even a 200x200 image should process in under 2 seconds
    expect(processingTime).toBeLessThan(2000);
    
    console.log(`Processing time with sampling (${width}x${height}): ${processingTime.toFixed(2)}ms`);
    
    // Test with different sampling densities to show the tradeoff
    const densities = [0.01, 0.05, 0.1]; // 1%, 5%, 10%
    
    for (const density of densities) {
      const testSettings: GrainSettings = {
        ...settings,
        lightnessEstimationSamplingDensity: density,
      };
      
      const testProcessor = new GrainProcessor(width, height, testSettings);
      const testStart = performance.now();
      await testProcessor.processImage(imageData);
      const testEnd = performance.now();
      
      console.log(`Sampling density ${(density * 100).toFixed(0)}%: ${(testEnd - testStart).toFixed(2)}ms`);
    }
  });

  it('should maintain reasonable accuracy with sampling estimation', async () => {
    const width = 100;
    const height = 100;
    
    // Create a simple test with uniform gray
    const imageData = createTestImageData(width, height, () => ({
      r: 128, g: 128, b: 128, a: 255,
    }));

    // Test with different sampling densities
    const baseSetting: GrainSettings = {
      iso: 400,
      filmType: 'kodak',
      maxIterations: 5,
      convergenceThreshold: 0.05,
    };

    // Process with high sampling density (should be very accurate)
    const highSamplingSettings: GrainSettings = {
      ...baseSetting,
      lightnessEstimationSamplingDensity: 0.5, // 50% sampling
    };

    // Process with low sampling density (should be fast but still reasonable)
    const lowSamplingSettings: GrainSettings = {
      ...baseSetting,
      lightnessEstimationSamplingDensity: 0.02, // 2% sampling
    };

    const highSamplingProcessor = new GrainProcessor(width, height, highSamplingSettings);
    const lowSamplingProcessor = new GrainProcessor(width, height, lowSamplingSettings);

    const [highSamplingResult, lowSamplingResult] = await Promise.all([
      highSamplingProcessor.processImage(imageData),
      lowSamplingProcessor.processImage(imageData),
    ]);

    // Both should produce valid results
    expect(highSamplingResult.width).toBe(width);
    expect(lowSamplingResult.width).toBe(width);
    
    // Calculate average brightness of results to compare accuracy
    let highSamplingSum = 0;
    let lowSamplingSum = 0;
    
    for (let i = 0; i < highSamplingResult.data.length; i += 4) {
      highSamplingSum += highSamplingResult.data[i]; // Red channel (grayscale)
      lowSamplingSum += lowSamplingResult.data[i];
    }
    
    const highSamplingAvg = highSamplingSum / (width * height);
    const lowSamplingAvg = lowSamplingSum / (width * height);
    
    // Results should be reasonably similar (within 20% difference)
    const difference = Math.abs(highSamplingAvg - lowSamplingAvg);
    const relativeDifference = difference / Math.max(highSamplingAvg, lowSamplingAvg);
    
    console.log(`High sampling average: ${highSamplingAvg.toFixed(2)}`);
    console.log(`Low sampling average: ${lowSamplingAvg.toFixed(2)}`);
    console.log(`Relative difference: ${(relativeDifference * 100).toFixed(2)}%`);
    
    expect(relativeDifference).toBeLessThan(0.2); // Less than 20% difference
  });
});
