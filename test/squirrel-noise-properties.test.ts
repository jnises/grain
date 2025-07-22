import { describe, it, expect } from 'vitest';
import {
  seededRandom,
  seededRandomForGrain,
  squirrelNoise5,
} from '../src/grain-math';

describe('Squirrel Noise 5 Statistical Properties', () => {
  describe('seededRandom', () => {
    it('should produce values in [0, 1) range', () => {
      const testSeeds = [0, 1, 42, 12345, 999999, 0xffffffff];

      for (const seed of testSeeds) {
        const value = seededRandom(seed);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should be deterministic for same seed', () => {
      const seed = 12345;
      const value1 = seededRandom(seed);
      const value2 = seededRandom(seed);
      expect(value1).toBe(value2);
    });

    it('should produce different values for different seeds', () => {
      const values = new Set();
      const numSeeds = 1000;

      for (let i = 0; i < numSeeds; i++) {
        values.add(seededRandom(i));
      }

      // Should have high uniqueness (> 95% unique values)
      expect(values.size).toBeGreaterThan(numSeeds * 0.95);
    });

    it('should have good distribution across [0, 1) range', () => {
      const buckets = new Array(10).fill(0);
      const numSamples = 10000;

      for (let i = 0; i < numSamples; i++) {
        const value = seededRandom(i);
        const bucketIndex = Math.floor(value * 10);
        buckets[bucketIndex]++;
      }

      // Each bucket should have roughly 10% of samples (within tolerance)
      const expectedPerBucket = numSamples / 10;
      const tolerance = expectedPerBucket * 0.1; // 10% tolerance

      for (const count of buckets) {
        expect(count).toBeGreaterThan(expectedPerBucket - tolerance);
        expect(count).toBeLessThan(expectedPerBucket + tolerance);
      }
    });

    it('should handle edge cases properly', () => {
      // Test with zero and large positive integers
      expect(() => seededRandom(0)).not.toThrow();
      expect(() => seededRandom(99999999)).not.toThrow();
    });

    it('should handle integer inputs correctly', () => {
      // Test squirrelNoise5 directly with integer inputs
      expect(() => squirrelNoise5(42)).not.toThrow();
      expect(() => squirrelNoise5(0)).not.toThrow();
      expect(() => squirrelNoise5(-5)).not.toThrow();

      // Test that different integers produce different hashes
      const hash1 = squirrelNoise5(42);
      const hash2 = squirrelNoise5(43);
      const hash3 = squirrelNoise5(0);

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);

      // Test that same integer produces same hash
      expect(squirrelNoise5(42)).toBe(hash1);
    });

    it('should show avalanche effect (small input changes cause large output changes)', () => {
      const pairs = [
        [0, 1],
        [100, 101],
        [12345, 12346],
        [999999, 1000000],
      ];

      for (const [seed1, seed2] of pairs) {
        const value1 = seededRandom(seed1);
        const value2 = seededRandom(seed2);

        // Values should be significantly different (not just small difference)
        const difference = Math.abs(value1 - value2);
        expect(difference).toBeGreaterThan(0.01); // More realistic threshold
      }
    });
  });

  describe('seededRandomForGrain', () => {
    it('should produce values in [0, 1) range for all properties', () => {
      const properties: Array<'size' | 'sensitivity' | 'threshold'> = [
        'size',
        'sensitivity',
        'threshold',
      ];

      for (const property of properties) {
        for (let index = 0; index < 100; index++) {
          const value = seededRandomForGrain(index, property);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      }
    });

    it('should be deterministic for same index and property', () => {
      const index = 42;
      const property = 'size';

      const value1 = seededRandomForGrain(index, property);
      const value2 = seededRandomForGrain(index, property);
      expect(value1).toBe(value2);
    });

    it('should produce different values for different properties with same index', () => {
      const index = 42;

      const sizeValue = seededRandomForGrain(index, 'size');
      const sensitivityValue = seededRandomForGrain(index, 'sensitivity');
      const thresholdValue = seededRandomForGrain(index, 'threshold');

      // All values should be different
      expect(sizeValue).not.toBe(sensitivityValue);
      expect(sizeValue).not.toBe(thresholdValue);
      expect(sensitivityValue).not.toBe(thresholdValue);
    });

    it('should produce different values for different indices with same property', () => {
      const property = 'size';
      const values = new Set();

      for (let index = 0; index < 1000; index++) {
        values.add(seededRandomForGrain(index, property));
      }

      // Should have high uniqueness
      expect(values.size).toBeGreaterThan(950);
    });

    it('should avoid systematic patterns between consecutive indices', () => {
      const property = 'size';
      const differences: number[] = [];

      for (let index = 0; index < 100; index++) {
        const value1 = seededRandomForGrain(index, property);
        const value2 = seededRandomForGrain(index + 1, property);
        differences.push(Math.abs(value1 - value2));
      }

      // Differences should vary widely, not follow a pattern
      let minDiff = differences[0];
      let maxDiff = differences[0];
      for (const diff of differences) {
        if (diff < minDiff) minDiff = diff;
        if (diff > maxDiff) maxDiff = diff;
      }
      const avgDiff =
        differences.reduce((sum, d) => sum + d, 0) / differences.length;

      // Should have good spread in differences
      expect(maxDiff - minDiff).toBeGreaterThan(0.3); // Wide range
      expect(avgDiff).toBeGreaterThan(0.1); // Substantial average difference

      // Should not have all small or all large differences
      const smallDiffs = differences.filter((d) => d < 0.05).length;
      const largeDiffs = differences.filter((d) => d > 0.9).length;
      expect(smallDiffs).toBeLessThan(differences.length * 0.5);
      expect(largeDiffs).toBeLessThan(differences.length * 0.5);
    });

    it('should maintain independence between different property types', () => {
      // Test that knowing one property value doesn't predict another
      const numSamples = 1000;

      const sizeValues: number[] = [];
      const sensitivityValues: number[] = [];

      for (let i = 0; i < numSamples; i++) {
        sizeValues.push(seededRandomForGrain(i, 'size'));
        sensitivityValues.push(seededRandomForGrain(i, 'sensitivity'));
      }

      // Calculate simple correlation coefficient
      const meanSize = sizeValues.reduce((sum, v) => sum + v, 0) / numSamples;
      const meanSensitivity =
        sensitivityValues.reduce((sum, v) => sum + v, 0) / numSamples;

      let numerator = 0;
      let denomSize = 0;
      let denomSensitivity = 0;

      for (let i = 0; i < numSamples; i++) {
        const sizeDeviation = sizeValues[i] - meanSize;
        const sensitivityDeviation = sensitivityValues[i] - meanSensitivity;

        numerator += sizeDeviation * sensitivityDeviation;
        denomSize += sizeDeviation * sizeDeviation;
        denomSensitivity += sensitivityDeviation * sensitivityDeviation;
      }

      const correlation = numerator / Math.sqrt(denomSize * denomSensitivity);

      // Correlation should be close to zero (independent)
      expect(Math.abs(correlation)).toBeLessThan(0.1);
    });
  });

  describe('Performance characteristics', () => {
    it('should complete many operations quickly', () => {
      const startTime = performance.now();
      const numOperations = 100000;

      for (let i = 0; i < numOperations; i++) {
        seededRandom(i);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 100k operations in reasonable time (< 350ms)
      expect(duration).toBeLessThan(350);
    });

    it('should have consistent performance for seededRandomForGrain', () => {
      const startTime = performance.now();
      const numOperations = 50000;

      for (let i = 0; i < numOperations; i++) {
        seededRandomForGrain(i, 'size');
        seededRandomForGrain(i, 'sensitivity');
        seededRandomForGrain(i, 'threshold');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 150k operations in reasonable time (< 500ms)
      expect(duration).toBeLessThan(500);
    });
  });
});
