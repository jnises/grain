import { describe, it, expect, beforeEach } from 'vitest';
import { GrainDensityCalculator } from '../src/grain-density';
import {
  sampleGrainAreaExposure,
  KernelGenerator,
} from '../src/grain-sampling';
import {
  calculateGrainFalloff,
  calculateSampleWeight,
} from '../src/grain-math';
import type { GrainPoint } from '../src/types';
import { createGrainExposure } from '../src/types';

// Test utility function - create grayscale image data
function createGrayscaleImageData(
  width: number,
  height: number,
  luminancePattern: (x: number, y: number) => number
): { data: Float32Array } {
  const data = new Float32Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      const luminance = luminancePattern(x, y);

      // Set RGB channels to same luminance value (grayscale)
      data[pixelIndex] = luminance; // R
      data[pixelIndex + 1] = luminance; // G
      data[pixelIndex + 2] = luminance; // B
      data[pixelIndex + 3] = 1.0; // A
    }
  }

  return { data };
}

describe('Grain Weighting Consistency', () => {
  let grainDensityCalculator: GrainDensityCalculator;
  let kernelGenerator: KernelGenerator;

  beforeEach(() => {
    grainDensityCalculator = new GrainDensityCalculator({
      iso: 400,
      filmType: 'kodak',
    });
    kernelGenerator = new KernelGenerator();
  });

  describe('Shared falloff function consistency', () => {
    it('should produce identical weights for sampling and pixel effects at same distance', () => {
      const grainRadius = 3.0;
      const testDistances = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

      testDistances.forEach((distance) => {
        const falloffWeight = calculateGrainFalloff(distance, grainRadius);
        const sampleWeight = calculateSampleWeight(distance, grainRadius);

        // Sample weight should be at least as large as falloff weight (due to MIN_SAMPLE_WEIGHT)
        expect(sampleWeight).toBeGreaterThanOrEqual(falloffWeight);

        // For distances within the grain, they should be very close (difference only due to MIN_SAMPLE_WEIGHT)
        if (distance <= grainRadius) {
          const difference = sampleWeight - falloffWeight;
          expect(difference).toBeLessThanOrEqual(0.05); // MIN_SAMPLE_WEIGHT is 0.05
        }
      });
    });

    it('should use Gaussian falloff consistently across grain sizes', () => {
      const distance = 2.0;
      const grainSizes = [1.0, 2.0, 3.0, 5.0, 8.0];

      grainSizes.forEach((grainSize) => {
        const falloffWeight = calculateGrainFalloff(distance, grainSize);

        // Should be valid weight
        expect(falloffWeight).toBeGreaterThanOrEqual(0);
        expect(falloffWeight).toBeLessThanOrEqual(1);
        expect(Number.isFinite(falloffWeight)).toBe(true);

        // Larger grains should have higher weight at same distance (wider spread)
        if (grainSize > 3.0) {
          const smallerGrainWeight = calculateGrainFalloff(distance, 3.0);
          expect(falloffWeight).toBeGreaterThan(smallerGrainWeight);
        }
      });
    });
  });

  describe('Single grain behavior consistency', () => {
    it('should produce consistent behavior between exposure calculation and pixel effects', async () => {
      // Create a test image with uniform gray
      const width = 100;
      const height = 100;
      const uniformGray = 0.5;
      const imageData = createGrayscaleImageData(
        width,
        height,
        () => uniformGray
      );

      // Create a single grain at center
      const grain: GrainPoint = {
        x: 50,
        y: 50,
        size: 3.0,
        sensitivity: 0.8,
        developmentThreshold: 0.4,
      };

      // Calculate exposure using kernel sampling
      const grainExposure = sampleGrainAreaExposure(
        imageData.data,
        grain.x,
        grain.y,
        grain.size,
        width,
        height,
        kernelGenerator
      );

      // Calculate intrinsic density from exposure
      const intrinsicDensity = grainDensityCalculator[
        'calculateIntrinsicGrainDensity'
      ](createGrainExposure(grainExposure), grain);

      // Test pixel effects at various distances from grain center
      const testDistances = [0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0];

      testDistances.forEach((distance) => {
        const testX = grain.x + distance;
        const testY = grain.y;

        // Calculate pixel effect
        const pixelEffect = grainDensityCalculator.calculatePixelGrainEffect(
          intrinsicDensity,
          grain,
          testX,
          testY
        );

        // Calculate expected falloff based on shared function
        const expectedFalloff = calculateGrainFalloff(distance, grain.size);
        const expectedPixelEffect = intrinsicDensity * expectedFalloff;

        // Grain has 2x radius cutoff, so beyond that distance pixel effect should be 0
        if (distance >= grain.size * 2) {
          expect(pixelEffect).toBe(0);
        } else {
          // Within cutoff range, should match expected behavior
          expect(pixelEffect).toBeCloseTo(expectedPixelEffect, 8);

          // Verify falloff behavior is reasonable
          if (distance === 0) {
            expect(pixelEffect).toBe(intrinsicDensity); // Maximum at center
          } else if (distance > 0) {
            expect(pixelEffect).toBeGreaterThan(0);
            expect(pixelEffect).toBeLessThan(intrinsicDensity);
          }
        }
      });
    });

    it('should scale correctly with different grain sizes', async () => {
      const width = 100;
      const height = 100;
      const uniformGray = 0.6;
      const imageData = createGrayscaleImageData(
        width,
        height,
        () => uniformGray
      );

      const grainSizes = [1.0, 2.0, 3.0, 5.0, 8.0];
      const testDistance = 2.0;

      grainSizes.forEach((grainSize) => {
        const grain: GrainPoint = {
          x: 50,
          y: 50,
          size: grainSize,
          sensitivity: 0.8,
          developmentThreshold: 0.4,
        };

        // Calculate exposure
        const grainExposure = sampleGrainAreaExposure(
          imageData.data,
          grain.x,
          grain.y,
          grain.size,
          width,
          height,
          kernelGenerator
        );

        // Calculate intrinsic density
        const intrinsicDensity = grainDensityCalculator[
          'calculateIntrinsicGrainDensity'
        ](createGrainExposure(grainExposure), grain);

        // Test pixel at fixed distance
        const testX = grain.x + testDistance;
        const testY = grain.y;

        const pixelEffect = grainDensityCalculator.calculatePixelGrainEffect(
          intrinsicDensity,
          grain,
          testX,
          testY
        );

        // Larger grains should have more influence at same distance
        if (grainSize > 3.0) {
          // Create comparison grain with smaller size
          const smallGrain: GrainPoint = { ...grain, size: 3.0 };
          const smallIntrinsicDensity = grainDensityCalculator[
            'calculateIntrinsicGrainDensity'
          ](createGrainExposure(grainExposure), smallGrain);
          const smallPixelEffect =
            grainDensityCalculator.calculatePixelGrainEffect(
              smallIntrinsicDensity,
              smallGrain,
              testX,
              testY
            );

          expect(pixelEffect).toBeGreaterThan(smallPixelEffect);
        }

        // Effect should be valid
        expect(Number.isFinite(pixelEffect)).toBe(true);
        expect(pixelEffect).toBeGreaterThanOrEqual(0);
      });
    });

    it('should produce mathematically consistent grain shapes', () => {
      // Test that the shared falloff function produces expected Gaussian curves
      const grainRadius = 3.0;
      const testDistances = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0];

      const falloffValues = testDistances.map((d) =>
        calculateGrainFalloff(d, grainRadius)
      );

      // Should decrease monotonically
      for (let i = 1; i < falloffValues.length; i++) {
        expect(falloffValues[i]).toBeLessThanOrEqual(falloffValues[i - 1]);
      }

      // Should approach 0 for large distances
      const veryFarValue = calculateGrainFalloff(grainRadius * 3, grainRadius);
      expect(veryFarValue).toBeLessThan(0.001);

      // Should be 1 at center
      expect(falloffValues[0]).toBe(1.0);
    });
  });

  describe('Mathematical consistency verification', () => {
    it('should maintain Gaussian properties', () => {
      const grainRadius = 4.0;

      // Test Gaussian properties: should be maximum at distance 0
      const centerWeight = calculateGrainFalloff(0, grainRadius);
      const nearbyWeight = calculateGrainFalloff(0.5, grainRadius);
      const farWeight = calculateGrainFalloff(grainRadius * 2, grainRadius);

      expect(centerWeight).toBe(1.0); // Maximum at center
      expect(nearbyWeight).toBeLessThan(centerWeight);
      expect(farWeight).toBeLessThan(nearbyWeight);

      // At 2x grain radius with sigma = 0.7 * radius, we expect significant falloff but not exactly 0
      // sigma = 0.7 * 4 = 2.8, distance = 8, so exponent = -8²/(2*2.8²) = -64/(2*7.84) ≈ -4.08
      // exp(-4.08) ≈ 0.017
      expect(farWeight).toBeCloseTo(0.017, 2);
    });

    it('should use consistent sigma factor', () => {
      // Verify the sigma factor is applied consistently
      const grainRadius = 3.0;
      const sigmaFactor = 0.7; // From implementation
      const expectedSigma = grainRadius * sigmaFactor;

      // At distance = sigma, Gaussian should be exp(-0.5) ≈ 0.606
      const weightAtSigma = calculateGrainFalloff(expectedSigma, grainRadius);
      expect(weightAtSigma).toBeCloseTo(Math.exp(-0.5), 3);
    });
  });
});
