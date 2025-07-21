import { describe, it, expect } from 'vitest';
import { GrainProcessor } from '../src/grain-processor';
import { createTestImageData } from './test-utils';
import type { GrainSettings } from '../src/types';

describe('Lightness Sampling Performance', () => {
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
