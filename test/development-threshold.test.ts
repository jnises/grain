/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { GrainGenerator } from '../src/grain-generator';
import { GrainProcessor } from '../src/grain-worker';
import { FILM_CHARACTERISTICS } from '../src/constants';

// Test helper class to access private methods
class TestGrainProcessor extends GrainProcessor {
  public testCalculateIntrinsicGrainDensity(exposure: number, grain: any): number {
    return (this as any).calculateIntrinsicGrainDensity(exposure, grain);
  }
}

describe('Development Threshold System', () => {
  const settings = {
    iso: 400,
    filmType: 'kodak' as const,
    grainIntensity: 1.0,
    upscaleFactor: 1.0
  };

  describe('Per-Grain Development Thresholds', () => {
    it('should assign unique development thresholds to each grain', () => {
      const generator = new GrainGenerator(200, 200, settings);
      const grains = generator.generateGrainStructure();
      
      expect(grains.length).toBeGreaterThan(0);
      
      // Check that all grains have development thresholds
      for (const grain of grains) {
        expect(grain.developmentThreshold).toBeDefined();
        expect(typeof grain.developmentThreshold).toBe('number');
        expect(grain.developmentThreshold).toBeGreaterThan(0);
        expect(grain.developmentThreshold).toBeLessThan(2);
      }
      
      // Check that thresholds vary between grains
      const thresholds = grains.map(g => g.developmentThreshold);
      const uniqueThresholds = new Set(thresholds);
      expect(uniqueThresholds.size).toBeGreaterThan(1);
    });

    it('should calculate thresholds based on film type characteristics', () => {
      const kodakGenerator = new GrainGenerator(100, 100, { ...settings, filmType: 'kodak' });
      const fujiGenerator = new GrainGenerator(100, 100, { ...settings, filmType: 'fuji' });
      const ilfordGenerator = new GrainGenerator(100, 100, { ...settings, filmType: 'ilford' });
      
      const kodakGrains = kodakGenerator.generateGrainStructure();
      const fujiGrains = fujiGenerator.generateGrainStructure();
      const ilfordGrains = ilfordGenerator.generateGrainStructure();
      
      // Calculate average thresholds for each film type
      const kodakAvg = kodakGrains.reduce((sum, g) => sum + g.developmentThreshold, 0) / kodakGrains.length;
      const fujiAvg = fujiGrains.reduce((sum, g) => sum + g.developmentThreshold, 0) / fujiGrains.length;
      const ilfordAvg = ilfordGrains.reduce((sum, g) => sum + g.developmentThreshold, 0) / ilfordGrains.length;
      
      // Kodak should have lowest threshold (most sensitive)
      // Fuji should be in the middle
      // Ilford should have highest threshold (least sensitive)
      expect(kodakAvg).toBeLessThan(fujiAvg);
      expect(fujiAvg).toBeLessThan(ilfordAvg);
      
      // Check they're approximately around the base sensitivity values
      const kodakBase = FILM_CHARACTERISTICS.kodak.developmentThreshold.baseSensitivity;
      const fujiBase = FILM_CHARACTERISTICS.fuji.developmentThreshold.baseSensitivity;
      const ilfordBase = FILM_CHARACTERISTICS.ilford.developmentThreshold.baseSensitivity;
      
      expect(Math.abs(kodakAvg - kodakBase)).toBeLessThan(0.3);
      expect(Math.abs(fujiAvg - fujiBase)).toBeLessThan(0.3);
      expect(Math.abs(ilfordAvg - ilfordBase)).toBeLessThan(0.3);
    });

    it('should vary thresholds based on grain size', () => {
      const generator = new GrainGenerator(200, 200, settings);
      const grains = generator.generateGrainStructure();
      
      // Sort grains by size
      grains.sort((a, b) => a.size - b.size);
      
      // Take smallest and largest grains
      const smallGrains = grains.slice(0, 10);
      const largeGrains = grains.slice(-10);
      
      const smallAvgThreshold = smallGrains.reduce((sum, g) => sum + g.developmentThreshold, 0) / smallGrains.length;
      const largeAvgThreshold = largeGrains.reduce((sum, g) => sum + g.developmentThreshold, 0) / largeGrains.length;
      
      // Larger grains should have lower thresholds (more sensitive)
      expect(largeAvgThreshold).toBeLessThan(smallAvgThreshold);
    });
  });

  describe('Grain Activation Logic', () => {
    it('should not activate grains below development threshold', () => {
      // Create a test grain with known threshold
      const testGrain = {
        x: 50,
        y: 50,
        size: 2,
        sensitivity: 1.0,
        shape: 0.5,
        developmentThreshold: 0.8
      };
      
      // Test with low exposure (below threshold)
      const lowExposure = 0.6; // Much below threshold
      
      // Access the private method via the shared test helper class
      const testProcessor = new TestGrainProcessor(100, 100, settings);
      const strength = testProcessor.testCalculateIntrinsicGrainDensity(lowExposure, testGrain);
      
      // Should return 0 or very low value since grain is not activated
      expect(strength).toBeLessThan(0.1);
    });

    it('should activate grains above development threshold with sigmoid response', () => {
      // Create a test grain with known threshold
      const testGrain = {
        x: 50,
        y: 50,
        size: 2,
        sensitivity: 1.0,
        shape: 0.5,
        developmentThreshold: 0.5
      };
      
      // Test with exposure above threshold
      const highExposure = 0.8; // Well above threshold
      
      const testProcessor = new TestGrainProcessor(100, 100, settings);
      const strength = testProcessor.testCalculateIntrinsicGrainDensity(highExposure, testGrain);
      
      // Should return significant strength since grain is activated
      expect(strength).toBeGreaterThan(0.1);
      expect(strength).toBeLessThan(2.0); // But not unreasonably high
    });

    it('should show sigmoid activation behavior', () => {
      // Use a grain at position (0,0) to get predictable random sensitivity
      // At (0,0), randomSeed = 0, so randomSensitivity = -0.15
      const testGrain = {
        x: 0,
        y: 0,
        size: 2,
        sensitivity: 1.0,
        shape: 0.5,
        developmentThreshold: 0.3 // Lower threshold to account for negative random sensitivity
      };
      
      const testProcessor = new TestGrainProcessor(100, 100, settings);
      
      // Test multiple exposure levels
      const exposures = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      const strengths = exposures.map(exp => 
        testProcessor.testCalculateIntrinsicGrainDensity(exp, testGrain)
      );
      
      console.log('Exposure vs Strength:', exposures.map((exp, i) => `${exp}: ${strengths[i].toFixed(4)}`));
      
      // Should show sigmoid-like behavior:
      // With randomSensitivity = -0.15 and threshold = 0.3
      // Activation strength = exposure - 0.15
      // So we need exposure >= 0.45 to activate (0.45 - 0.15 = 0.3)
      
      expect(strengths[0]).toBeLessThan(0.1); // 0.3 - below activation (0.3 - 0.15 = 0.15 < 0.3)
      expect(strengths[1]).toBeLessThan(0.1); // 0.4 - below activation (0.4 - 0.15 = 0.25 < 0.3)
      expect(strengths[2]).toBeGreaterThan(0); // 0.5 - above activation (0.5 - 0.15 = 0.35 > 0.3)
      expect(strengths[3]).toBeGreaterThan(strengths[2]); // 0.6 - higher activation
      expect(strengths[4]).toBeGreaterThan(strengths[3]); // 0.7 - even higher
      expect(strengths[5]).toBeGreaterThan(strengths[4]); // 0.8 - highest
      
      // The increase should slow down (sigmoid characteristic)
      const diff1 = strengths[3] - strengths[2]; // 0.5 to 0.6
      const diff2 = strengths[5] - strengths[4]; // 0.7 to 0.8
      expect(diff2).toBeLessThan(diff1 * 2); // Should not be growing linearly
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce consistent results for same grain and exposure', () => {
      const testGrain = {
        x: 30,
        y: 40,
        size: 1.5,
        sensitivity: 0.9,
        shape: 0.3,
        developmentThreshold: 0.6
      };
      
      const testProcessor = new TestGrainProcessor(100, 100, settings);
      
      const exposure = 0.7;
      const strength1 = testProcessor.testCalculateIntrinsicGrainDensity(exposure, testGrain);
      const strength2 = testProcessor.testCalculateIntrinsicGrainDensity(exposure, testGrain);
      
      // Should be exactly the same (deterministic)
      expect(strength1).toBe(strength2);
    });

    it('should produce different results for different grains with same exposure', () => {
      const grain1 = {
        x: 30,
        y: 40,
        size: 1.5,
        sensitivity: 0.9,
        shape: 0.3,
        developmentThreshold: 0.6
      };
      
      const grain2 = {
        x: 70,
        y: 80,
        size: 2.5,
        sensitivity: 1.1,
        shape: 0.7,
        developmentThreshold: 0.4
      };
      
      const testProcessor = new TestGrainProcessor(100, 100, settings);
      
      const exposure = 0.7;
      const strength1 = testProcessor.testCalculateIntrinsicGrainDensity(exposure, grain1);
      const strength2 = testProcessor.testCalculateIntrinsicGrainDensity(exposure, grain2);
      
      // Should be different due to different grain properties
      expect(strength1).not.toBe(strength2);
    });
  });

  describe('Integration with Film Characteristics', () => {
    it('should respect film-specific development parameters', () => {
      const kodakSettings = { ...settings, filmType: 'kodak' as const };
      const ilfordSettings = { ...settings, filmType: 'ilford' as const };
      
      // Create similar grains but with different film types
      const kodakGrain = {
        x: 50, y: 50, size: 2, sensitivity: 1.0, shape: 0.5,
        developmentThreshold: FILM_CHARACTERISTICS.kodak.developmentThreshold.baseSensitivity
      };
      
      const ilfordGrain = {
        x: 50, y: 50, size: 2, sensitivity: 1.0, shape: 0.5,
        developmentThreshold: FILM_CHARACTERISTICS.ilford.developmentThreshold.baseSensitivity
      };
      
      const testKodakProcessor = new TestGrainProcessor(100, 100, kodakSettings);
      const testIlfordProcessor = new TestGrainProcessor(100, 100, ilfordSettings);
      
      // Use a higher exposure to ensure activation despite random sensitivity
      const exposure = 1.0;
      const kodakStrength = testKodakProcessor.testCalculateIntrinsicGrainDensity(exposure, kodakGrain);
      const ilfordStrength = testIlfordProcessor.testCalculateIntrinsicGrainDensity(exposure, ilfordGrain);
      
      console.log(`Kodak: threshold=${kodakGrain.developmentThreshold}, strength=${kodakStrength.toFixed(4)}`);
      console.log(`Ilford: threshold=${ilfordGrain.developmentThreshold}, strength=${ilfordStrength.toFixed(4)}`);
      
      // Both should activate at high exposure
      expect(kodakStrength).toBeGreaterThan(0);
      expect(ilfordStrength).toBeGreaterThan(0);
      
      // Kodak should activate more easily (lower threshold) so should show more strength
      // at the same exposure level
      expect(kodakStrength).toBeGreaterThan(ilfordStrength);
    });
  });
});
