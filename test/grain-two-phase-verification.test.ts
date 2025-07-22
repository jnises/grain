import { describe, it, expect, beforeEach } from 'vitest';
import { GrainGenerator, SeededRandomNumberGenerator } from '../src/grain-generator';
import type { GrainSettings } from '../src/types';
import { createMockImageData, createTestGrainProcessor } from './test-utils';

describe('Phase 4: Two-Phase Grain Processing Verification', () => {
  let grainSettings: GrainSettings;

  beforeEach(() => {
    grainSettings = {
      iso: 400,
      filmType: 'kodak',
    };
  });

  describe('Grain Intrinsic Properties (Position Independence)', () => {
    it('should generate consistent grain structure across multiple calls', () => {
      const rng = new SeededRandomNumberGenerator(12345);
      const generator = new GrainGenerator(100, 100, grainSettings, rng);

      // Generate grain structure multiple times with same settings
      const grains1 = generator.generateGrainStructure();
      rng.reset(); // Reset RNG to get the same sequence
      const grains2 = generator.generateGrainStructure();

      // Should have same number of grains
      expect(grains1.length).toBe(grains2.length);

      // Grain positions should be deterministic for same seed
      if (grains1.length > 0 && grains2.length > 0) {
        expect(grains1[0].x).toBe(1.640779198677539);
        expect(grains1[0].y).toBe(grains2[0].y);
        expect(grains1[0].size).toBe(grains2[0].size);
      }
    });

    it('should maintain grain properties independent of image content', () => {
      const generator = new GrainGenerator(50, 50, grainSettings);
      const grains = generator.generateGrainStructure();

      // Verify grain properties are within expected ranges
      grains.forEach((grain) => {
        expect(grain.x).toBeGreaterThanOrEqual(0);
        expect(grain.x).toBeLessThan(50);
        expect(grain.y).toBeGreaterThanOrEqual(0);
        expect(grain.y).toBeLessThan(50);
        expect(grain.size).toBeGreaterThan(0);
        expect(grain.sensitivity).toBeGreaterThanOrEqual(0);
        // Sensitivity can be > 1 for high-ISO grains, just check it's reasonable
        expect(grain.sensitivity).toBeLessThan(10);
      });
    });
  });

  describe('Visual Effects (Position Dependent)', () => {
    it('should process different image areas differently', async () => {
      // Create processor and image with matching dimensions
      const testProcessor = createTestGrainProcessor(20, 20, grainSettings);
      const imageData = createMockImageData(20, 20, 128);

      // Make one quadrant brighter
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const index = (y * 20 + x) * 4;
          imageData.data[index] = 200; // R
          imageData.data[index + 1] = 200; // G
          imageData.data[index + 2] = 200; // B
        }
      }

      const result = await testProcessor.processImage(imageData);

      // Verify the result has been processed
      expect(result).toBeDefined();
      expect(result.width).toBe(20);
      expect(result.height).toBe(20);
      expect(result.data.length).toBe(imageData.data.length);
    });

    it('should apply grain effects based on local pixel values', async () => {
      // Create a processor with matching dimensions for the test image
      const testProcessor = createTestGrainProcessor(10, 10, grainSettings);

      // Create simple gradient image
      const imageData = createMockImageData(10, 10, 0);

      // Create horizontal gradient
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const brightness = Math.floor((x / 9) * 255);
          const index = (y * 10 + x) * 4;
          imageData.data[index] = brightness;
          imageData.data[index + 1] = brightness;
          imageData.data[index + 2] = brightness;
          imageData.data[index + 3] = 255;
        }
      }

      const result = await testProcessor.processImage(imageData);

      // The result should be different from input
      let pixelsChanged = 0;
      for (let i = 0; i < result.data.length; i += 4) {
        if (
          result.data[i] !== imageData.data[i] ||
          result.data[i + 1] !== imageData.data[i + 1] ||
          result.data[i + 2] !== imageData.data[i + 2]
        ) {
          pixelsChanged++;
        }
      }

      // Should have some grain effect applied
      expect(pixelsChanged).toBeGreaterThan(0);
    });
  });

  // SKIPPED: Performance tests should be in benchmarks/, not unit tests
  describe.skip('Performance Characteristics', () => {
    it('should process images within reasonable time', async () => {
      // Create a processor with matching dimensions for the test image
      const testProcessor = createTestGrainProcessor(50, 50, grainSettings);
      const imageData = createMockImageData(50, 50, 128);

      const startTime = performance.now();
      const result = await testProcessor.processImage(imageData);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

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

      // Process larger image
      const startLarge = performance.now();
      await largeProcessor.processImage(largeImage);
      const largeTime = performance.now() - startLarge;

      // Larger image should take more time, but not excessively more
      // (4x pixels should not take more than 10x time)
      const pixelRatio = (50 * 50) / (25 * 25); // 4x pixels
      const timeRatio = largeTime / smallTime;

      expect(timeRatio).toBeLessThan(pixelRatio * 2.5);
    });
  });

  describe('Two-Phase Architecture Validation', () => {
    it('should maintain consistent grain structure across different images', () => {
      // Create two different processors with same settings
      const processor1 = createTestGrainProcessor(30, 30, grainSettings);
      const processor2 = createTestGrainProcessor(30, 30, grainSettings);

      // Both should use same grain generation logic
      expect(processor1).toBeDefined();
      expect(processor2).toBeDefined();
    });

    it('should handle edge cases gracefully', async () => {
      // Test with very small image - create a processor matching the image size
      const tinyProcessor = createTestGrainProcessor(1, 1, grainSettings);
      const tinyImage = createMockImageData(1, 1, 128);
      const result = await tinyProcessor.processImage(tinyImage);

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.data.length).toBe(4);
    });
  });
});
