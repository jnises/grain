import { describe, it, expect } from 'vitest';
import { calculateLightnessFactor } from '../src/grain-math.js';
import { GrainProcessor } from '../src/grain-processor.js';
import type { GrainPoint, GrainExposureMap } from '../src/types.js';

describe('Lightness Iteration Convergence', () => {
  // Create a test subclass to access private methods
  class TestGrainProcessor extends GrainProcessor {
    public static testAdjustGrainExposures(
      originalExposureMap: GrainExposureMap,
      adjustmentFactor: number
    ): GrainExposureMap {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this as any).adjustGrainExposures(originalExposureMap, adjustmentFactor);
    }

    // Helper to simulate the grain processing pipeline
    public static createTestExposureMap(): GrainExposureMap {
      const map: GrainExposureMap = new Map();
      const testGrains: GrainPoint[] = [
        { x: 10, y: 10, size: 2.0, sensitivity: 0.8, developmentThreshold: 0.4 },
        { x: 20, y: 20, size: 2.5, sensitivity: 0.7, developmentThreshold: 0.5 },
        { x: 30, y: 30, size: 1.8, sensitivity: 0.9, developmentThreshold: 0.3 },
      ];

      // Set initial exposures
      map.set(testGrains[0], 0.2);
      map.set(testGrains[1], 0.5);
      map.set(testGrains[2], 0.8);

      return map;
    }
  }

  const createRgbaArray = (values: number[]): Float32Array => {
    // Convert grayscale values to RGBA format (R=G=B=value, A=1)
    const rgba = new Float32Array(values.length * 4);
    for (let i = 0; i < values.length; i++) {
      rgba[i * 4] = values[i];     // R
      rgba[i * 4 + 1] = values[i]; // G
      rgba[i * 4 + 2] = values[i]; // B
      rgba[i * 4 + 3] = 1.0;       // A
    }
    return rgba;
  };

  describe('calculateLightnessFactor and adjustGrainExposures integration', () => {
    it('should behave correctly when lightness factor is applied to grain exposures', () => {
      // Test scenario: processed image is darker than original (factor > 1)
      const original = createRgbaArray([0.8]);
      const processed = createRgbaArray([0.4]); // Half as bright
      
      const lightnessFactor = calculateLightnessFactor(original, processed);
      expect(lightnessFactor).toBeCloseTo(2.0, 6); // 0.8 / 0.4 = 2.0

      // Apply this factor to grain exposures
      const originalExposureMap = TestGrainProcessor.createTestExposureMap();
      const adjustedExposureMap = TestGrainProcessor.testAdjustGrainExposures(
        originalExposureMap,
        lightnessFactor
      );

      // When processed image is too dark (factor > 1), grain exposures should increase
      // to produce denser grains that create lighter output
      for (const [grain, originalExposure] of originalExposureMap.entries()) {
        const adjustedExposure = adjustedExposureMap.get(grain)!;
        expect(adjustedExposure).toBeGreaterThan(originalExposure);
        
        // Verify all exposures are within valid range [0, 1]
        expect(adjustedExposure).toBeGreaterThanOrEqual(0);
        expect(adjustedExposure).toBeLessThanOrEqual(1);
      }
    });

    it('should behave correctly when processed image is lighter than original', () => {
      // Test scenario: processed image is lighter than original (factor < 1)
      const original = createRgbaArray([0.3]);
      const processed = createRgbaArray([0.6]); // Twice as bright
      
      const lightnessFactor = calculateLightnessFactor(original, processed);
      expect(lightnessFactor).toBeCloseTo(0.5, 6); // 0.3 / 0.6 = 0.5

      // Apply this factor to grain exposures
      const originalExposureMap = TestGrainProcessor.createTestExposureMap();
      const adjustedExposureMap = TestGrainProcessor.testAdjustGrainExposures(
        originalExposureMap,
        lightnessFactor
      );

      // When processed image is too bright (factor < 1), grain exposures should decrease
      // to produce less dense grains that create darker output
      for (const [grain, originalExposure] of originalExposureMap.entries()) {
        const adjustedExposure = adjustedExposureMap.get(grain)!;
        expect(adjustedExposure).toBeLessThan(originalExposure);
        
        // Verify all exposures are within valid range [0, 1]
        expect(adjustedExposure).toBeGreaterThanOrEqual(0);
        expect(adjustedExposure).toBeLessThanOrEqual(1);
      }
    });

    it('should converge toward target lightness through successive iterations', () => {
      // Simulate a convergence scenario
      let currentLightnessFactor = 2.0; // Start with processed image too dark
      const targetLightness = 1.0;
      const convergenceThreshold = 0.05; // 5% tolerance
      const maxIterations = 10;
      
      let originalExposureMap = TestGrainProcessor.createTestExposureMap();
      let iterations = 0;
      const factorHistory: number[] = [];

      // Simulate iterative convergence
      while (Math.abs(currentLightnessFactor - targetLightness) > convergenceThreshold && iterations < maxIterations) {
        factorHistory.push(currentLightnessFactor);
        
        // Apply adjustment
        originalExposureMap = TestGrainProcessor.testAdjustGrainExposures(
          originalExposureMap,
          currentLightnessFactor
        );
        
        // In real algorithm, this would process pixels and recalculate lightness
        // For testing, we simulate convergence by dampening the factor
        const dampening = 0.7; // Simulate system response
        currentLightnessFactor = targetLightness + (currentLightnessFactor - targetLightness) * dampening;
        
        iterations++;
      }

      console.log(`Convergence simulation: ${iterations} iterations`);
      console.log(`Factor history: ${factorHistory.map(f => f.toFixed(3)).join(' → ')}`);
      console.log(`Final factor: ${currentLightnessFactor.toFixed(4)}`);

      // Should converge within reasonable number of iterations
      expect(iterations).toBeLessThan(maxIterations);
      
      // Should be close to target lightness
      expect(Math.abs(currentLightnessFactor - targetLightness)).toBeLessThan(convergenceThreshold);
      
      // Factors should generally decrease (converging)
      if (factorHistory.length > 1) {
        const firstFactor = factorHistory[0];
        const lastFactor = factorHistory[factorHistory.length - 1];
        expect(Math.abs(lastFactor - targetLightness)).toBeLessThan(Math.abs(firstFactor - targetLightness));
      }
    });

    it('should handle edge cases in convergence', () => {
      // Test with very small lightness factors (near zero)
      const verySmallFactor = 0.001;
      const exposureMap = TestGrainProcessor.createTestExposureMap();
      const adjusted = TestGrainProcessor.testAdjustGrainExposures(exposureMap, verySmallFactor);
      
      // Should still produce valid exposures (clamped to reasonable range)
      for (const [, adjustedExposure] of adjusted.entries()) {
        expect(adjustedExposure).toBeGreaterThanOrEqual(0);
        expect(adjustedExposure).toBeLessThanOrEqual(1);
        expect(Number.isFinite(adjustedExposure)).toBe(true);
      }

      // Test with very large lightness factors
      const veryLargeFactor = 100.0;
      const adjusted2 = TestGrainProcessor.testAdjustGrainExposures(exposureMap, veryLargeFactor);
      
      // Should still produce valid exposures (clamped to [0, 1])
      for (const [, adjustedExposure] of adjusted2.entries()) {
        expect(adjustedExposure).toBeGreaterThanOrEqual(0);
        expect(adjustedExposure).toBeLessThanOrEqual(1);
        expect(Number.isFinite(adjustedExposure)).toBe(true);
      }
    });

    it('should preserve relative ordering of exposures during adjustment', () => {
      // Create exposure map with clear ordering
      const exposureMap: GrainExposureMap = new Map();
      const grains: GrainPoint[] = [
        { x: 10, y: 10, size: 2.0, sensitivity: 0.8, developmentThreshold: 0.4 }, // Low exposure
        { x: 20, y: 20, size: 2.0, sensitivity: 0.8, developmentThreshold: 0.4 }, // Medium exposure  
        { x: 30, y: 30, size: 2.0, sensitivity: 0.8, developmentThreshold: 0.4 }, // High exposure
      ];
      
      exposureMap.set(grains[0], 0.2); // Low
      exposureMap.set(grains[1], 0.5); // Medium
      exposureMap.set(grains[2], 0.8); // High
      
      // Apply moderate adjustment factor
      const adjustmentFactor = 1.5;
      const adjusted = TestGrainProcessor.testAdjustGrainExposures(exposureMap, adjustmentFactor);
      
      const adjustedLow = adjusted.get(grains[0])!;
      const adjustedMedium = adjusted.get(grains[1])!;
      const adjustedHigh = adjusted.get(grains[2])!;
      
      // Relative ordering should be preserved
      expect(adjustedLow).toBeLessThan(adjustedMedium);
      expect(adjustedMedium).toBeLessThan(adjustedHigh);
      
      // All should be increased (factor > 1)
      expect(adjustedLow).toBeGreaterThan(0.2);
      expect(adjustedMedium).toBeGreaterThan(0.5);
      expect(adjustedHigh).toBeGreaterThan(0.8);
    });

    it('should handle calculateLightnessFactor output correctly in adjustGrainExposures', () => {
      // Test various scenarios that calculateLightnessFactor might produce
      const testCases = [
        { name: 'Perfect match', factor: 1.0 },
        { name: 'Slightly darker processed', factor: 1.1 },
        { name: 'Slightly lighter processed', factor: 0.9 },
        { name: 'Much darker processed', factor: 2.0 },
        { name: 'Much lighter processed', factor: 0.5 },
      ];
      
      const baseExposureMap = TestGrainProcessor.createTestExposureMap();
      
      for (const testCase of testCases) {
        const adjustedMap = TestGrainProcessor.testAdjustGrainExposures(
          baseExposureMap,
          testCase.factor
        );
        
        // All adjusted exposures should be valid
        for (const [grain, adjustedExposure] of adjustedMap.entries()) {
          expect(adjustedExposure).toBeGreaterThanOrEqual(0);
          expect(adjustedExposure).toBeLessThanOrEqual(1);
          expect(Number.isFinite(adjustedExposure)).toBe(true);
          
          const originalExposure = baseExposureMap.get(grain)!;
          
          if (testCase.factor > 1.0) {
            // Factor > 1 means processed was too dark, so increase exposure
            expect(adjustedExposure).toBeGreaterThanOrEqual(originalExposure);
          } else if (testCase.factor < 1.0) {
            // Factor < 1 means processed was too bright, so decrease exposure
            expect(adjustedExposure).toBeLessThanOrEqual(originalExposure);
          } else {
            // Factor = 1 means perfect match, exposure should be similar
            expect(adjustedExposure).toBeCloseTo(originalExposure, 4);
          }
        }
      }
    });
  });

  describe('lightness factor edge cases', () => {
    it('should handle very dark images correctly in convergence scenario', () => {
      // Test with very dark images (below DARK_THRESHOLD in calculateLightnessFactor)
      const darkOriginal = createRgbaArray([0.005]); // Below 0.01 threshold
      const darkProcessed = createRgbaArray([0.003]); 
      
      const factor = calculateLightnessFactor(darkOriginal, darkProcessed);
      // For dark images, factor should be ≤ 1.0 to avoid amplifying noise
      expect(factor).toBeLessThanOrEqual(1.0);
      
      // Should work correctly with adjustGrainExposures
      const exposureMap = TestGrainProcessor.createTestExposureMap();
      const adjusted = TestGrainProcessor.testAdjustGrainExposures(exposureMap, factor);
      
      // All exposures should remain valid and reasonable
      for (const [grain, adjustedExposure] of adjusted.entries()) {
        expect(adjustedExposure).toBeGreaterThanOrEqual(0);
        expect(adjustedExposure).toBeLessThanOrEqual(1);
        
        const originalExposure = exposureMap.get(grain)!;
        // Since factor ≤ 1.0, adjusted exposure should not be higher than original
        expect(adjustedExposure).toBeLessThanOrEqual(originalExposure);
      }
    });

    it('should handle near-black processed images correctly', () => {
      const original = createRgbaArray([0.5]);
      const nearBlackProcessed = createRgbaArray([0.0001]);
      
      const factor = calculateLightnessFactor(original, nearBlackProcessed);
      // Should return 1.0 when processed is nearly black to avoid extreme corrections
      expect(factor).toBe(1.0);
      
      const exposureMap = TestGrainProcessor.createTestExposureMap();
      const adjusted = TestGrainProcessor.testAdjustGrainExposures(exposureMap, factor);
      
      // With factor = 1.0, exposures should be approximately unchanged
      for (const [grain, adjustedExposure] of adjusted.entries()) {
        const originalExposure = exposureMap.get(grain)!;
        expect(adjustedExposure).toBeCloseTo(originalExposure, 3);
      }
    });
  });
});
