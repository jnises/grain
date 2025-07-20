import { describe, it, expect } from 'vitest';
import { GrainGenerator } from '../src/grain-generator';
import type { GrainSettings } from '../src/types';

/**
 * Tests to validate physically correct film grain behavior.
 * Based on real film physics: Higher ISO films have larger silver halide crystals
 * that are fewer per unit area but provide greater total light-capturing coverage.
 */
describe('Grain Generator Physical Behavior Validation', () => {
  const createTestSettings = (iso: number): GrainSettings => ({
    iso,
    filmType: 'kodak'
  });

  const testImageDimensions = { width: 200, height: 200 }; // Larger test area for better statistical analysis
  const TEST_ISOS = [100, 200, 400, 800, 1600, 3200]; // Range covering common film ISOs

  describe('Physical grain count behavior (CRITICAL)', () => {
    it('should produce FEWER grains as ISO increases', () => {
      const results: Array<{ iso: number; grainCount: number }> = [];

      // Generate grain structures for each ISO
      for (const iso of TEST_ISOS) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        results.push({ iso, grainCount: grains.length });
      }

      // Log results for analysis
      console.log('Physical grain count test results:');
      results.forEach(({ iso, grainCount }) => {
        console.log(`ISO ${iso}: ${grainCount} grains`);
      });

      // Validate that grain count DECREASES as ISO increases
      // This is the core physical requirement: higher ISO = fewer but larger grains
      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i];
        const previousResult = results[i - 1];
        
        // Log the comparison for debugging
        console.log(`  Grain count check: ISO ${previousResult.iso} (${previousResult.grainCount}) vs ISO ${currentResult.iso} (${currentResult.grainCount})`);
        
        expect(currentResult.grainCount).toBeLessThan(previousResult.grainCount);
      }

      // Additional validation: significant difference between extremes
      const lowIsoCount = results[0].grainCount;
      const highIsoCount = results[results.length - 1].grainCount;
      const reductionRatio = highIsoCount / lowIsoCount;
      
      console.log(`  Grain reduction ratio (high/low ISO): ${reductionRatio.toFixed(3)}`);
      expect(reductionRatio).toBeLessThan(0.5);
    });

    it('should show logarithmic grain count reduction with ISO doubling', () => {
      const doublingSeries = [100, 200, 400, 800, 1600]; // Each ISO is 2x the previous
      const grainCounts: number[] = [];

      for (const iso of doublingSeries) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        grainCounts.push(grains.length);
      }

      console.log('ISO doubling series grain counts:');
      doublingSeries.forEach((iso, i) => {
        const reductionFromPrevious = i > 0 ? ((grainCounts[i-1] - grainCounts[i]) / grainCounts[i-1] * 100).toFixed(1) : 'N/A';
        console.log(`ISO ${iso}: ${grainCounts[i]} grains (${reductionFromPrevious}% reduction)`);
      });

      // Each doubling of ISO should result in measurable grain count reduction
      for (let i = 1; i < grainCounts.length; i++) {
        const reductionPercent = (grainCounts[i-1] - grainCounts[i]) / grainCounts[i-1];
        console.log(`  ISO doubling reduction: ${(reductionPercent * 100).toFixed(1)}% (should be > 10%)`);
        expect(reductionPercent).toBeGreaterThan(0.1);
      }
    });
  });

  describe('Physical grain size behavior', () => {
    it('should produce LARGER average grain sizes as ISO increases', () => {
      const results: Array<{ iso: number; averageSize: number; minSize: number; maxSize: number }> = [];

      for (const iso of TEST_ISOS) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        const sizes = grains.map(g => g.size);
        
        results.push({
          iso,
          averageSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
          minSize: Math.min(...sizes),
          maxSize: Math.max(...sizes)
        });
      }

      // Log results for analysis
      console.log('Physical grain size test results:');
      results.forEach(({ iso, averageSize, minSize, maxSize }) => {
        console.log(`ISO ${iso}: avg=${averageSize.toFixed(3)}, min=${minSize.toFixed(3)}, max=${maxSize.toFixed(3)}`);
      });

      // Validate that average grain size INCREASES as ISO increases
      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i];
        const previousResult = results[i - 1];
        
        console.log(`  Size check: ISO ${previousResult.iso} (${previousResult.averageSize.toFixed(3)}) vs ISO ${currentResult.iso} (${currentResult.averageSize.toFixed(3)})`);
        expect(currentResult.averageSize).toBeGreaterThan(previousResult.averageSize);
      }
    });

    it('should show proportional grain size scaling with ISO', () => {
      const baselineIso = 100;
      const testIsos = [200, 400, 800, 1600];
      
      const baselineGenerator = new GrainGenerator(
        testImageDimensions.width, 
        testImageDimensions.height, 
        createTestSettings(baselineIso)
      );
      const baselineGrains = baselineGenerator.generateGrainStructure();
      const baselineAvgSize = baselineGrains.reduce((sum, g) => sum + g.size, 0) / baselineGrains.length;

      console.log(`Baseline (ISO ${baselineIso}): ${baselineAvgSize.toFixed(3)} avg grain size`);

      for (const iso of testIsos) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        const avgSize = grains.reduce((sum, g) => sum + g.size, 0) / grains.length;
        const scalingFactor = avgSize / baselineAvgSize;
        const expectedScaling = Math.sqrt(iso / baselineIso); // Square root scaling is common in optics

        console.log(`ISO ${iso}: ${avgSize.toFixed(3)} avg size, ${scalingFactor.toFixed(2)}x scaling (expected ~${expectedScaling.toFixed(2)}x)`);

        // Grain size should scale meaningfully with ISO
        console.log(`  Scaling check: ${scalingFactor.toFixed(3)} should be > 1.0`);
        expect(scalingFactor).toBeGreaterThan(1.0);
      }
    });
  });

  describe('Physical total coverage behavior', () => {
    it('should produce GREATER total grain coverage area as ISO increases', () => {
      const results: Array<{ iso: number; totalCoverage: number; coveragePercent: number }> = [];

      for (const iso of TEST_ISOS) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        
        // Calculate total coverage area (sum of all grain areas)
        const totalCoverage = grains.reduce((sum, grain) => {
          // Assuming circular grains: area = π * radius²
          const radius = grain.size / 2;
          return sum + Math.PI * radius * radius;
        }, 0);
        
        const imageArea = testImageDimensions.width * testImageDimensions.height;
        const coveragePercent = (totalCoverage / imageArea) * 100;
        
        results.push({ iso, totalCoverage, coveragePercent });
      }

      // Log results for analysis
      console.log('Physical total coverage test results:');
      results.forEach(({ iso, totalCoverage, coveragePercent }) => {
        console.log(`ISO ${iso}: ${totalCoverage.toFixed(0)} px² total coverage (${coveragePercent.toFixed(2)}% of image)`);
      });

      // Validate that total coverage INCREASES as ISO increases
      // This is key: fewer but larger grains should provide more total light-capturing area
      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i];
        const previousResult = results[i - 1];
        
        console.log(`  Coverage check: ISO ${previousResult.iso} (${previousResult.coveragePercent.toFixed(2)}%) vs ISO ${currentResult.iso} (${currentResult.coveragePercent.toFixed(2)}%)`);
        expect(currentResult.totalCoverage).toBeGreaterThan(previousResult.totalCoverage);
      }

      // Additional validation: meaningful coverage increase
      const lowIsoCoverage = results[0].coveragePercent;
      const highIsoCoverage = results[results.length - 1].coveragePercent;
      const coverageIncrease = highIsoCoverage / lowIsoCoverage;
      
      console.log(`  Coverage increase ratio: ${coverageIncrease.toFixed(2)}x`);
      expect(coverageIncrease).toBeGreaterThan(1.5);
    });

    it('should balance grain count reduction with size increase for net coverage gain', () => {
      const lowIso = 100;
      const highIso = 1600;

      const lowIsoGenerator = new GrainGenerator(
        testImageDimensions.width, 
        testImageDimensions.height, 
        createTestSettings(lowIso)
      );
      const highIsoGenerator = new GrainGenerator(
        testImageDimensions.width, 
        testImageDimensions.height, 
        createTestSettings(highIso)
      );

      const lowIsoGrains = lowIsoGenerator.generateGrainStructure();
      const highIsoGrains = highIsoGenerator.generateGrainStructure();

      const lowIsoAvgSize = lowIsoGrains.reduce((sum, g) => sum + g.size, 0) / lowIsoGrains.length;
      const highIsoAvgSize = highIsoGrains.reduce((sum, g) => sum + g.size, 0) / highIsoGrains.length;

      const countRatio = highIsoGrains.length / lowIsoGrains.length; // Should be < 1 (fewer grains)
      const sizeRatio = highIsoAvgSize / lowIsoAvgSize; // Should be > 1 (larger grains)
      const areaRatio = sizeRatio * sizeRatio; // Area scales with size squared
      const coverageRatio = countRatio * areaRatio; // Net coverage change

      console.log(`Coverage balance analysis (ISO ${lowIso} vs ${highIso}):`);
      console.log(`  Grain count ratio: ${countRatio.toFixed(3)} (${lowIsoGrains.length} → ${highIsoGrains.length})`);
      console.log(`  Size ratio: ${sizeRatio.toFixed(3)} (${lowIsoAvgSize.toFixed(3)} → ${highIsoAvgSize.toFixed(3)})`);
      console.log(`  Area ratio: ${areaRatio.toFixed(3)} (size squared)`);
      console.log(`  Net coverage ratio: ${coverageRatio.toFixed(3)}`);

      // The physics requirement: size increase should more than compensate for count decrease
      console.log(`  Coverage should increase: ${coverageRatio.toFixed(3)} > 1.0`);
      expect(coverageRatio).toBeGreaterThan(1.0);
      
      // The size increase should be significant enough to matter
      console.log(`  Grains should be meaningfully larger: ${sizeRatio.toFixed(3)} > 1.5`);
      expect(sizeRatio).toBeGreaterThan(1.5);
        
      // The count should meaningfully decrease
      console.log(`  Grain count should decrease: ${countRatio.toFixed(3)} < 0.8`);
      expect(countRatio).toBeLessThan(0.8);
    });
  });

  describe('Grain size distribution patterns', () => {
    it('should show realistic grain size distribution matching film behavior', () => {
      const iso400Generator = new GrainGenerator(
        testImageDimensions.width, 
        testImageDimensions.height, 
        createTestSettings(400)
      );
      const grains = iso400Generator.generateGrainStructure();
      const sizes = grains.map(g => g.size);
      
      // Calculate distribution statistics
      sizes.sort((a, b) => a - b);
      const median = sizes[Math.floor(sizes.length / 2)];
      const q1 = sizes[Math.floor(sizes.length * 0.25)];
      const q3 = sizes[Math.floor(sizes.length * 0.75)];
      const iqr = q3 - q1;
      const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
      const stdDev = Math.sqrt(sizes.reduce((sum, size) => sum + (size - mean) ** 2, 0) / sizes.length);
      
      console.log(`Grain size distribution at ISO 400 (${grains.length} grains):`);
      console.log(`  Min: ${sizes[0].toFixed(3)}, Q1: ${q1.toFixed(3)}, Median: ${median.toFixed(3)}`);
      console.log(`  Q3: ${q3.toFixed(3)}, Max: ${sizes[sizes.length - 1].toFixed(3)}`);
      console.log(`  Mean: ${mean.toFixed(3)}, Std Dev: ${stdDev.toFixed(3)}, IQR: ${iqr.toFixed(3)}`);
      
      const coefficientOfVariation = stdDev / mean;
      console.log(`  Coefficient of variation: ${coefficientOfVariation.toFixed(3)} (should be > 0.1)`);
      
      // Film grain should show meaningful size variation (not all grains the same size)
      expect(coefficientOfVariation).toBeGreaterThan(0.1);
      
      // Distribution should be reasonably spread (not too tightly clustered)
      const iqrToMedian = iqr / median;
      console.log(`  IQR/Median ratio: ${iqrToMedian.toFixed(3)} (should be > 0.2)`);
      expect(iqrToMedian).toBeGreaterThan(0.2);
      
      // Should not have extreme outliers (realistic physical constraints)
      const outlierThreshold = q3 + 1.5 * iqr;
      const outliers = sizes.filter(size => size > outlierThreshold);
      const outlierPercent = outliers.length / sizes.length;
      console.log(`  Outlier percentage: ${(outlierPercent * 100).toFixed(2)}% (should be < 5%)`);
      expect(outlierPercent).toBeLessThan(0.05);
    });

    it('should show different size distribution characteristics across ISOs', () => {
      const comparisonIsos = [200, 800, 1600];
      const distributions: Array<{
        iso: number;
        mean: number;
        stdDev: number;
        coefficientOfVariation: number;
        range: number;
      }> = [];

      for (const iso of comparisonIsos) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        const sizes = grains.map(g => g.size);
        
        const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
        const stdDev = Math.sqrt(sizes.reduce((sum, size) => sum + (size - mean) ** 2, 0) / sizes.length);
        const coefficientOfVariation = stdDev / mean;
        const range = Math.max(...sizes) - Math.min(...sizes);
        
        distributions.push({
          iso,
          mean,
          stdDev,
          coefficientOfVariation,
          range
        });
      }

      console.log('Size distribution comparison across ISOs:');
      distributions.forEach(({ iso, mean, stdDev, coefficientOfVariation, range }) => {
        console.log(`ISO ${iso}: mean=${mean.toFixed(3)}, stdDev=${stdDev.toFixed(3)}, CV=${coefficientOfVariation.toFixed(3)}, range=${range.toFixed(3)}`);
      });

      // Higher ISO should generally have larger mean sizes
      for (let i = 1; i < distributions.length; i++) {
        console.log(`  Size progression check: ISO ${distributions[i-1].iso} (${distributions[i-1].mean.toFixed(3)}) vs ISO ${distributions[i].iso} (${distributions[i].mean.toFixed(3)})`);
        expect(distributions[i].mean).toBeGreaterThan(distributions[i-1].mean);
      }

      // All ISOs should show reasonable variation
      distributions.forEach(({ iso, coefficientOfVariation }) => {
        console.log(`  ISO ${iso} coefficient of variation: ${coefficientOfVariation.toFixed(3)} (0.1 < CV < 1.0)`);
        expect(coefficientOfVariation).toBeGreaterThan(0.1);
        expect(coefficientOfVariation).toBeLessThan(1.0);
      });
    });
  });

  describe('Edge case validation', () => {
    it('should handle very high ISO values (3200+) correctly', () => {
      const extremeIsos = [3200, 6400, 12800];
      
      for (const iso of extremeIsos) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        
        console.log(`Extreme ISO ${iso}: ${grains.length} grains, avg size ${(grains.reduce((sum, g) => sum + g.size, 0) / grains.length).toFixed(3)}`);
        
        // Even at extreme ISOs, should produce some grains
        console.log(`  Should produce grains: ${grains.length} > 0`);
        expect(grains.length).toBeGreaterThan(0);
        
        // Grains should be reasonably large at high ISO
        const avgSize = grains.reduce((sum, g) => sum + g.size, 0) / grains.length;
        console.log(`  Should produce large grains: ${avgSize.toFixed(3)} > 5.0`);
        expect(avgSize).toBeGreaterThan(5.0);
        
        // Should not have excessive numbers of grains at extreme ISO
        const imageArea = testImageDimensions.width * testImageDimensions.height;
        const grainDensity = grains.length / imageArea;
        console.log(`  Should have low density: ${grainDensity.toFixed(6)} < 0.1`);
        expect(grainDensity).toBeLessThan(0.1);
      }
    });

    it('should handle very low ISO values (25-50) correctly', () => {
      const lowIsos = [25, 50];
      
      for (const iso of lowIsos) {
        const generator = new GrainGenerator(
          testImageDimensions.width, 
          testImageDimensions.height, 
          createTestSettings(iso)
        );
        const grains = generator.generateGrainStructure();
        
        console.log(`Low ISO ${iso}: ${grains.length} grains, avg size ${(grains.reduce((sum, g) => sum + g.size, 0) / grains.length).toFixed(3)}`);
        
        // Low ISO should produce many small grains
        console.log(`  Should produce many grains: ${grains.length} > 100`);
        expect(grains.length).toBeGreaterThan(100);
        
        // Grains should be small at low ISO
        const avgSize = grains.reduce((sum, g) => sum + g.size, 0) / grains.length;
        console.log(`  Should produce small grains: ${avgSize.toFixed(3)} < 2.0`);
        expect(avgSize).toBeLessThan(2.0);
      }
    });
  });
});
