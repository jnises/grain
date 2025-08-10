/**
 * Performance benchmarks for grain processing pipeline
 * These tests were moved from the unit test suite to avoid slowing down regular test runs
 */

import { describe, it, expect } from 'vitest';
import { createTestGrainProcessor, createMockImageData } from '../test-utils';
import { GrainSettings } from '../../src/types';

const defaultSettings: GrainSettings = {
  iso: 400,
  filmType: 'kodak',
};

const grainSettings: GrainSettings = {
  iso: 400,
  filmType: 'kodak',
};

describe('Grain Processor Performance Benchmarks', () => {
  describe('Processing Time Benchmarks', () => {
    it('should maintain reasonable processing times for medium-sized images', async () => {
      const width = 200;
      const height = 150;
      const processor = createTestGrainProcessor(
        width,
        height,
        defaultSettings
      );
      const testImage = createMockImageData(width, height, 128);

      const startTime = performance.now();
      const result = await processor.processImage(testImage);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(`\n📊 Medium Image Processing (${width}x${height}):`);
      console.log(`  Processing time: ${processingTime.toFixed(2)}ms`);
      console.log(
        `  Pixels per second: ${((width * height) / (processingTime / 1000)).toFixed(0)}`
      );

      // Should complete within reasonable time (5 seconds for this size)
      expect(processingTime).toBeLessThan(5000);
      expect(result).toBeDefined();
    });

    it('should process small images within reasonable time', async () => {
      // Create a processor with matching dimensions for the test image
      const testProcessor = createTestGrainProcessor(50, 50, grainSettings);
      const imageData = createMockImageData(50, 50, 128);

      const startTime = performance.now();
      const result = await testProcessor.processImage(imageData);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(`\n📊 Small Image Processing (50x50):`);
      console.log(`  Processing time: ${processingTime.toFixed(2)}ms`);
      console.log(
        `  Pixels per second: ${((50 * 50) / (processingTime / 1000)).toFixed(0)}`
      );

      // Should complete within 1 second for small image
      expect(processingTime).toBeLessThan(1000);
      expect(result).toBeDefined();
    });

    it('should scale reasonably with image size', async () => {
      const smallProcessor = createTestGrainProcessor(25, 25, grainSettings);
      const largeProcessor = createTestGrainProcessor(50, 50, grainSettings);

      const smallImage = createMockImageData(25, 25, 128);
      const largeImage = createMockImageData(50, 50, 128);

      // Process small image
      const startSmall = performance.now();
      await smallProcessor.processImage(smallImage);
      const smallTime = performance.now() - startSmall;

      // Process large image (4x pixels)
      const startLarge = performance.now();
      await largeProcessor.processImage(largeImage);
      const largeTime = performance.now() - startLarge;

      const scalingFactor = largeTime / smallTime;
      const pixelRatio = (50 * 50) / (25 * 25); // 4x pixels

      console.log(`\n📈 Image Size Scaling Analysis:`);
      console.log(`  Small image (25x25): ${smallTime.toFixed(2)}ms`);
      console.log(`  Large image (50x50): ${largeTime.toFixed(2)}ms`);
      console.log(`  Scaling factor: ${scalingFactor.toFixed(2)}x`);
      console.log(`  Pixel ratio: ${pixelRatio}x`);
      console.log(
        `  Efficiency: ${(pixelRatio / scalingFactor).toFixed(2)} (higher is better)`
      );

      // Larger image should take more time, but not excessively more
      // (4x pixels should not take more than 10x time)
      expect(scalingFactor).toBeLessThan(10);
      expect(largeTime).toBeGreaterThan(smallTime);
    });
  });

  describe('Extreme Brightness Performance', () => {
    it('should handle extreme brightness values efficiently', async () => {
      const processor = createTestGrainProcessor(50, 50, defaultSettings);

      // Test pure black
      const blackImage = createMockImageData(50, 50, 0);
      const startBlack = performance.now();
      const blackResult = await processor.processImage(blackImage);
      const blackTime = performance.now() - startBlack;

      // Test pure white
      const whiteImage = createMockImageData(50, 50, 255);
      const startWhite = performance.now();
      const whiteResult = await processor.processImage(whiteImage);
      const whiteTime = performance.now() - startWhite;

      // Test middle gray for comparison
      const grayImage = createMockImageData(50, 50, 128);
      const startGray = performance.now();
      const grayResult = await processor.processImage(grayImage);
      const grayTime = performance.now() - startGray;

      console.log(`\n🎨 Brightness Value Performance:`);
      console.log(`  Black (0): ${blackTime.toFixed(2)}ms`);
      console.log(`  Gray (128): ${grayTime.toFixed(2)}ms`);
      console.log(`  White (255): ${whiteTime.toFixed(2)}ms`);

      // All should complete in reasonable time
      expect(blackTime).toBeLessThan(2000);
      expect(grayTime).toBeLessThan(2000);
      expect(whiteTime).toBeLessThan(2000);

      // Results should be valid
      expect(blackResult).toBeDefined();
      expect(grayResult).toBeDefined();
      expect(whiteResult).toBeDefined();
    });
  });
});
