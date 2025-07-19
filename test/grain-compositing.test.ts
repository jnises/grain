// Test file to verify grain structure generation and variable grain sizes
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, test, expect } from 'vitest';
import { GrainGenerator } from '../src/grain-generator';
import type { GrainSettings } from '../src/types';
import { assert, assertObject } from '../src/utils';

describe('Variable Grain Size Generation', () => {
  const settings: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
    grainIntensity: 1.0,
    upscaleFactor: 1
  };

  const generator = new GrainGenerator(400, 300, settings); // Reduced from 800x600

  describe('Error Handling', () => {
    it('should validate generator construction', () => {
      expect(() => new GrainGenerator(0, 600, settings)).toThrow(/width must be a positive integer/);
      expect(() => new GrainGenerator(800, 0, settings)).toThrow(/height must be a positive integer/);
      expect(() => new GrainGenerator(800, 600, null as any)).toThrow(/settings must be.*object/);
    });
  });

  test('should generate grains with variable sizes', { timeout: 10000 }, () => {
    const grains = generator.generateGrainStructure();
    
    // Validate the result structure
    assert(Array.isArray(grains), 'Grains must be an array', { grains });
    expect(grains.length).toBeGreaterThan(0);
    
    // Validate each grain structure
    for (const grain of grains) {
      assertObject(grain, 'Grain must be an object');
      assert(typeof grain.x === 'number', 'Grain x must be a number', { grain });
      assert(typeof grain.y === 'number', 'Grain y must be a number', { grain });
      assert(typeof grain.size === 'number' && grain.size > 0, 'Grain size must be positive', { grain });
      assert(typeof grain.sensitivity === 'number' && grain.sensitivity > 0, 'Grain sensitivity must be positive', { grain });
    }
    
    // Check that we have variable grain sizes
    const sizes = grains.map(g => g.size);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    
    expect(maxSize).toBeGreaterThan(minSize);
  });

  test('should have size variation within expected range', { timeout: 10000 }, () => {
    const grains = generator.generateGrainStructure();
    
    // Validate structure before analyzing
    assert(Array.isArray(grains) && grains.length > 0, 'Need grains to analyze', { grains });
    
    const sizes = grains.map(g => g.size);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    // Check that size variation is reasonable
    expect(minSize).toBeGreaterThan(0);
    expect(maxSize).toBeGreaterThan(minSize);
    expect(avgSize).toBeGreaterThan(minSize);
    expect(avgSize).toBeLessThan(maxSize);
    
    // Most grains should be smaller (due to distribution bias)
    const smallGrains = sizes.filter(size => size <= avgSize).length;
    const largeGrains = sizes.filter(size => size > avgSize).length;
    expect(smallGrains).toBeGreaterThanOrEqual(largeGrains);
  });

  test('should generate grains with proper distribution', { timeout: 10000 }, () => {
    const grains = generator.generateGrainStructure();
    
    // Validate minimum grain count based on settings
    expect(grains.length).toBeGreaterThan(100); // Should generate reasonable number of grains
    
    // Check grain positions are within canvas bounds
    for (const grain of grains) {
      expect(grain.x).toBeGreaterThanOrEqual(0);
      expect(grain.x).toBeLessThan(800);
      expect(grain.y).toBeGreaterThanOrEqual(0);
      expect(grain.y).toBeLessThan(600);
    }
  });
});

describe('Grain Structure Properties', () => {
  test('should generate consistent grain properties', () => {
    const settings: GrainSettings = {
      iso: 400,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1
    };

    const generator = new GrainGenerator(800, 600, settings);
    const grains = generator.generateGrainStructure();
    
    // Validate result structure
    assert(Array.isArray(grains), 'Grains must be an array', { grains });
    expect(grains.length).toBeGreaterThan(0);
    
    // Validate grain properties
    if (grains.length > 0) {
      const firstGrain = grains[0];
      assertObject(firstGrain, 'Grain must be an object');
      
      // Should have standard grain properties, not layer properties
      expect('x' in firstGrain).toBe(true);
      expect('y' in firstGrain).toBe(true);
      expect('size' in firstGrain).toBe(true);
      expect('sensitivity' in firstGrain).toBe(true);
      
      // Should not have layer-specific properties
      expect('layerType' in firstGrain).toBe(false);
      expect('intensityMultiplier' in firstGrain).toBe(false);
      
      // Validate grain property types and ranges
      assert(typeof firstGrain.x === 'number', 'Grain x must be a number', { firstGrain });
      assert(typeof firstGrain.y === 'number', 'Grain y must be a number', { firstGrain });
      assert(typeof firstGrain.size === 'number', 'Grain size must be a number', { firstGrain });
      assert(typeof firstGrain.sensitivity === 'number', 'Grain sensitivity must be a number', { firstGrain });
    }
  });
});
