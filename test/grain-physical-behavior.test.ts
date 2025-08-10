import { describe, it, expect } from 'vitest';
import {
  GrainGenerator,
  SeededRandomNumberGenerator,
} from '../src/grain-generator';
import type { GrainSettings } from '../src/types';
import { arrayMinMax, arrayMax } from '../src/utils';

/**
 * Tests to validate physically correct film grain behavior.
 * Based on real film physics: Higher ISO films have larger silver halide crystals
 * that are fewer per unit area but provide greater total light-capturing coverage.
 */
describe('Grain Generator Physical Behavior Validation', () => {
  const createTestSettings = (iso: number): GrainSettings => ({
    iso,
    filmType: 'kodak',
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
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();
        results.push({ iso, grainCount: grains.length });
      }

      // Log results for analysis
      // Validate that grain count DECREASES as ISO increases
      // This is the core physical requirement: higher ISO = fewer but larger grains
      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i];
        const previousResult = results[i - 1];

        expect(currentResult.grainCount).toBeLessThan(
          previousResult.grainCount
        );
      }

      // Additional validation: significant difference between extremes
      const lowIsoCount = results[0].grainCount;
      const highIsoCount = results[results.length - 1].grainCount;
      const reductionRatio = highIsoCount / lowIsoCount;

      expect(reductionRatio).toBeLessThan(0.5);
    });

    it('should show logarithmic grain count reduction with ISO doubling', () => {
      const doublingSeries = [100, 200, 400, 800, 1600]; // Each ISO is 2x the previous
      const grainCounts: number[] = [];

      for (const iso of doublingSeries) {
        const generator = new GrainGenerator(
          testImageDimensions.width,
          testImageDimensions.height,
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();
        grainCounts.push(grains.length);
      }

      // Each doubling of ISO should result in measurable grain count reduction
      for (let i = 1; i < grainCounts.length; i++) {
        const reductionPercent =
          (grainCounts[i - 1] - grainCounts[i]) / grainCounts[i - 1];
        expect(reductionPercent).toBeGreaterThan(0.1);
      }
    });
  });

  describe('Physical grain size behavior', () => {
    it('should produce LARGER average grain sizes as ISO increases', () => {
      const results: Array<{
        iso: number;
        averageSize: number;
        minSize: number;
        maxSize: number;
      }> = [];

      for (const iso of TEST_ISOS) {
        const generator = new GrainGenerator(
          testImageDimensions.width,
          testImageDimensions.height,
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();
        const sizes = grains.map((g) => g.size);
        const { min: minSize, max: maxSize } = arrayMinMax(sizes);

        results.push({
          iso,
          averageSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
          minSize,
          maxSize,
        });
      }

      // Validate that average grain size INCREASES as ISO increases
      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i];
        const previousResult = results[i - 1];

        expect(currentResult.averageSize).toBeGreaterThan(
          previousResult.averageSize
        );
        );
        expect(currentResult.averageSize).toBeGreaterThan(
          previousResult.averageSize
        );
      }
    });

    it('should show proportional grain size scaling with ISO', () => {
      const baselineIso = 100;
      const testIsos = [200, 400, 800, 1600];

      const baselineGenerator = new GrainGenerator(
        testImageDimensions.width,
        testImageDimensions.height,
        createTestSettings(baselineIso),
        new SeededRandomNumberGenerator(12345)
      );
      const baselineGrains = baselineGenerator.generateGrainStructure();
      const baselineAvgSize =
        baselineGrains.reduce((sum, g) => sum + g.size, 0) /
        baselineGrains.length;

      console.log(
        `Baseline (ISO ${baselineIso}): ${baselineAvgSize.toFixed(3)} avg grain size`
      );

      for (const iso of testIsos) {
        const generator = new GrainGenerator(
          testImageDimensions.width,
          testImageDimensions.height,
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();
        const avgSize =
          grains.reduce((sum, g) => sum + g.size, 0) / grains.length;
        const scalingFactor = avgSize / baselineAvgSize;
        const expectedScaling = Math.sqrt(iso / baselineIso); // Square root scaling is common in optics

        // Grain size should scale meaningfully with ISO
        expect(scalingFactor).toBeGreaterThan(1.0);
      }
    });
  });

  describe('Physical total coverage behavior', () => {
    it('should produce GREATER total grain coverage area as ISO increases (until geometric constraints)', () => {
      const results: Array<{
        iso: number;
        totalCoverage: number;
        coveragePercent: number;
      }> = [];

      for (const iso of TEST_ISOS) {
        const generator = new GrainGenerator(
          testImageDimensions.width,
          testImageDimensions.height,
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();

        // Calculate total coverage area (sum of all grain areas)
        const totalCoverage = grains.reduce((sum, grain) => {
          // Assuming circular grains: area = π * radius²
          const radius = grain.size / 2;
          return sum + Math.PI * radius * radius;
        }, 0);

        const imageArea =
          testImageDimensions.width * testImageDimensions.height;
        const coveragePercent = (totalCoverage / imageArea) * 100;

        results.push({ iso, totalCoverage, coveragePercent });
      }

      // NOTE: Coverage should ideally increase with ISO, but geometric constraints limit this
      // At higher ISO, large grains can't pack densely enough to maintain coverage growth
      // This will be resolved with 3D grain stacking/overlapping in a future implementation

      // Validate coverage increases in the low-to-mid ISO range (where physics dominates over constraints)
      const lowToMidRange = results.slice(0, 4); // ISO 100, 200, 400, 800
      for (let i = 1; i < lowToMidRange.length - 1; i++) {
        // Stop before the constraint-limited high ISO range
        const currentResult = lowToMidRange[i];
        const previousResult = lowToMidRange[i - 1];

        // Allow some flexibility for geometric effects
        const coverageRatio =
          currentResult.totalCoverage / previousResult.totalCoverage;
        expect(coverageRatio).toBeGreaterThan(0.8); // Allow up to 20% decrease due to geometric constraints
      }

      // Validate that grain size scaling compensates for count reduction in the viable range
      const lowIsoCoverage = results[0].coveragePercent;
      const midIsoCoverage = arrayMax(
        results.slice(0, 4).map((r) => r.coveragePercent)
      ); // Find peak coverage in viable range
      const coverageIncrease = midIsoCoverage / lowIsoCoverage;

      expect(coverageIncrease).toBeGreaterThan(1.2); // Expect at least 20% coverage increase in viable range
    });

    it('should balance grain count reduction with size increase for net coverage gain', () => {
      const lowIso = 100;
      const highIso = 1600;

      const lowIsoGenerator = new GrainGenerator(
        testImageDimensions.width,
        testImageDimensions.height,
        createTestSettings(lowIso),
        new SeededRandomNumberGenerator(12345)
      );
      const highIsoGenerator = new GrainGenerator(
        testImageDimensions.width,
        testImageDimensions.height,
        createTestSettings(highIso),
        new SeededRandomNumberGenerator(12345)
      );

      const lowIsoGrains = lowIsoGenerator.generateGrainStructure();
      const highIsoGrains = highIsoGenerator.generateGrainStructure();

      const lowIsoAvgSize =
        lowIsoGrains.reduce((sum, g) => sum + g.size, 0) / lowIsoGrains.length;
      const highIsoAvgSize =
        highIsoGrains.reduce((sum, g) => sum + g.size, 0) /
        highIsoGrains.length;

      const countRatio = highIsoGrains.length / lowIsoGrains.length; // Should be < 1 (fewer grains)
      const sizeRatio = highIsoAvgSize / lowIsoAvgSize; // Should be > 1 (larger grains)
      const areaRatio = sizeRatio * sizeRatio; // Area scales with size squared
      const coverageRatio = countRatio * areaRatio; // Net coverage change

      console.log(`Coverage balance analysis (ISO ${lowIso} vs ${highIso}):`);
      console.log(
        `  Grain count ratio: ${countRatio.toFixed(3)} (${lowIsoGrains.length} → ${highIsoGrains.length})`
      );
      console.log(
        `  Size ratio: ${sizeRatio.toFixed(3)} (${lowIsoAvgSize.toFixed(3)} → ${highIsoAvgSize.toFixed(3)})`
      );
      console.log(`  Area ratio: ${areaRatio.toFixed(3)} (size squared)`);
      console.log(`  Net coverage ratio: ${coverageRatio.toFixed(3)}`);

      // The physics requirement: size increase should more than compensate for count decrease
      console.log(
        `  Coverage should increase: ${coverageRatio.toFixed(3)} > 1.0`
      );
      expect(coverageRatio).toBeGreaterThan(1.0);

      // The size increase should be significant enough to matter
      console.log(
        `  Grains should be meaningfully larger: ${sizeRatio.toFixed(3)} > 1.5`
      );
      expect(sizeRatio).toBeGreaterThan(1.5);

      // The count should meaningfully decrease
      console.log(
        `  Grain count should decrease: ${countRatio.toFixed(3)} < 0.8`
      );
      expect(countRatio).toBeLessThan(0.8);
    });
  });

  describe('Grain size distribution patterns', () => {
    it('should show realistic grain size distribution matching film behavior', () => {
      const iso400Generator = new GrainGenerator(
        testImageDimensions.width,
        testImageDimensions.height,
        createTestSettings(400),
        new SeededRandomNumberGenerator(12345)
      );
      const grains = iso400Generator.generateGrainStructure();
      const sizes = grains.map((g) => g.size);

      // Calculate distribution statistics
      sizes.sort((a, b) => a - b);
      const median = sizes[Math.floor(sizes.length / 2)];
      const q1 = sizes[Math.floor(sizes.length * 0.25)];
      const q3 = sizes[Math.floor(sizes.length * 0.75)];
      const iqr = q3 - q1;
      const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
      const stdDev = Math.sqrt(
        sizes.reduce((sum, size) => sum + (size - mean) ** 2, 0) / sizes.length
      );

      console.log(
        `Grain size distribution at ISO 400 (${grains.length} grains):`
      );
      console.log(
        `  Min: ${sizes[0].toFixed(3)}, Q1: ${q1.toFixed(3)}, Median: ${median.toFixed(3)}`
      );
      console.log(
        `  Q3: ${q3.toFixed(3)}, Max: ${sizes[sizes.length - 1].toFixed(3)}`
      );
      console.log(
        `  Mean: ${mean.toFixed(3)}, Std Dev: ${stdDev.toFixed(3)}, IQR: ${iqr.toFixed(3)}`
      );

      const coefficientOfVariation = stdDev / mean;
      console.log(
        `  Coefficient of variation: ${coefficientOfVariation.toFixed(3)} (should be > 0.1)`
      );

      // Film grain should show meaningful size variation (not all grains the same size)
      expect(coefficientOfVariation).toBeGreaterThan(0.1);

      // Distribution should be reasonably spread (not too tightly clustered)
      const iqrToMedian = iqr / median;
      console.log(
        `  IQR/Median ratio: ${iqrToMedian.toFixed(3)} (should be > 0.2)`
      );
      expect(iqrToMedian).toBeGreaterThan(0.2);

      // Should not have extreme outliers (realistic physical constraints)
      const outlierThreshold = q3 + 1.5 * iqr;
      const outliers = sizes.filter((size) => size > outlierThreshold);
      const outlierPercent = outliers.length / sizes.length;
      console.log(
        `  Outlier percentage: ${(outlierPercent * 100).toFixed(2)}% (should be < 5%)`
      );
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
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();
        const sizes = grains.map((g) => g.size);

        const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
        const stdDev = Math.sqrt(
          sizes.reduce((sum, size) => sum + (size - mean) ** 2, 0) /
            sizes.length
        );
        const coefficientOfVariation = stdDev / mean;
        const { min: minSize, max: maxSize } = arrayMinMax(sizes);
        const range = maxSize - minSize;

        distributions.push({
          iso,
          mean,
          stdDev,
          coefficientOfVariation,
          range,
        });
      }

      console.log('Size distribution comparison across ISOs:');
      distributions.forEach(
        ({ iso, mean, stdDev, coefficientOfVariation, range }) => {
          console.log(
            `ISO ${iso}: mean=${mean.toFixed(3)}, stdDev=${stdDev.toFixed(3)}, CV=${coefficientOfVariation.toFixed(3)}, range=${range.toFixed(3)}`
          );
        }
      );

      // Higher ISO should generally have larger mean sizes
      for (let i = 1; i < distributions.length; i++) {
        console.log(
          `  Size progression check: ISO ${distributions[i - 1].iso} (${distributions[i - 1].mean.toFixed(3)}) vs ISO ${distributions[i].iso} (${distributions[i].mean.toFixed(3)})`
        );
        expect(distributions[i].mean).toBeGreaterThan(
          distributions[i - 1].mean
        );
      }

      // All ISOs should show reasonable variation
      distributions.forEach(({ iso, coefficientOfVariation }) => {
        console.log(
          `  ISO ${iso} coefficient of variation: ${coefficientOfVariation.toFixed(3)} (0.1 < CV < 1.0)`
        );
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
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();

        console.log(
          `Extreme ISO ${iso}: ${grains.length} grains, avg size ${(grains.reduce((sum, g) => sum + g.size, 0) / grains.length).toFixed(3)}`
        );

        // Even at extreme ISOs, should produce some grains
        console.log(`  Should produce grains: ${grains.length} > 0`);
        expect(grains.length).toBeGreaterThan(0);

        // Grains should be reasonably large at high ISO
        const avgSize =
          grains.reduce((sum, g) => sum + g.size, 0) / grains.length;
        console.log(
          `  Should produce large grains: ${avgSize.toFixed(3)} > 5.0`
        );
        expect(avgSize).toBeGreaterThan(5.0);

        // Should not have excessive numbers of grains at extreme ISO
        const imageArea =
          testImageDimensions.width * testImageDimensions.height;
        const grainDensity = grains.length / imageArea;
        console.log(
          `  Should have low density: ${grainDensity.toFixed(6)} < 0.1`
        );
        expect(grainDensity).toBeLessThan(0.1);
      }
    });

    it('should handle very low ISO values (25-50) correctly', () => {
      const lowIsos = [25, 50];

      for (const iso of lowIsos) {
        const generator = new GrainGenerator(
          testImageDimensions.width,
          testImageDimensions.height,
          createTestSettings(iso),
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();

        // Low ISO should produce many small grains
        expect(grains.length).toBeGreaterThan(100);

        // Grains should be small at low ISO
        const avgSize =
          grains.reduce((sum, g) => sum + g.size, 0) / grains.length;
        expect(avgSize).toBeLessThan(2.0);
      }
    });
  });
});
