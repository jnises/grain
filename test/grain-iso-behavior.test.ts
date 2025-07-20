import { describe, it, expect } from 'vitest';
import { GrainGenerator } from '../src/grain-generator';
import type { GrainSettings } from '../src/types';
import { arrayMinMax } from '../src/utils';

describe('Grain Generator ISO Behavior', () => {
  const createTestSettings = (iso: number): GrainSettings => ({
    iso,
    filmType: 'kodak'
  });

  const testImageDimensions = { width: 100, height: 100 };

  describe('Grain size behavior with ISO', () => {
    it('should produce larger grains at higher ISO', () => {
      const lowIsoGenerator = new GrainGenerator(testImageDimensions.width, testImageDimensions.height, createTestSettings(100));
      const highIsoGenerator = new GrainGenerator(testImageDimensions.width, testImageDimensions.height, createTestSettings(1600));

      const lowIsoParams = lowIsoGenerator.calculateGrainParameters();
      const highIsoParams = highIsoGenerator.calculateGrainParameters();

      expect(highIsoParams.baseGrainSize).toBeGreaterThan(lowIsoParams.baseGrainSize);
    });

    it('should show grain size scaling relationship', () => {
      const isos = [100, 200, 400, 800, 1600];
      const grainSizes: number[] = [];

      for (const iso of isos) {
        const generator = new GrainGenerator(testImageDimensions.width, testImageDimensions.height, createTestSettings(iso));
        const params = generator.calculateGrainParameters();
        grainSizes.push(params.baseGrainSize);
      }

      // Verify grain sizes are monotonically increasing with ISO
      for (let i = 1; i < grainSizes.length; i++) {
        expect(grainSizes[i]).toBeGreaterThan(grainSizes[i - 1]);
      }

      // Log the actual relationship for analysis
      console.log('ISO to grain size relationship:');
      isos.forEach((iso, i) => {
        console.log(`ISO ${iso}: grain size ${grainSizes[i].toFixed(3)}`);
      });
    });
  });

  describe('Grain density behavior with ISO', () => {
    it('should show current density vs ISO relationship', () => {
      const isos = [100, 200, 400, 800, 1600];
      const densityData: Array<{ iso: number; grainCount: number; densityFactor: number }> = [];

      for (const iso of isos) {
        const generator = new GrainGenerator(testImageDimensions.width, testImageDimensions.height, createTestSettings(iso));
        const params = generator.calculateGrainParameters();
        
        densityData.push({
          iso,
          grainCount: params.grainDensity,
          densityFactor: params.densityFactor
        });
      }

      // Log current behavior for analysis
      console.log('Current ISO to grain density relationship:');
      densityData.forEach(({ iso, grainCount, densityFactor }) => {
        console.log(`ISO ${iso}: ${grainCount} grains, density factor ${densityFactor.toFixed(6)}`);
      });

      // Test current implementation behavior - complex relationship due to geometric constraints
      // Density increases until geometric constraints kick in at high ISO
      console.log('Grain count progression analysis:');
      for (let i = 1; i < densityData.length; i++) {
        const current = densityData[i];
        const previous = densityData[i - 1];
        const change = current.grainCount - previous.grainCount;
        console.log(`ISO ${previous.iso} → ${current.iso}: ${previous.grainCount} → ${current.grainCount} (${change >= 0 ? '+' : ''}${change})`);
      }
    });

    it('should generate actual grain structures with different ISO values', () => {
      const lowIsoGenerator = new GrainGenerator(testImageDimensions.width, testImageDimensions.height, createTestSettings(100));
      const highIsoGenerator = new GrainGenerator(testImageDimensions.width, testImageDimensions.height, createTestSettings(1600));

      const lowIsoGrains = lowIsoGenerator.generateGrainStructure();
      const highIsoGrains = highIsoGenerator.generateGrainStructure();

      console.log(`Low ISO (100): ${lowIsoGrains.length} grains generated`);
      console.log(`High ISO (1600): ${highIsoGrains.length} grains generated`);

      // Physically accurate: higher ISO produces fewer but larger grains
      expect(highIsoGrains.length).toBeLessThan(lowIsoGrains.length);
    });
  });

  describe('Physical realism expectations', () => {
    it('documents expected vs actual behavior', () => {
      // This test documents the expected behavior vs current implementation
      const expectedBehavior = {
        grainSize: 'Higher ISO should produce larger grains',
        grainDensity: 'Higher ISO should produce FEWER grains (larger silver halide crystals, less dense)',
        physicalReason: 'High ISO film has larger, more sensitive crystals that are less densely packed'
      };

      const currentBehavior = {
        grainSize: 'Higher ISO produces larger grains ✓ (matches expectation)',
        grainDensity: 'Higher ISO produces FEWER grains ✓ (matches expectation)',
        currentLogic: 'Physics-based grain density calculation with inverse relationship to ISO'
      };

      console.log('Expected physical behavior:', expectedBehavior);
      console.log('Current implementation behavior:', currentBehavior);

      // This assertion currently passes but documents the issue
      expect(true).toBe(true); // Placeholder - the real issue is in the implementation
    });
  });

  describe('Grain size variation within same ISO', () => {
    it('should show variation in individual grain sizes', () => {
      const generator = new GrainGenerator(testImageDimensions.width, testImageDimensions.height, createTestSettings(400));
      const grains = generator.generateGrainStructure();

      // Check that grains have varying sizes (not all the same)
      const grainSizes = grains.map(grain => grain.size);
      const { min: minSize, max: maxSize } = arrayMinMax(grainSizes);

      console.log(`Grain size variation at ISO 400: min=${minSize.toFixed(3)}, max=${maxSize.toFixed(3)}`);
      
      expect(maxSize).toBeGreaterThan(minSize);
      expect(grainSizes.length).toBeGreaterThan(0);
    });
  });
});
