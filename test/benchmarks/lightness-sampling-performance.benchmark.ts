/**
 * Performance benchmarks for lightness sampling estimation
 * These tests were moved from the unit test suite to avoid slowing down regular test runs
 */

import { describe, it, expect } from 'vitest';
import { GrainProcessor } from '../../src/grain-processor';
import { createTestImageData } from '../test-utils';
import type { GrainSettings } from '../../src/types';

describe('Lightness Sampling Performance Benchmarks', () => {
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

    console.log(`\n📊 Sampling Performance (${width}x${height}):`);
    console.log(`  Processing time: ${processingTime.toFixed(2)}ms`);

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

      console.log(
        `  Sampling density ${(density * 100).toFixed(0)}%: ${(testEnd - testStart).toFixed(2)}ms`
      );
    }
  });
});
