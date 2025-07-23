import {
  GrainGenerator,
  SeededRandomNumberGenerator,
} from '../src/grain-generator';
import { GrainSettings } from '../src/types';

describe('GrainStructure Anisotropy Tests', () => {
  const createTestSettings = (iso: number): GrainSettings => ({
    iso,
    filmType: 'kodak',
  });

  describe('generateGrainStructure anisotropic pattern detection', () => {
    it('should not produce anisotropic grain distribution patterns', () => {
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

      console.log(`Generated ${grains.length} grains for anisotropy analysis`);

      // Ensure we have enough grains to analyze
      expect(grains.length).toBeGreaterThan(100);

      // Test for diagonal stripe patterns
      const diagonalBias = analyzeDiagonalBias(grains, width, height);
      console.log(
        `Diagonal bias analysis - Main: ${diagonalBias.mainDiagonal.toFixed(4)}, Anti: ${diagonalBias.antiDiagonal.toFixed(4)}, Ratio: ${diagonalBias.ratio.toFixed(4)}`
      );

      // Diagonal density variations should not be extreme (no strong diagonal stripes)
      expect(diagonalBias.ratio).toBeLessThan(2.0);

      // Test for horizontal/vertical stripe patterns using grain positions
      const directionalBias = analyzeDirectionalBias(grains, width, height);
      console.log(
        `Directional bias - Horizontal: ${directionalBias.horizontal.toFixed(4)}, Vertical: ${directionalBias.vertical.toFixed(4)}, Ratio: ${directionalBias.ratio.toFixed(4)}`
      );

      // Horizontal and vertical grain density variations should be similar
      expect(directionalBias.ratio).toBeLessThan(2.0);

      // Test for clustering or regular patterns that could cause stripes
      const spatialUniformity = analyzeSpatialUniformity(grains, width, height);
      console.log(
        `Spatial uniformity - CV: ${spatialUniformity.coefficientOfVariation.toFixed(4)}, Max deviation: ${spatialUniformity.maxDeviationFromMean.toFixed(4)}`
      );

      // Coefficient of variation in local densities should not be too high
      expect(spatialUniformity.coefficientOfVariation).toBeLessThan(1.0);

      // Test for regular grid artifacts from fallback generation
      const gridArtifacts = analyzeGridArtifacts(grains, width, height);
      console.log(
        `Grid artifacts - Score: ${gridArtifacts.artifactScore.toFixed(4)}, Threshold: ${gridArtifacts.threshold.toFixed(4)}`
      );

      // Should not show strong grid-like patterns
      expect(gridArtifacts.artifactScore).toBeLessThan(gridArtifacts.threshold);
    });

    it('should produce consistent results across multiple generations', () => {
      const width = 150;
      const height = 150;
      const settings = createTestSettings(800);

      const generator = new GrainGenerator(
        width,
        height,
        settings,
        new SeededRandomNumberGenerator(12345)
      );

      const runs = 3;
      const results: Array<{grainCount: number; diagonalRatio: number; directionalRatio: number}> = [];

      for (let i = 0; i < runs; i++) {
        const grains = generator.generateGrainStructure();
        const diagonalBias = analyzeDiagonalBias(grains, width, height);
        const directionalBias = analyzeDirectionalBias(grains, width, height);

        results.push({
          grainCount: grains.length,
          diagonalRatio: diagonalBias.ratio,
          directionalRatio: directionalBias.ratio,
        });
      }

      console.log('Multiple generation results:', results);

      // All runs should produce similar anisotropy characteristics
      for (const result of results) {
        expect(result.diagonalRatio).toBeLessThan(2.0);
        expect(result.directionalRatio).toBeLessThan(2.0);
        expect(result.grainCount).toBeGreaterThan(50);
      }

      // Grain counts should be relatively consistent
      const grainCounts = results.map((r) => r.grainCount);
      const avgCount =
        grainCounts.reduce((sum, count) => sum + count, 0) / grainCounts.length;
      let maxDeviation = 0;
      for (const count of grainCounts) {
        const deviation = Math.abs(count - avgCount) / avgCount;
        if (deviation > maxDeviation) {
          maxDeviation = deviation;
        }
      }

      expect(maxDeviation).toBeLessThan(0.5); // Within 50% variation is reasonable
    });

    it('should not show anisotropic patterns at different ISO settings', () => {
      const width = 180;
      const height = 180;
      const isoSettings = [100, 400, 1600];

      for (const iso of isoSettings) {
        const settings = createTestSettings(iso);
        const generator = new GrainGenerator(
          width,
          height,
          settings,
          new SeededRandomNumberGenerator(12345)
        );
        const grains = generator.generateGrainStructure();

        const diagonalBias = analyzeDiagonalBias(grains, width, height);
        const directionalBias = analyzeDirectionalBias(grains, width, height);

        console.log(
          `ISO ${iso} - Grains: ${grains.length}, Diagonal ratio: ${diagonalBias.ratio.toFixed(4)}, Directional ratio: ${directionalBias.ratio.toFixed(4)}`
        );
        console.log(
          `  Horizontal variation: ${directionalBias.horizontal.toFixed(4)}, Vertical variation: ${directionalBias.vertical.toFixed(4)}`
        );

        // Each ISO setting should produce non-anisotropic distributions
        expect(diagonalBias.ratio).toBeLessThan(3.0);
        expect(directionalBias.ratio).toBeLessThan(3.0);
      }
    });
    it('should show similar anisotropy patterns between Poisson and fallback methods', () => {
      const width = 150;
      const height = 150;
      const settings = createTestSettings(400);
      const generator = new GrainGenerator(
        width,
        height,
        settings,
        new SeededRandomNumberGenerator(12345)
      );

      // Force fallback generation by using empty existing grains
      const params = generator.calculateGrainParameters();
      const fallbackGrains = generator.generateFallbackGrains(
        [],
        params.grainDensity
      );

      console.log(`Fallback method generated ${fallbackGrains.length} grains`);

      // Convert to GrainPoint format for analysis
      const fallbackGrainPoints = fallbackGrains.map((grain) => ({
        x: grain.x,
        y: grain.y,
        size: 2.0,
        sensitivity: 0.8,
        developmentThreshold: 0.1,
      }));

      // Analyze anisotropy of fallback method
      const fallbackDiagonal = analyzeDiagonalBias(
        fallbackGrainPoints,
        width,
        height
      );
      const fallbackDirectional = analyzeDirectionalBias(
        fallbackGrainPoints,
        width,
        height
      );

      console.log(
        `Fallback - Diagonal ratio: ${fallbackDiagonal.ratio.toFixed(4)}, Directional ratio: ${fallbackDirectional.ratio.toFixed(4)}`
      );
      console.log(
        `  Horizontal variation: ${fallbackDirectional.horizontal.toFixed(4)}, Vertical variation: ${fallbackDirectional.vertical.toFixed(4)}`
      );

      // Test that fallback method doesn't introduce extreme anisotropy
      expect(fallbackDiagonal.ratio).toBeLessThan(2.0);
      expect(fallbackDirectional.ratio).toBeLessThan(2.0);

      // Compare with normal grain generation
      const normalGrains = generator.generateGrainStructure();
      const normalDiagonal = analyzeDiagonalBias(normalGrains, width, height);
      const normalDirectional = analyzeDirectionalBias(
        normalGrains,
        width,
        height
      );

      console.log(
        `Normal generation - Diagonal ratio: ${normalDiagonal.ratio.toFixed(4)}, Directional ratio: ${normalDirectional.ratio.toFixed(4)}`
      );

      // Both methods should produce reasonable anisotropy levels
      expect(normalDiagonal.ratio).toBeLessThan(2.0);
      expect(normalDirectional.ratio).toBeLessThan(2.0);
    });
  });
});

/**
 * Analyze diagonal bias in grain distribution
 * Divides image into diagonal strips and compares grain density
 */
function analyzeDiagonalBias(
  grains: { x: number; y: number }[],
  width: number,
  height: number
): { mainDiagonal: number; antiDiagonal: number; ratio: number } {
  // Input validation
  if (!Array.isArray(grains)) {
    throw new Error('grains must be an array');
  }
  if (typeof width !== 'number' || width <= 0) {
    throw new Error('width must be a positive number');
  }
  if (typeof height !== 'number' || height <= 0) {
    throw new Error('height must be a positive number');
  }
  const stripWidth = 20; // Width of diagonal strips to analyze
  const mainDiagonalGrains: number[] = [];
  const antiDiagonalGrains: number[] = [];

  // Create diagonal strips parallel to main diagonal (top-left to bottom-right)
  const numStrips = Math.floor(
    Math.sqrt(width * width + height * height) / stripWidth
  );

  for (let i = 0; i < numStrips; i++) {
    let mainCount = 0;
    let antiCount = 0;

    // Check if grain falls in current diagonal strip
    const stripStart = i * stripWidth;
    const stripEnd = (i + 1) * stripWidth;

    for (const grain of grains) {
      // Distance from main diagonal (y = x * height/width)
      const expectedY = (grain.x * height) / width;
      const mainDistance = Math.abs(grain.y - expectedY);

      // Distance from anti diagonal (y = height - x * height/width)
      const expectedYAnti = height - (grain.x * height) / width;
      const antiDistance = Math.abs(grain.y - expectedYAnti);

      if (mainDistance >= stripStart && mainDistance < stripEnd) {
        mainCount++;
      }
      if (antiDistance >= stripStart && antiDistance < stripEnd) {
        antiCount++;
      }
    }

    if (stripStart < 50) {
      // Only analyze strips close to actual diagonals
      mainDiagonalGrains.push(mainCount);
      antiDiagonalGrains.push(antiCount);
    }
  }

  const mainAvg =
    mainDiagonalGrains.reduce((sum, count) => sum + count, 0) /
      mainDiagonalGrains.length || 0;
  const antiAvg =
    antiDiagonalGrains.reduce((sum, count) => sum + count, 0) /
      antiDiagonalGrains.length || 0;

  const ratio = Math.max(mainAvg, antiAvg) / (Math.min(mainAvg, antiAvg) || 1);

  return {
    mainDiagonal: mainAvg,
    antiDiagonal: antiAvg,
    ratio: ratio,
  };
}

/**
 * Analyze horizontal vs vertical directional bias
 * Compares grain density variations in horizontal vs vertical strips
 */
function analyzeDirectionalBias(
  grains: { x: number; y: number }[],
  width: number,
  height: number
): { horizontal: number; vertical: number; ratio: number } {
  // Input validation
  if (!Array.isArray(grains)) {
    throw new Error('grains must be an array');
  }
  if (typeof width !== 'number' || width <= 0) {
    throw new Error('width must be a positive number');
  }
  if (typeof height !== 'number' || height <= 0) {
    throw new Error('height must be a positive number');
  }
  const numStrips = 10;

  // Analyze horizontal strips (varying Y)
  const horizontalStripHeight = height / numStrips;
  const horizontalCounts: number[] = [];

  for (let i = 0; i < numStrips; i++) {
    const stripTop = i * horizontalStripHeight;
    const stripBottom = (i + 1) * horizontalStripHeight;

    const count = grains.filter(
      (grain) => grain.y >= stripTop && grain.y < stripBottom
    ).length;

    horizontalCounts.push(count);
  }

  // Analyze vertical strips (varying X)
  const verticalStripWidth = width / numStrips;
  const verticalCounts: number[] = [];

  for (let i = 0; i < numStrips; i++) {
    const stripLeft = i * verticalStripWidth;
    const stripRight = (i + 1) * verticalStripWidth;

    const count = grains.filter(
      (grain) => grain.x >= stripLeft && grain.x < stripRight
    ).length;

    verticalCounts.push(count);
  }

  // Calculate variation in each direction
  const horizontalVariation = calculateVariation(horizontalCounts);
  const verticalVariation = calculateVariation(verticalCounts);

  const ratio =
    Math.max(horizontalVariation, verticalVariation) /
    (Math.min(horizontalVariation, verticalVariation) || 1);

  return {
    horizontal: horizontalVariation,
    vertical: verticalVariation,
    ratio: ratio,
  };
}

/**
 * Analyze spatial uniformity by examining local grain densities
 */
function analyzeSpatialUniformity(
  grains: { x: number; y: number }[],
  width: number,
  height: number
): { coefficientOfVariation: number; maxDeviationFromMean: number } {
  // Input validation
  if (!Array.isArray(grains)) {
    throw new Error('grains must be an array');
  }
  if (typeof width !== 'number' || width <= 0) {
    throw new Error('width must be a positive number');
  }
  if (typeof height !== 'number' || height <= 0) {
    throw new Error('height must be a positive number');
  }
  const cellSize = 30;
  const cellsX = Math.floor(width / cellSize);
  const cellsY = Math.floor(height / cellSize);

  const densities: number[] = [];

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
      ).length;

      densities.push(cellGrains);
    }
  }

  const mean =
    densities.reduce((sum, density) => sum + density, 0) / densities.length;
  const variance =
    densities.reduce((sum, density) => sum + Math.pow(density - mean, 2), 0) /
    densities.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  let maxDeviationFromMean = 0;
  for (const density of densities) {
    const deviation = Math.abs(density - mean);
    if (deviation > maxDeviationFromMean) {
      maxDeviationFromMean = deviation;
    }
  }
  maxDeviationFromMean = maxDeviationFromMean / (mean || 1);

  return {
    coefficientOfVariation,
    maxDeviationFromMean,
  };
}

/**
 * Analyze for grid artifacts that might come from fallback generation
 */
function analyzeGridArtifacts(
  grains: { x: number; y: number }[],
  width: number,
  height: number
): { artifactScore: number; threshold: number } {
  // Look for regular spacing patterns that might indicate grid artifacts
  const expectedGridSize = Math.sqrt((width * height) / grains.length);
  const tolerance = expectedGridSize * 0.3;

  let gridAlignedCount = 0;

  for (const grain of grains) {
    // Check if grain aligns closely to a regular grid
    const gridX = Math.round(grain.x / expectedGridSize) * expectedGridSize;
    const gridY = Math.round(grain.y / expectedGridSize) * expectedGridSize;

    const distanceToGrid = Math.sqrt(
      Math.pow(grain.x - gridX, 2) + Math.pow(grain.y - gridY, 2)
    );

    if (distanceToGrid < tolerance) {
      gridAlignedCount++;
    }
  }

  const artifactScore = gridAlignedCount / grains.length;
  const threshold = 0.6; // More than 60% grid-aligned suggests artifacts

  return {
    artifactScore,
    threshold,
  };
}

/**
 * Helper function to calculate variation (standard deviation) of an array
 */
function calculateVariation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}
