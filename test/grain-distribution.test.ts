import { describe, it, expect, beforeEach } from 'vitest';
import { GrainGenerator } from '../src/grain-generator';
import type { GrainSettings } from '../src/types';

describe('Grain Distribution Bug Tests', () => {
  let settings: GrainSettings;

  beforeEach(() => {
    settings = {
      iso: 400,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1.0
    };
  });

  describe('Distribution Coverage Tests', () => {
    it('should distribute grains across entire image area', () => {
      const generator = new GrainGenerator(400, 300, settings);
      const grains = generator.generateGrainStructure();
      
      // Test that grains are found in all regions of the image
      const regions = {
        topLeft: { minX: 0, maxX: 133, minY: 0, maxY: 100 },
        topCenter: { minX: 133, maxX: 266, minY: 0, maxY: 100 },
        topRight: { minX: 266, maxX: 400, minY: 0, maxY: 100 },
        middleLeft: { minX: 0, maxX: 133, minY: 100, maxY: 200 },
        middleCenter: { minX: 133, maxX: 266, minY: 100, maxY: 200 },
        middleRight: { minX: 266, maxX: 400, minY: 100, maxY: 200 },
        bottomLeft: { minX: 0, maxX: 133, minY: 200, maxY: 300 },
        bottomCenter: { minX: 133, maxX: 266, minY: 200, maxY: 300 },
        bottomRight: { minX: 266, maxX: 400, minY: 200, maxY: 300 }
      };

      const regionCounts = Object.fromEntries(
        Object.keys(regions).map(key => [key, 0])
      );

      for (const grain of grains) {
        for (const [regionName, bounds] of Object.entries(regions)) {
          if (grain.x >= bounds.minX && grain.x < bounds.maxX &&
              grain.y >= bounds.minY && grain.y < bounds.maxY) {
            regionCounts[regionName]++;
          }
        }
      }

      console.log('Grain distribution by region:', regionCounts);
      console.log('Total grains:', grains.length);

      // Each region should have at least some grains
      // This test will fail if grains are clustered in one area
      const emptyRegions = Object.entries(regionCounts)
        .filter(([_, count]) => count === 0)
        .map(([name, _]) => name);

      expect(emptyRegions.length).toBeLessThanOrEqual(2); // Allow max 2 empty regions
      
      // At least 7 out of 9 regions should have grains
      const regionsWithGrains = Object.values(regionCounts).filter(count => count > 0).length;
      expect(regionsWithGrains).toBeGreaterThanOrEqual(7);
    });

    it('should not cluster grains in corner or edge areas', () => {
      const generator = new GrainGenerator(400, 300, settings);
      const grains = generator.generateGrainStructure();
      
      // Define corner and edge regions (10% of image size)
      const cornerSize = 40; // 10% of 400
      const edgeSize = 30; // 10% of 300
      
      let cornerGrains = 0;
      let centerGrains = 0;
      
      for (const grain of grains) {
        const isInCorner = 
          (grain.x < cornerSize && grain.y < edgeSize) || // top-left
          (grain.x > 400 - cornerSize && grain.y < edgeSize) || // top-right
          (grain.x < cornerSize && grain.y > 300 - edgeSize) || // bottom-left
          (grain.x > 400 - cornerSize && grain.y > 300 - edgeSize); // bottom-right
        
        const isInCenter = 
          grain.x > cornerSize * 2 && grain.x < 400 - cornerSize * 2 &&
          grain.y > edgeSize * 2 && grain.y < 300 - edgeSize * 2;
        
        if (isInCorner) cornerGrains++;
        if (isInCenter) centerGrains++;
      }
      
      console.log(`Corner grains: ${cornerGrains}, Center grains: ${centerGrains}, Total: ${grains.length}`);
      
      // Center should have significantly more grains than corners
      expect(centerGrains).toBeGreaterThan(cornerGrains);
      
      // Corner shouldn't have more than 10% of total grains
      expect(cornerGrains / grains.length).toBeLessThan(0.1);
    });

    it('should maintain consistent density across different image sizes', () => {
      const sizes = [
        { width: 200, height: 150 },
        { width: 400, height: 300 },
        { width: 800, height: 600 }
      ];
      
      const densities = sizes.map(size => {
        const generator = new GrainGenerator(size.width, size.height, settings);
        const grains = generator.generateGrainStructure();
        return grains.length / (size.width * size.height);
      });
      
      console.log('Densities by image size:', densities);
      
      // All densities should be similar (within 50% of each other)
      const maxDensity = Math.max(...densities);
      const minDensity = Math.min(...densities);
      
      expect(maxDensity / minDensity).toBeLessThan(1.5);
    });

    it('should generate minimum viable grain count', () => {
      const testCases = [
        { iso: 100, expectedMinGrains: 100 },
        { iso: 400, expectedMinGrains: 500 },
        { iso: 800, expectedMinGrains: 800 },
        { iso: 1600, expectedMinGrains: 1000 }
      ];
      
      for (const testCase of testCases) {
        const generator = new GrainGenerator(400, 300, { ...settings, iso: testCase.iso });
        const grains = generator.generateGrainStructure();
        
        console.log(`ISO ${testCase.iso}: Generated ${grains.length} grains`);
        
        expect(grains.length).toBeGreaterThan(testCase.expectedMinGrains);
      }
    });
  });

  describe('Poisson vs Fallback Behavior', () => {
    it('should trigger fallback when Poisson sampling is insufficient', () => {
      // Create conditions where Poisson sampling will struggle
      const generator = new GrainGenerator(100, 100, { ...settings, iso: 1600 });
      const params = generator.calculateGrainParameters();
      
      console.log('Test parameters:', params);
      
      // Test Poisson sampling directly
      const poissonPoints = generator.generatePoissonDiskSampling(params.minDistance, params.grainDensity);
      console.log(`Poisson generated: ${poissonPoints.length} / ${params.grainDensity} target`);
      
      // Test complete generation (with fallback)
      const allGrains = generator.generateGrainStructure();
      console.log(`Total with fallback: ${allGrains.length}`);
      
      // If fallback is working, total should be much higher than Poisson alone
      if (poissonPoints.length < params.grainDensity * 0.5) {
        expect(allGrains.length).toBeGreaterThan(poissonPoints.length * 2);
      }
      
      // Should still have good distribution
      const analysis = generator.analyzeDistribution(allGrains);
      expect(analysis.quadrants.topLeft).toBeGreaterThan(0);
      expect(analysis.quadrants.topRight).toBeGreaterThan(0);
      expect(analysis.quadrants.bottomLeft).toBeGreaterThan(0);
      expect(analysis.quadrants.bottomRight).toBeGreaterThan(0);
    });

    it('should test fallback grid generation specifically', () => {
      const generator = new GrainGenerator(400, 300, settings);
      const targetCount = 1000;
      
      // Test fallback with no existing grains
      const fallbackGrains = generator.generateFallbackGrains([], targetCount);
      
      console.log(`Fallback generated: ${fallbackGrains.length} for target ${targetCount}`);
      
      expect(fallbackGrains.length).toBeGreaterThanOrEqual(targetCount * 0.9); // Within 10% of target
      
      // Check distribution
      const analysis = generator.analyzeDistribution(fallbackGrains);
      
      console.log('Fallback distribution:', analysis.quadrants);
      
      // Should be well distributed
      const total = fallbackGrains.length;
      const expectedPerQuadrant = total / 4;
      const tolerance = total * 0.3; // 30% tolerance
      
      expect(analysis.quadrants.topLeft).toBeGreaterThan(expectedPerQuadrant - tolerance);
      expect(analysis.quadrants.topRight).toBeGreaterThan(expectedPerQuadrant - tolerance);
      expect(analysis.quadrants.bottomLeft).toBeGreaterThan(expectedPerQuadrant - tolerance);
      expect(analysis.quadrants.bottomRight).toBeGreaterThan(expectedPerQuadrant - tolerance);
    });
  });

  describe('Parameter Validation', () => {
    it('should have reasonable minimum distances', () => {
      const testCases = [
        { iso: 100, width: 400, height: 300 },
        { iso: 400, width: 400, height: 300 },
        { iso: 800, width: 400, height: 300 },
        { iso: 1600, width: 400, height: 300 }
      ];
      
      for (const testCase of testCases) {
        const generator = new GrainGenerator(testCase.width, testCase.height, { ...settings, iso: testCase.iso });
        const params = generator.calculateGrainParameters();
        
        console.log(`ISO ${testCase.iso}: minDistance=${params.minDistance}, grainSize=${params.baseGrainSize}`);
        
        // Min distance should be reasonable relative to image size
        const imageSize = Math.sqrt(testCase.width * testCase.height);
        expect(params.minDistance).toBeLessThan(imageSize / 10); // Less than 10% of image diagonal
        
        // Should not be too small either
        expect(params.minDistance).toBeGreaterThan(0.5);
      }
    });

    it('should have reasonable grain densities', () => {
      const generator = new GrainGenerator(400, 300, settings);
      const params = generator.calculateGrainParameters();
      
      console.log('Grain density parameters:', params);
      
      // Density should be reasonable percentage of image area
      const densityPercentage = params.grainDensity / params.imageArea;
      expect(densityPercentage).toBeGreaterThan(0.001); // At least 0.1%
      expect(densityPercentage).toBeLessThan(0.1); // No more than 10%
      
      // Should scale with ISO
      const highIsoGenerator = new GrainGenerator(400, 300, { ...settings, iso: 800 });
      const highIsoParams = highIsoGenerator.calculateGrainParameters();
      
      // Note: Due to the Math.min cap, very high ISO might not increase density
      if (settings.iso < 1000) {
        expect(highIsoParams.grainDensity).toBeGreaterThanOrEqual(params.grainDensity);
      }
    });
  });
});
