import { describe, it, expect } from 'vitest';
import {
  GrainGenerator,
  SeededRandomNumberGenerator,
} from '../src/grain-generator';
import type { GrainSettings } from '../src/types';

describe('Grain Properties Directional Bias Tests', () => {
  const createTestSettings = (iso: number): GrainSettings => ({
    iso,
    filmType: 'kodak',
  });

  describe('Sensitivity directional bias analysis', () => {
    it.skip('should not show directional bias in sensitivity values', () => {
      const width = 200;
      const height = 200;
      const settings = createTestSettings(400);

      const generator = new GrainGenerator(
        width,
        height,
        settings,
        new SeededRandomNumberGenerator(12345)
      );
      const grains = generator.generateGrainStructure();

      console.log(`Analyzing sensitivity bias for ${grains.length} grains`);

      // Ensure we have enough grains to analyze
      expect(grains.length).toBeGreaterThan(100);

      // Test for horizontal/vertical directional bias in sensitivity values
      const sensitivityDirectionalBias = analyzePropertyDirectionalBias(
        grains,
        'sensitivity',
        width,
        height
      );
      console.log(
        `Sensitivity directional bias - Horizontal var: ${sensitivityDirectionalBias.horizontal.toFixed(4)}, Vertical var: ${sensitivityDirectionalBias.vertical.toFixed(4)}, Ratio: ${sensitivityDirectionalBias.ratio.toFixed(4)}`
      );

      // Horizontal and vertical sensitivity variations should be similar
      expect(sensitivityDirectionalBias.ratio).toBeLessThan(2.0);

      // Test for diagonal bias in sensitivity values
      const sensitivityDiagonalBias = analyzePropertyDiagonalBias(
        grains,
        'sensitivity',
        width,
        height
      );
      console.log(
        `Sensitivity diagonal bias - Main: ${sensitivityDiagonalBias.mainDiagonal.toFixed(4)}, Anti: ${sensitivityDiagonalBias.antiDiagonal.toFixed(4)}, Ratio: ${sensitivityDiagonalBias.ratio.toFixed(4)}`
      );

      // Diagonal sensitivity variations should not be extreme
      expect(sensitivityDiagonalBias.ratio).toBeLessThan(2.0);

      // Test for intermediate diagonal patterns (between horizontal and diagonal)
      const intermediateBias = analyzePropertyIntermediateBias(
        grains,
        'sensitivity',
        width,
        height
      );
      console.log(
        `Sensitivity intermediate bias - Max ratio: ${intermediateBias.maxRatio.toFixed(4)}, Angle: ${intermediateBias.maxAngle.toFixed(1)}°`
      );

      // Should not show strong bias at any angle
      expect(intermediateBias.maxRatio).toBeLessThan(2.5);
    });

    it('should not show regional clustering of sensitivity values', () => {
      const width = 180;
      const height = 180;
      const settings = createTestSettings(800);

      const generator = new GrainGenerator(
        width,
        height,
        settings,
        new SeededRandomNumberGenerator(12345)
      );
      const grains = generator.generateGrainStructure();

      // Test for spatial clustering of similar sensitivity values
      const sensitivityClustering = analyzePropertySpatialClustering(
        grains,
        'sensitivity',
        width,
        height
      );

      console.log(
        `Sensitivity spatial clustering - Score: ${sensitivityClustering.clusteringScore.toFixed(4)}, Expected range: ${sensitivityClustering.expectedRange.toFixed(4)}`
      );

      // Clustering score should be within expected range for random distribution
      expect(sensitivityClustering.clusteringScore).toBeLessThan(
        sensitivityClustering.expectedRange * 2.0
      );
    });
  });

  describe('Development threshold directional bias analysis', () => {
    it('should not show directional bias in developmentThreshold values', () => {
      const width = 200;
      const height = 200;
      const settings = createTestSettings(400);

      const generator = new GrainGenerator(
        width,
        height,
        settings,
        new SeededRandomNumberGenerator(12345)
      );
      const grains = generator.generateGrainStructure();

      console.log(
        `Analyzing development threshold bias for ${grains.length} grains`
      );

      // Test for horizontal/vertical directional bias in development threshold values
      const thresholdDirectionalBias = analyzePropertyDirectionalBias(
        grains,
        'developmentThreshold',
        width,
        height
      );
      console.log(
        `Threshold directional bias - Horizontal var: ${thresholdDirectionalBias.horizontal.toFixed(4)}, Vertical var: ${thresholdDirectionalBias.vertical.toFixed(4)}, Ratio: ${thresholdDirectionalBias.ratio.toFixed(4)}`
      );

      // Horizontal and vertical threshold variations should be similar
      expect(thresholdDirectionalBias.ratio).toBeLessThan(2.0);

      // Test for diagonal bias in development threshold values
      const thresholdDiagonalBias = analyzePropertyDiagonalBias(
        grains,
        'developmentThreshold',
        width,
        height
      );
      console.log(
        `Threshold diagonal bias - Main: ${thresholdDiagonalBias.mainDiagonal.toFixed(4)}, Anti: ${thresholdDiagonalBias.antiDiagonal.toFixed(4)}, Ratio: ${thresholdDiagonalBias.ratio.toFixed(4)}`
      );

      // Diagonal threshold variations should not be extreme
      expect(thresholdDiagonalBias.ratio).toBeLessThan(3.0);

      // Test for intermediate diagonal patterns
      const intermediateBias = analyzePropertyIntermediateBias(
        grains,
        'developmentThreshold',
        width,
        height
      );
      console.log(
        `Threshold intermediate bias - Max ratio: ${intermediateBias.maxRatio.toFixed(4)}, Angle: ${intermediateBias.maxAngle.toFixed(1)}°`
      );

      // Should not show strong bias at any angle
      expect(intermediateBias.maxRatio).toBeLessThan(2.5);
    });

    it('should not show regional clustering of developmentThreshold values', () => {
      const width = 180;
      const height = 180;
      const settings = createTestSettings(1200);

      const generator = new GrainGenerator(
        width,
        height,
        settings,
        new SeededRandomNumberGenerator(12345)
      );
      const grains = generator.generateGrainStructure();

      // Test for spatial clustering of similar threshold values
      const thresholdClustering = analyzePropertySpatialClustering(
        grains,
        'developmentThreshold',
        width,
        height
      );

      console.log(
        `Threshold spatial clustering - Score: ${thresholdClustering.clusteringScore.toFixed(4)}, Expected range: ${thresholdClustering.expectedRange.toFixed(4)}`
      );

      // Clustering score should be within expected range for random distribution
      expect(thresholdClustering.clusteringScore).toBeLessThan(
        thresholdClustering.expectedRange * 2.0
      );
    });
  });

  describe('Combined property analysis', () => {
    it.skip('should not show correlated directional patterns between sensitivity and threshold', () => {
      const width = 150;
      const height = 150;
      const settings = createTestSettings(600);

      const generator = new GrainGenerator(
        width,
        height,
        settings,
        new SeededRandomNumberGenerator(12345)
      );
      const grains = generator.generateGrainStructure();

      // Test for correlation between sensitivity and threshold patterns
      const correlation = analyzePropertyCorrelation(
        grains,
        'sensitivity',
        'developmentThreshold',
        width,
        height
      );

      console.log(
        `Property correlation - Coefficient: ${correlation.coefficient.toFixed(4)}, Directional correlation: ${correlation.directionalCorrelation.toFixed(4)}`
      );

      // Properties should not be strongly correlated in directional patterns
      // Some correlation is expected since both use similar seeded random generation
      expect(Math.abs(correlation.directionalCorrelation)).toBeLessThan(0.85);
    });

    it('should show consistent bias patterns across different ISO settings', () => {
      const width = 120;
      const height = 120;
      const isoSettings = [200, 800, 1600];

      const results: Array<{
        iso: number;
        sensitivityRatio: number;
        thresholdRatio: number;
      }> = [];

      for (const iso of isoSettings) {
        const settings = createTestSettings(iso);
        const generator = new GrainGenerator(
          width,
          height,
          settings,
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();

        const sensitivityBias = analyzePropertyDirectionalBias(
          grains,
          'sensitivity',
          width,
          height
        );
        const thresholdBias = analyzePropertyDirectionalBias(
          grains,
          'developmentThreshold',
          width,
          height
        );

        results.push({
          iso,
          sensitivityRatio: sensitivityBias.ratio,
          thresholdRatio: thresholdBias.ratio,
        });

        console.log(
          `ISO ${iso} - Sensitivity ratio: ${sensitivityBias.ratio.toFixed(4)}, Threshold ratio: ${thresholdBias.ratio.toFixed(4)}`
        );
      }

      // All ISO settings should produce similar bias characteristics
      for (const result of results) {
        expect(result.sensitivityRatio).toBeLessThan(2.0);
        expect(result.thresholdRatio).toBeLessThan(2.0);
      }

      // Variation between ISO settings should not be extreme
      const sensitivityRatios = results.map((r) => r.sensitivityRatio);
      const thresholdRatios = results.map((r) => r.thresholdRatio);

      const sensitivityRange =
        sensitivityRatios.reduce((max, val) => Math.max(max, val), -Infinity) -
        sensitivityRatios.reduce((min, val) => Math.min(min, val), Infinity);
      const thresholdRange =
        thresholdRatios.reduce((max, val) => Math.max(max, val), -Infinity) -
        thresholdRatios.reduce((min, val) => Math.min(min, val), Infinity);

      expect(sensitivityRange).toBeLessThan(1.0);
      expect(thresholdRange).toBeLessThan(1.0);
    });
  });
});

/**
 * Analyze directional bias in grain property values (horizontal vs vertical)
 */
function analyzePropertyDirectionalBias(
  grains: {
    x: number;
    y: number;
    sensitivity: number;
    developmentThreshold: number;
  }[],
  property: 'sensitivity' | 'developmentThreshold',
  width: number,
  height: number
): { horizontal: number; vertical: number; ratio: number } {
  const numStrips = 10;

  // Analyze horizontal strips (varying Y)
  const horizontalStripHeight = height / numStrips;
  const horizontalValues: number[] = [];

  for (let i = 0; i < numStrips; i++) {
    const stripTop = i * horizontalStripHeight;
    const stripBottom = (i + 1) * horizontalStripHeight;

    const grainValues = grains
      .filter((grain) => grain.y >= stripTop && grain.y < stripBottom)
      .map((grain) => grain[property]);

    if (grainValues.length > 0) {
      const avgValue =
        grainValues.reduce((sum, val) => sum + val, 0) / grainValues.length;
      horizontalValues.push(avgValue);
    }
  }

  // Analyze vertical strips (varying X)
  const verticalStripWidth = width / numStrips;
  const verticalValues: number[] = [];

  for (let i = 0; i < numStrips; i++) {
    const stripLeft = i * verticalStripWidth;
    const stripRight = (i + 1) * verticalStripWidth;

    const grainValues = grains
      .filter((grain) => grain.x >= stripLeft && grain.x < stripRight)
      .map((grain) => grain[property]);

    if (grainValues.length > 0) {
      const avgValue =
        grainValues.reduce((sum, val) => sum + val, 0) / grainValues.length;
      verticalValues.push(avgValue);
    }
  }

  // Calculate variation in each direction
  const horizontalVariation = calculateStandardDeviation(horizontalValues);
  const verticalVariation = calculateStandardDeviation(verticalValues);

  const ratio =
    Math.max(horizontalVariation, verticalVariation) /
    (Math.min(horizontalVariation, verticalVariation) || 1e-6);

  return {
    horizontal: horizontalVariation,
    vertical: verticalVariation,
    ratio: ratio,
  };
}

/**
 * Analyze diagonal bias in grain property values
 */
function analyzePropertyDiagonalBias(
  grains: {
    x: number;
    y: number;
    sensitivity: number;
    developmentThreshold: number;
  }[],
  property: 'sensitivity' | 'developmentThreshold',
  width: number,
  height: number
): { mainDiagonal: number; antiDiagonal: number; ratio: number } {
  const stripWidth = 20;
  const mainDiagonalValues: number[] = [];
  const antiDiagonalValues: number[] = [];

  const numStrips = Math.floor(
    Math.sqrt(width * width + height * height) / stripWidth
  );

  for (let i = 0; i < numStrips; i++) {
    const stripStart = i * stripWidth;
    const stripEnd = (i + 1) * stripWidth;

    const mainDiagonalGrains: number[] = [];
    const antiDiagonalGrains: number[] = [];

    for (const grain of grains) {
      // Distance from main diagonal (y = x * height/width)
      const expectedY = (grain.x * height) / width;
      const mainDistance = Math.abs(grain.y - expectedY);

      // Distance from anti diagonal (y = height - x * height/width)
      const expectedYAnti = height - (grain.x * height) / width;
      const antiDistance = Math.abs(grain.y - expectedYAnti);

      if (mainDistance >= stripStart && mainDistance < stripEnd) {
        mainDiagonalGrains.push(grain[property]);
      }
      if (antiDistance >= stripStart && antiDistance < stripEnd) {
        antiDiagonalGrains.push(grain[property]);
      }
    }

    if (stripStart < 50) {
      // Only analyze strips close to actual diagonals
      if (mainDiagonalGrains.length > 0) {
        const avgValue =
          mainDiagonalGrains.reduce((sum, val) => sum + val, 0) /
          mainDiagonalGrains.length;
        mainDiagonalValues.push(avgValue);
      }
      if (antiDiagonalGrains.length > 0) {
        const avgValue =
          antiDiagonalGrains.reduce((sum, val) => sum + val, 0) /
          antiDiagonalGrains.length;
        antiDiagonalValues.push(avgValue);
      }
    }
  }

  const mainVar = calculateStandardDeviation(mainDiagonalValues);
  const antiVar = calculateStandardDeviation(antiDiagonalValues);

  const ratio =
    Math.max(mainVar, antiVar) / (Math.min(mainVar, antiVar) || 1e-6);

  return {
    mainDiagonal: mainVar,
    antiDiagonal: antiVar,
    ratio: ratio,
  };
}

/**
 * Analyze property bias at intermediate angles (between horizontal and diagonal)
 */
function analyzePropertyIntermediateBias(
  grains: {
    x: number;
    y: number;
    sensitivity: number;
    developmentThreshold: number;
  }[],
  property: 'sensitivity' | 'developmentThreshold',
  width: number,
  height: number
): { maxRatio: number; maxAngle: number } {
  let maxRatio = 1.0;
  let maxAngle = 0;

  // Test angles from 15° to 75° in 15° increments (intermediate between horizontal/vertical and diagonal)
  for (let angleDeg = 15; angleDeg <= 75; angleDeg += 15) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const stripBias = analyzePropertyAngleBias(
      grains,
      property,
      width,
      height,
      angleRad
    );

    if (stripBias.ratio > maxRatio) {
      maxRatio = stripBias.ratio;
      maxAngle = angleDeg;
    }
  }

  return { maxRatio, maxAngle };
}

/**
 * Analyze property bias along strips at a specific angle
 */
function analyzePropertyAngleBias(
  grains: {
    x: number;
    y: number;
    sensitivity: number;
    developmentThreshold: number;
  }[],
  property: 'sensitivity' | 'developmentThreshold',
  width: number,
  height: number,
  angle: number
): { ratio: number } {
  const stripWidth = 20;
  const numStrips = 8;
  const stripValues: number[] = [];

  // Create strips perpendicular to the given angle
  const normalAngle = angle + Math.PI / 2;
  const cos = Math.cos(normalAngle);
  const sin = Math.sin(normalAngle);

  for (let i = 0; i < numStrips; i++) {
    const stripStart = i * stripWidth;
    const stripEnd = (i + 1) * stripWidth;
    const stripGrains: number[] = [];

    for (const grain of grains) {
      // Distance from grain to the line through center at given angle
      const centerX = width / 2;
      const centerY = height / 2;
      const distance = Math.abs(
        cos * (grain.x - centerX) + sin * (grain.y - centerY)
      );

      if (distance >= stripStart && distance < stripEnd) {
        stripGrains.push(grain[property]);
      }
    }

    if (stripGrains.length > 0) {
      const avgValue =
        stripGrains.reduce((sum, val) => sum + val, 0) / stripGrains.length;
      stripValues.push(avgValue);
    }
  }

  const variation = calculateStandardDeviation(stripValues);
  const meanValue =
    stripValues.reduce((sum, val) => sum + val, 0) / stripValues.length;
  const relativeVariation = variation / (meanValue || 1e-6);

  // Return a ratio that indicates how much the property varies along this direction
  return { ratio: 1.0 + relativeVariation * 10 }; // Scale to make ratios comparable
}

/**
 * Analyze spatial clustering of property values
 */
function analyzePropertySpatialClustering(
  grains: {
    x: number;
    y: number;
    sensitivity: number;
    developmentThreshold: number;
  }[],
  property: 'sensitivity' | 'developmentThreshold',
  width: number,
  height: number
): { clusteringScore: number; expectedRange: number } {
  const cellSize = 30;
  const cellsX = Math.floor(width / cellSize);
  const cellsY = Math.floor(height / cellSize);

  const cellAverages: number[] = [];

  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      const cellLeft = cx * cellSize;
      const cellTop = cy * cellSize;
      const cellRight = cellLeft + cellSize;
      const cellBottom = cellTop + cellSize;

      const cellGrains = grains.filter(
        (grain) =>
          grain.x >= cellLeft &&
          grain.x < cellRight &&
          grain.y >= cellTop &&
          grain.y < cellBottom
      );

      if (cellGrains.length > 0) {
        const avgValue =
          cellGrains.reduce((sum, grain) => sum + grain[property], 0) /
          cellGrains.length;
        cellAverages.push(avgValue);
      }
    }
  }

  const clusteringScore = calculateStandardDeviation(cellAverages);

  // Expected range for random distribution (rough estimate)
  const allValues = grains.map((grain) => grain[property]);
  const globalStdDev = calculateStandardDeviation(allValues);
  const expectedRange = globalStdDev / Math.sqrt(5); // Rough approximation for cell averaging

  return { clusteringScore, expectedRange };
}

/**
 * Analyze correlation between two property directional patterns
 */
function analyzePropertyCorrelation(
  grains: {
    x: number;
    y: number;
    sensitivity: number;
    developmentThreshold: number;
  }[],
  property1: 'sensitivity' | 'developmentThreshold',
  property2: 'sensitivity' | 'developmentThreshold',
  width: number,
  height: number
): { coefficient: number; directionalCorrelation: number } {
  // Calculate overall correlation between the two properties
  const values1 = grains.map((grain) => grain[property1]);
  const values2 = grains.map((grain) => grain[property2]);
  const coefficient = calculateCorrelation(values1, values2);

  // Calculate correlation of directional patterns
  const bias1 = analyzePropertyDirectionalBias(
    grains,
    property1,
    width,
    height
  );
  const bias2 = analyzePropertyDirectionalBias(
    grains,
    property2,
    width,
    height
  );

  // Simple measure: if both have similar directional bias, they're correlated
  const directionalCorrelation =
    1.0 -
    Math.abs(bias1.ratio - bias2.ratio) / Math.max(bias1.ratio, bias2.ratio);

  return { coefficient, directionalCorrelation };
}

/**
 * Helper function to calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

/**
 * Helper function to calculate correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}
