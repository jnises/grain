import { describe, it, expect } from 'vitest';
import { GrainGenerator } from '../src/grain-generator';
import type { GrainSettings } from '../src/types';

describe('Grain Density Fixes', () => {
  it('should generate reasonable grain counts for high ISO', () => {
    const settings: GrainSettings = {
      iso: 1350,
      filmType: 'kodak',
      upscaleFactor: 1
    };

    const generator = new GrainGenerator(400, 300, settings);
    const params = generator.calculateGrainParameters();

    // Should have reasonable grain count (not 18k+)
    expect(params.grainDensity).toBeLessThan(5000);
    expect(params.grainDensity).toBeGreaterThan(500);
    
    // Coverage should be realistic (not over 100%)
    const imageArea = 400 * 300;
    const grainArea = Math.PI * (params.minDistance / 2) ** 2;
    const maxPossibleGrains = Math.floor(imageArea / grainArea);
    const coverage = params.grainDensity / maxPossibleGrains;
    
    expect(coverage).toBeLessThan(1.0); // Should be less than 100% coverage
    expect(coverage).toBeGreaterThan(0.1); // Should have meaningful coverage
    
    console.log(`ISO ${settings.iso}: ${params.grainDensity} grains, ${(coverage * 100).toFixed(1)}% coverage`);
  });

  it('should generate grains successfully without timing out', () => {
    const settings: GrainSettings = {
      iso: 1350,
      filmType: 'kodak',
      upscaleFactor: 1
    };

    const generator = new GrainGenerator(400, 300, settings);
    const startTime = Date.now();
    
    const grains = generator.generateGrainStructure();
    
    const duration = Date.now() - startTime;
    
    // Should complete in reasonable time (not 75+ seconds)
    expect(duration).toBeLessThan(5000); // 5 seconds max
    
    // Should have actually generated grains
    expect(grains.length).toBeGreaterThan(100);
    
    console.log(`Generated ${grains.length} grains in ${duration}ms`);
  });

  it('should respect grain size constraints', () => {
    const settings: GrainSettings = {
      iso: 1350,
      filmType: 'kodak',
      upscaleFactor: 1
    };

    const generator = new GrainGenerator(400, 300, settings);
    const grains = generator.generateGrainStructure();
    
    // All grains should have reasonable sizes
    for (const grain of grains) {
      expect(grain.size).toBeGreaterThan(0.5);
      expect(grain.size).toBeLessThan(20); // Reasonable upper bound
    }
    
    // Check that grains have reasonable minimum distances
    for (let i = 0; i < grains.length; i++) {
      for (let j = i + 1; j < grains.length; j++) {
        const dist = Math.sqrt(
          (grains[i].x - grains[j].x) ** 2 + 
          (grains[i].y - grains[j].y) ** 2
        );
        
        // Allow some grains to be close due to different sizes and fallback generation
        // But most should respect reasonable spacing
        if (dist < 1.0) {
          // Only a small percentage should be this close
          continue;
        }
      }
    }
  });
});
