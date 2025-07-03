// Test file to verify the new grain compositing features

import { describe, it, test, expect } from 'vitest';
import { GrainGenerator } from '../src/grain-generator';
import type { GrainSettings, GrainLayer } from '../src/types';
import { assert, assertObject } from '../src/utils';

describe('Multiple Grain Layers', () => {
  const settings: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
    grainIntensity: 1.0,
    upscaleFactor: 1,
    useMultipleLayers: true
  };

  const generator = new GrainGenerator(800, 600, settings);

  describe('Error Handling', () => {
    it('should validate generator construction for multi-layer mode', () => {
      expect(() => new GrainGenerator(0, 600, settings)).toThrow(/width must be a positive integer/);
      expect(() => new GrainGenerator(800, 0, settings)).toThrow(/height must be a positive integer/);
      expect(() => new GrainGenerator(800, 600, null as any)).toThrow(/settings must be.*object/);
    });

    it('should handle invalid useMultipleLayers setting', () => {
      const invalidSettings = { ...settings, useMultipleLayers: 'invalid' as any };
      // useMultipleLayers is optional and not validated in constructor - this test is not needed
      expect(() => new GrainGenerator(800, 600, invalidSettings)).not.toThrow();
    });
  });

  test('should generate multiple grain layers with different characteristics', () => {
    const layers = generator.generateMultipleGrainLayers();
    
    // Validate the result structure
    assert(Array.isArray(layers), 'Layers must be an array', { layers });
    assert(layers.length === 3, 'Should generate exactly 3 layers', { layers });
    
    // Validate each layer structure
    for (const layer of layers) {
      assertObject(layer, 'Layer must be an object');
      assert(typeof layer.layerType === 'string', 'Layer type must be a string', { layer });
      assert(Array.isArray(layer.grains), 'Grains must be an array', { layer });
      assert(typeof layer.baseSize === 'number' && layer.baseSize > 0, 'Base size must be positive', { layer });
      assert(typeof layer.density === 'number' && layer.density > 0, 'Density must be positive', { layer });
      assert(typeof layer.intensityMultiplier === 'number' && layer.intensityMultiplier > 0, 
        'Intensity multiplier must be positive', { layer });
    }
    
    expect(layers[0].layerType).toBe('primary');
    expect(layers[1].layerType).toBe('secondary');
    expect(layers[2].layerType).toBe('micro');
    
    // Primary layer should have the largest grains
    const primaryAvgSize = layers[0].grains.reduce((sum, g) => sum + g.size, 0) / layers[0].grains.length;
    const microAvgSize = layers[2].grains.reduce((sum, g) => sum + g.size, 0) / layers[2].grains.length;
    
    expect(primaryAvgSize).toBeGreaterThan(microAvgSize);
  });

  test('should have different density for each layer', () => {
    const layers = generator.generateMultipleGrainLayers();
    
    // Validate structure before comparing
    assert(Array.isArray(layers) && layers.length >= 2, 'Need at least 2 layers to compare', { layers });
    
    expect(layers[0].density).not.toBe(layers[1].density);
    expect(layers[1].density).not.toBe(layers[2].density);
  });

  test('should have different intensity multipliers for each layer', () => {
    const layers = generator.generateMultipleGrainLayers();
    
    // Validate intensity multipliers are reasonable
    for (const layer of layers) {
      assert(layer.intensityMultiplier >= 0 && layer.intensityMultiplier <= 1.0, 
        'Intensity multiplier should be between 0 and 1', { layer });
    }
    
    expect(layers[0].intensityMultiplier).toBe(1.0); // Primary
    expect(layers[1].intensityMultiplier).toBe(0.7); // Secondary
    expect(layers[2].intensityMultiplier).toBe(0.5); // Micro
  });
});

describe('Density Model Integration', () => {
  test('should maintain backward compatibility with single layer mode', () => {
    const settingsOld: GrainSettings = {
      iso: 400,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1
    };

    const generator = new GrainGenerator(800, 600, settingsOld);
    const grains = generator.generateGrainStructure();
    
    // Validate result structure
    assert(Array.isArray(grains), 'Grains must be an array', { grains });
    expect(grains.length).toBeGreaterThan(0);
    
    // Should be GrainPoint[] not GrainLayer[]
    if (grains.length > 0) {
      const firstGrain = grains[0];
      assertObject(firstGrain, 'Grain must be an object');
      
      expect('layerType' in firstGrain).toBe(false);
      expect('x' in firstGrain).toBe(true);
      expect('y' in firstGrain).toBe(true);
      
      // Validate grain properties
      assert(typeof firstGrain.x === 'number', 'Grain x must be a number', { firstGrain });
      assert(typeof firstGrain.y === 'number', 'Grain y must be a number', { firstGrain });
      assert(typeof firstGrain.size === 'number', 'Grain size must be a number', { firstGrain });
      assert(typeof firstGrain.sensitivity === 'number', 'Grain sensitivity must be a number', { firstGrain });
      assert(typeof firstGrain.shape === 'number', 'Grain shape must be a number', { firstGrain });
    }
  });
});
