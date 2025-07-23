import { describe, it, expect } from 'vitest';
import { GrainDensityCalculator } from '../src/grain-density';
import { SeededRandomNumberGenerator } from '../src/grain-generator';
import type { GrainSettings, GrainPoint, GrainExposureMap } from '../src/types';
import { createGrainExposure } from '../src/types';

/**
 * Unit tests for GrainDensityCalculator class
 * Tests the grain density calculation algorithms used in film simulation
 */
describe('GrainDensityCalculator', () => {
  const defaultSettings: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
  };

  describe('calculateIntrinsicGrainDensities', () => {
    it('should produce uniform densities for uniform grains with uniform exposures', () => {
      const settings: GrainSettings = {
        iso: 100,
        filmType: 'kodak',
      };

      // Create uniform grains on a dense grid (4x4 pixel spacing)
      const uniformGrains: GrainPoint[] = [];
      const grainSpacing = 4;
      const grainSize = 2.0;
      const uniformSensitivity = 0.5;
      const uniformThreshold = 0.1;

      const gridSize = 16; // 16x16 grid
      for (let y = grainSpacing; y < gridSize; y += grainSpacing) {
        for (let x = grainSpacing; x < gridSize; x += grainSpacing) {
          uniformGrains.push({
            x,
            y,
            size: grainSize,
            sensitivity: uniformSensitivity,
            developmentThreshold: uniformThreshold,
          });
        }
      }

      // Create uniform exposure map - all grains have the same exposure
      const uniformExposure = createGrainExposure(0.6); // Mid-high exposure
      const exposureMap: GrainExposureMap = new Map();
      uniformGrains.forEach((grain) => {
        exposureMap.set(grain, uniformExposure);
      });

      // Calculate intrinsic grain densities with seeded RNG for reproducible results
      const rng = new SeededRandomNumberGenerator(42);
      const calculator = new GrainDensityCalculator(settings, rng);
      const densityMap = calculator.calculateIntrinsicGrainDensities(
        uniformGrains,
        exposureMap
      );

      // Verify that all grains have density values
      expect(densityMap.size).toBe(uniformGrains.length);

      // Collect all density values
      const densityValues: number[] = [];
      densityMap.forEach((density) => {
        densityValues.push(density); // GrainIntrinsicDensity is a branded number type
      });

      // Calculate statistics for the densities
      const mean =
        densityValues.reduce((sum, val) => sum + val, 0) / densityValues.length;
      const variance =
        densityValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
        densityValues.length;
      const stdDev = Math.sqrt(variance);

      // Find min and max values
      let minDensity = densityValues[0];
      let maxDensity = densityValues[0];
      for (let i = 1; i < densityValues.length; i++) {
        if (densityValues[i] < minDensity) minDensity = densityValues[i];
        if (densityValues[i] > maxDensity) maxDensity = densityValues[i];
      }

      // Debug output to understand the actual values
      console.log(
        `Debug - Density Mean: ${mean.toFixed(4)}, StdDev: ${stdDev.toFixed(4)}, Min: ${minDensity.toFixed(4)}, Max: ${maxDensity.toFixed(4)}`
      );

      // With uniform grains and uniform exposures, all densities should be almost the same
      // The standard deviation should be very small
      expect(stdDev).toBeLessThan(0.01); // Very tight tolerance for uniform input

      // All individual densities should be close to the mean
      densityValues.forEach((density) => {
        expect(Math.abs(density - mean)).toBeLessThan(0.02); // Small deviation from mean
      });

      // The mean density should be reasonable for the given exposure
      // Mid-high exposure (0.6) should produce meaningful density
      expect(mean).toBeGreaterThan(0.1);
      expect(mean).toBeLessThan(2.0);

      // All densities should be non-negative
      densityValues.forEach((density) => {
        expect(density).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle empty grain array', () => {
      const rng = new SeededRandomNumberGenerator(42);
      const calculator = new GrainDensityCalculator(defaultSettings, rng);
      const emptyGrains: GrainPoint[] = [];
      const emptyExposureMap: GrainExposureMap = new Map();

      const densityMap = calculator.calculateIntrinsicGrainDensities(
        emptyGrains,
        emptyExposureMap
      );

      expect(densityMap.size).toBe(0);
    });

    it('should produce different densities for different exposures', () => {
      const rng = new SeededRandomNumberGenerator(42);
      const calculator = new GrainDensityCalculator(defaultSettings, rng);

      // Create two identical grains at different positions
      const grains: GrainPoint[] = [
        {
          x: 10,
          y: 10,
          size: 2.0,
          sensitivity: 0.5,
          developmentThreshold: 0.1,
        },
        {
          x: 20,
          y: 20,
          size: 2.0,
          sensitivity: 0.5,
          developmentThreshold: 0.1,
        },
      ];

      // Give them different exposures
      const exposureMap: GrainExposureMap = new Map();
      exposureMap.set(grains[0], createGrainExposure(0.2)); // Low exposure
      exposureMap.set(grains[1], createGrainExposure(0.8)); // High exposure

      const densityMap = calculator.calculateIntrinsicGrainDensities(
        grains,
        exposureMap
      );

      const density1 = densityMap.get(grains[0])!;
      const density2 = densityMap.get(grains[1])!;

      // Higher exposure should generally produce higher density
      expect(density2).toBeGreaterThan(density1);

      // Both should be non-negative
      expect(density1).toBeGreaterThanOrEqual(0);
      expect(density2).toBeGreaterThanOrEqual(0);
    });
  });
});
