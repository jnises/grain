// Test file to verify the new grain compositing features

import { GrainGenerator } from '../src/grain-generator';
import type { GrainSettings, GrainLayer } from '../src/types';

describe('Multiple Grain Layers', () => {
  const settings: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
    grainIntensity: 1.0,
    upscaleFactor: 1,
    useMultipleLayers: true,
    useDensityModel: true
  };

  const generator = new GrainGenerator(800, 600, settings);

  test('should generate multiple grain layers with different characteristics', () => {
    const layers = generator.generateMultipleGrainLayers();
    
    expect(layers).toHaveLength(3);
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
    
    expect(layers[0].density).not.toBe(layers[1].density);
    expect(layers[1].density).not.toBe(layers[2].density);
  });

  test('should have different intensity multipliers for each layer', () => {
    const layers = generator.generateMultipleGrainLayers();
    
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
    
    expect(Array.isArray(grains)).toBe(true);
    expect(grains.length).toBeGreaterThan(0);
    
    // Should be GrainPoint[] not GrainLayer[]
    if (grains.length > 0) {
      expect('layerType' in grains[0]).toBe(false);
      expect('x' in grains[0]).toBe(true);
      expect('y' in grains[0]).toBe(true);
    }
  });
});
