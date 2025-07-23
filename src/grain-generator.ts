// Core grain generation logic extracted for testing
// This file contains the grain generation algorithms without Web Worker dependencies

import type {
  GrainSettings,
  Point2D,
  GrainPoint,
  RandomNumberGenerator,
} from './types';
import { FILM_CHARACTERISTICS } from './constants';
import { squirrelNoise5 } from './grain-math';
import { SpatialLookupGrid } from './spatial-lookup-grid';
import {
  assertPositiveInteger,
  assertObject,
  assertPositiveNumber,
  assertArray,
  assertNonNegativeNumber,
  devAssertInRange,
  assertFiniteNumber,
  assert,
  devAssert,
} from './utils';

// Default implementation using Math.random
export class DefaultRandomNumberGenerator implements RandomNumberGenerator {
  random(): number {
    return Math.random();
  }
}

// Seeded implementation for deterministic testing
export class SeededRandomNumberGenerator implements RandomNumberGenerator {
  private seed: number;
  private current: number;

  constructor(seed: number = DEFAULT_SEED) {
    devAssert(
      () => Number.isInteger(seed),
      `seed must be an integer, got ${seed}`
    );
    this.seed = seed;
    this.current = seed;
  }

  random(): number {
    // Use Squirrel Noise 5 for better distribution
    const hashedValue = squirrelNoise5(this.current);
    this.current++;

    // Convert to [0, 1) range by dividing by 2^32
    return hashedValue / 0x100000000;
  }

  // Reset to original seed
  reset(): void {
    this.current = this.seed;
  }
}

// File-level constants shared across multiple methods
// Core grain size and density calculations
const ISO_TO_GRAIN_SIZE_DIVISOR = 200; // Controls grain size based on ISO
const MIN_GRAIN_SIZE = 0.5; // Minimum grain size in pixels

// Grain density factors
const BASE_DENSITY_FACTOR = 0.6; // Maximum density factor at very low ISO
const ISO_NORMALIZATION_CONSTANT = 400; // Controls how quickly density decreases with ISO
const MAX_DENSITY_FACTOR = 0.8; // Allow high coverage but respect geometric constraints
const GEOMETRIC_PACKING_EFFICIENCY = 0.85; // Use 85% of max for realistic packing

// Grain spacing
const GRAIN_DISTANCE_MULTIPLIER = 1.2; // Multiplier for grain minimum distance
const MIN_GRAIN_DISTANCE = 0.5; // Minimum distance between grain centers

// Grain size variation (for realistic grain distribution)
const GRAIN_SIZE_VARIATION_RANGE = 2.0; // Size can vary from 0.5x to 2.5x base size
const GRAIN_SIZE_DISTRIBUTION_BIAS = 0.6; // Bias towards smaller grains (>0.5 = more small grains)

// Random number generation seeds
const DEFAULT_SEED = 12345;

export class GrainGenerator {
  private width: number;
  private height: number;
  private settings: GrainSettings;
  private rng: RandomNumberGenerator;

  constructor(
    width: number,
    height: number,
    settings: GrainSettings,
    rng: RandomNumberGenerator
  ) {
    // Validate input parameters with custom assertions that provide type narrowing
    assertPositiveInteger(width, 'width');
    assertPositiveInteger(height, 'height');
    assertObject(settings, 'settings');

    // Validate settings properties
    assertPositiveNumber(settings.iso, 'settings.iso');

    // Validate film type
    assert(
      ['kodak', 'fuji', 'ilford'].includes(settings.filmType),
      'settings.filmType must be one of: kodak, fuji, ilford',
      { filmType: settings.filmType, validTypes: ['kodak', 'fuji', 'ilford'] }
    );

    this.width = width;
    this.height = height;
    this.settings = settings;
    this.rng = rng;
  }

  // Generate Poisson disk sampling for grain placement
  public generatePoissonDiskSampling(
    minDistance: number,
    maxSamples: number
  ): Point2D[] {
    // Validate input parameters with custom assertions
    assertPositiveNumber(minDistance, 'minDistance');
    assertPositiveInteger(maxSamples, 'maxSamples');

    // Poisson disk sampling constants
    const POISSON_CANDIDATES_PER_POINT = 30; // Standard value from literature
    const POISSON_INITIAL_POINT_ATTEMPTS = 3; // Number of initial points to distribute across the image
    const POISSON_INITIAL_POINT_RANGE_MIN = 0.1;
    const POISSON_INITIAL_POINT_RANGE_MAX = 0.8;
    const POISSON_MAX_GENERATION_ROUNDS = 100;
    const POISSON_EARLY_TERMINATION_ROUNDS = 10;
    const POISSON_SAFETY_BREAK_ROUNDS = 100;

    // Log parameters for debugging
    console.log(
      `Generating Poisson disk sampling: minDistance=${minDistance}, maxSamples=${maxSamples}, imageSize=${this.width}x${this.height}`
    );

    const points: Point2D[] = [];
    // Use proper cell size calculation - each cell should be able to hold at most one point
    const cellSize = minDistance / Math.sqrt(2);
    const gridWidth = Math.ceil(this.width / cellSize);
    const gridHeight = Math.ceil(this.height / cellSize);

    // Validate grid dimensions with custom assertion
    assert(
      gridWidth > 0 && gridHeight > 0,
      'Invalid grid dimensions calculated',
      {
        gridWidth,
        gridHeight,
        cellSize,
        minDistance,
        imageSize: `${this.width}x${this.height}`,
        calculation: `ceil(${this.width}/${cellSize}) x ceil(${this.height}/${cellSize})`,
      }
    );

    // Initialize grid to track which cells contain points
    const grid: Array<Array<Point2D | null>> = Array(gridWidth)
      .fill(null)
      .map(() => Array(gridHeight).fill(null));
    const activeList: Point2D[] = [];

    // Helper function to get grid coordinates for a point
    const getGridCoords = (point: Point2D) => ({
      x: Math.floor(point.x / cellSize),
      y: Math.floor(point.y / cellSize),
    });

    // Helper function to check if a point is valid (respects minimum distance)
    const isValidPoint = (candidate: Point2D): boolean => {
      const gridCoords = getGridCoords(candidate);

      // Check all neighboring cells in a radius that could contain conflicting points
      const checkRadius = Math.ceil(minDistance / cellSize);

      for (let dx = -checkRadius; dx <= checkRadius; dx++) {
        for (let dy = -checkRadius; dy <= checkRadius; dy++) {
          const checkX = gridCoords.x + dx;
          const checkY = gridCoords.y + dy;

          if (
            checkX >= 0 &&
            checkX < gridWidth &&
            checkY >= 0 &&
            checkY < gridHeight &&
            grid[checkX][checkY]
          ) {
            const existingPoint = grid[checkX][checkY]!;
            const distance = Math.sqrt(
              (candidate.x - existingPoint.x) ** 2 +
                (candidate.y - existingPoint.y) ** 2
            );
            if (distance < minDistance) {
              return false;
            }
          }
        }
      }
      return true;
    };

    // Helper function to add a point to the data structures
    const addPoint = (point: Point2D) => {
      points.push(point);
      activeList.push(point);
      const gridCoords = getGridCoords(point);
      grid[gridCoords.x][gridCoords.y] = point;
    };

    // Start with multiple well-distributed initial points for better coverage
    const initialPoints = [];
    for (let i = 0; i < POISSON_INITIAL_POINT_ATTEMPTS; i++) {
      initialPoints.push({
        x:
          this.width *
          (POISSON_INITIAL_POINT_RANGE_MIN +
            this.rng.random() *
              (POISSON_INITIAL_POINT_RANGE_MAX -
                POISSON_INITIAL_POINT_RANGE_MIN)),
        y:
          this.height *
          (POISSON_INITIAL_POINT_RANGE_MIN +
            this.rng.random() *
              (POISSON_INITIAL_POINT_RANGE_MAX -
                POISSON_INITIAL_POINT_RANGE_MIN)),
      });
    }

    // Add all initial points
    for (const point of initialPoints) {
      addPoint(point);
    }

    // Track generation progress for early termination
    let generationRounds = 0;
    let pointsAddedInLastRound = 0;

    // Process active points until no more can be added
    while (
      activeList.length > 0 &&
      points.length < maxSamples &&
      generationRounds < POISSON_MAX_GENERATION_ROUNDS
    ) {
      generationRounds++;
      const pointsAtRoundStart = points.length;

      // Process active points one by one, removing immediately when they can't generate new points
      let processedInThisRound = 0;
      const maxPointsToProcessPerRound = Math.max(1, activeList.length);

      while (
        activeList.length > 0 &&
        points.length < maxSamples &&
        processedInThisRound < maxPointsToProcessPerRound
      ) {
        const activePoint = activeList[0]; // Always process the first point
        let foundValidPoint = false;

        // Try to generate new points around this active point
        for (
          let attempt = 0;
          attempt < POISSON_CANDIDATES_PER_POINT;
          attempt++
        ) {
          // Generate point in annulus between minDistance and 2*minDistance
          const angle = this.rng.random() * 2 * Math.PI;
          const radius = minDistance * (1 + this.rng.random()); // Between minDistance and 2*minDistance

          const candidate = {
            x: activePoint.x + Math.cos(angle) * radius,
            y: activePoint.y + Math.sin(angle) * radius,
          };

          // Check if candidate is within image bounds
          if (
            candidate.x >= 0 &&
            candidate.x < this.width &&
            candidate.y >= 0 &&
            candidate.y < this.height
          ) {
            // Check if candidate respects minimum distance constraints
            if (isValidPoint(candidate)) {
              addPoint(candidate);
              foundValidPoint = true;
              break; // Found a valid point, move to next active point
            }
          }
        }

        // If no valid point was found after all attempts, remove this point from active list
        if (!foundValidPoint) {
          activeList.shift(); // Remove the first point
        }

        processedInThisRound++;

        // Safety check to prevent infinite loops within a round
        if (processedInThisRound > POISSON_SAFETY_BREAK_ROUNDS) {
          console.log(
            `Safety break in round ${generationRounds}: processed ${processedInThisRound} points`
          );
          break;
        }
      }

      pointsAddedInLastRound = points.length - pointsAtRoundStart;

      // More aggressive early termination if we're not making progress
      if (
        pointsAddedInLastRound === 0 &&
        generationRounds > POISSON_EARLY_TERMINATION_ROUNDS
      ) {
        // Increased from 5 to 10
        console.log(
          `Early termination: no points added in round ${generationRounds}`
        );
        break;
      }

      // Alternative termination: if activeList is empty (no more points can generate candidates)
      if (activeList.length === 0) {
        console.log(
          `Early termination: no active points remaining after round ${generationRounds}`
        );
        break;
      }
    }

    // Log final results for debugging
    console.log(
      `Poisson disk sampling completed: generated ${points.length}/${maxSamples} points in ${generationRounds} rounds, ${activeList.length} active points remaining`
    );

    return points;
  }

  // Fallback grain generation for better coverage
  public generateFallbackGrains(
    existingGrains: Point2D[],
    targetCount: number,
    minDistance?: number
  ): Point2D[] {
    // Validate input parameters with custom assertions
    assertArray(existingGrains, 'existingGrains');
    assertNonNegativeNumber(targetCount, 'targetCount');
    assert(Number.isInteger(targetCount), 'targetCount must be an integer', {
      targetCount,
      isInteger: Number.isInteger(targetCount),
    });

    // Type guard for existing grains array (dev-only for performance)
    devAssert(
      existingGrains.every(
        (grain) =>
          grain && typeof grain.x === 'number' && typeof grain.y === 'number'
      ),
      'All existing grains must be valid Point2D objects',
      {
        existingGrainsLength: existingGrains.length,
        invalidGrains: existingGrains.filter(
          (grain) =>
            !grain || typeof grain.x !== 'number' || typeof grain.y !== 'number'
        ).length,
      }
    );

    console.log(
      `Generating fallback grains: ${existingGrains.length} existing, ${targetCount} target${minDistance ? `, minDistance=${minDistance.toFixed(2)}` : ''}`
    );

    // Fallback grid generation constants
    const FALLBACK_GRID_CENTER_OFFSET = 0.5;
    const FALLBACK_GRID_RANDOMNESS = 0.6;
    const FALLBACK_DISTANCE_RELAXATION = 0.7; // Allow grains at 70% of minimum distance for fallback
    const SPATIAL_GRID_SIZE_FALLBACK = 10;

    const fallbackGrains: Point2D[] = [...existingGrains];
    const remainingCount = targetCount - existingGrains.length;

    if (remainingCount <= 0) {
      console.log(
        `No additional grains needed: ${existingGrains.length} >= ${targetCount}`
      );
      return fallbackGrains;
    }

    // Calculate grid size to fit approximately the target number of grains
    const gridSize = Math.sqrt((this.width * this.height) / targetCount);

    // Validate grid size with custom assertion
    assertFiniteNumber(gridSize, 'gridSize');
    assert(gridSize > 0, 'Grid size must be positive', {
      gridSize,
      imageArea: this.width * this.height,
      targetCount,
      calculation: `sqrt(${this.width * this.height} / ${targetCount})`,
    });

    const cols = Math.ceil(this.width / gridSize);
    const rows = Math.ceil(this.height / gridSize);

    console.log(
      `Fallback grid: ${cols}x${rows} cells, gridSize=${gridSize.toFixed(2)}`
    );

    // Create spatial hash for existing grains for efficient distance checking
    const spatialGridSize = minDistance
      ? minDistance * FALLBACK_DISTANCE_RELAXATION * 2
      : SPATIAL_GRID_SIZE_FALLBACK;
    const spatialGrid = new Map<string, Point2D[]>();

    // Populate spatial grid with existing grains
    for (const grain of existingGrains) {
      const gridX = Math.floor(grain.x / spatialGridSize);
      const gridY = Math.floor(grain.y / spatialGridSize);
      const key = `${gridX},${gridY}`;

      if (!spatialGrid.has(key)) {
        spatialGrid.set(key, []);
      }
      spatialGrid.get(key)!.push(grain);
    }

    // Helper function to check if a point is too close to existing grains using spatial hash
    const isTooCloseToOriginalGrains = (newPoint: Point2D): boolean => {
      if (!minDistance || existingGrains.length === 0) return false;

      const relaxedDistance = minDistance * FALLBACK_DISTANCE_RELAXATION;
      const checkRadius = Math.ceil(relaxedDistance / spatialGridSize);
      const baseGridX = Math.floor(newPoint.x / spatialGridSize);
      const baseGridY = Math.floor(newPoint.y / spatialGridSize);

      // Check nearby grid cells that could contain grains within the relaxed distance
      for (let dx = -checkRadius; dx <= checkRadius; dx++) {
        for (let dy = -checkRadius; dy <= checkRadius; dy++) {
          const gridX = baseGridX + dx;
          const gridY = baseGridY + dy;
          const key = `${gridX},${gridY}`;
          const cellGrains = spatialGrid.get(key);

          if (cellGrains) {
            for (const existingGrain of cellGrains) {
              const dx = newPoint.x - existingGrain.x;
              const dy = newPoint.y - existingGrain.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance < relaxedDistance) {
                return true;
              }
            }
          }
        }
      }
      return false;
    };

    // Generate grains in grid pattern
    for (
      let row = 0;
      row < rows && fallbackGrains.length < targetCount;
      row++
    ) {
      for (
        let col = 0;
        col < cols && fallbackGrains.length < targetCount;
        col++
      ) {
        // Calculate base position
        const baseX = (col + FALLBACK_GRID_CENTER_OFFSET) * gridSize;
        const baseY = (row + FALLBACK_GRID_CENTER_OFFSET) * gridSize;

        // Add random offset to avoid perfect grid
        const offsetX =
          (this.rng.random() - FALLBACK_GRID_CENTER_OFFSET) *
          gridSize *
          FALLBACK_GRID_RANDOMNESS;
        const offsetY =
          (this.rng.random() - FALLBACK_GRID_CENTER_OFFSET) *
          gridSize *
          FALLBACK_GRID_RANDOMNESS;
        const x = Math.max(0, Math.min(this.width - 1, baseX + offsetX));
        const y = Math.max(0, Math.min(this.height - 1, baseY + offsetY));

        // Validate final coordinates with custom assertion - using devAssertInRange for performance
        devAssertInRange(x, 0, this.width - 1, 'fallback grain x coordinate');
        devAssertInRange(y, 0, this.height - 1, 'fallback grain y coordinate');

        const newPoint = { x, y };

        // Only check distance against original existing grains, not all fallback grains
        // This prevents overlap with Poisson points while maintaining performance
        if (!isTooCloseToOriginalGrains(newPoint)) {
          fallbackGrains.push(newPoint);
        }
      }
    }

    console.log(
      `Fallback generation completed: ${fallbackGrains.length} total grains (${fallbackGrains.length - existingGrains.length} new)`
    );

    return fallbackGrains;
  }

  // Calculate grain generation parameters
  public calculateGrainParameters(): {
    baseGrainSize: number;
    grainDensity: number;
    minDistance: number;
    densityFactor: number;
    imageArea: number;
  } {
    const baseGrainSize = Math.max(
      MIN_GRAIN_SIZE,
      this.settings.iso / ISO_TO_GRAIN_SIZE_DIVISOR
    );
    const imageArea = this.width * this.height;
    const minDistance = Math.max(
      MIN_GRAIN_DISTANCE,
      baseGrainSize * GRAIN_DISTANCE_MULTIPLIER
    );

    // Calculate maximum grains that can geometrically fit
    const grainArea = Math.PI * (minDistance / 2) ** 2;
    const maxPossibleGrains = Math.floor(imageArea / grainArea);

    // Calculate desired density factor with INVERSE ISO relationship (higher ISO = fewer grains)
    // Keep it simple - let coverage naturally peak and fall due to geometric constraints
    const desiredDensityFactor = Math.min(
      MAX_DENSITY_FACTOR,
      BASE_DENSITY_FACTOR / (1 + this.settings.iso / ISO_NORMALIZATION_CONSTANT)
    );
    const desiredGrainCount = Math.floor(imageArea * desiredDensityFactor);

    // Respect geometric constraints - don't try to place more grains than can fit
    const geometricLimit = Math.floor(
      maxPossibleGrains * GEOMETRIC_PACKING_EFFICIENCY
    ); // Use 85% of max for realistic packing
    const grainDensity = Math.min(desiredGrainCount, geometricLimit);
    const actualDensityFactor = grainDensity / imageArea;

    return {
      baseGrainSize,
      grainDensity,
      minDistance,
      densityFactor: actualDensityFactor,
      imageArea,
    };
  }

  // Generate complete grain structure with varying sizes
  public generateGrainStructure(): GrainPoint[] {
    // Grain analysis and variation constants
    const GRAIN_DENSITY_THRESHOLD = 0.85; // Increased from 0.5 to ensure better coverage

    const params = this.calculateGrainParameters();

    // Generate grains with varying sizes using adaptive Poisson disk sampling
    const finalGrainPoints = this.generateVariableSizeGrains(
      params.baseGrainSize,
      params.grainDensity
    );

    // Check distribution quality and use fallback if needed
    if (
      finalGrainPoints.length <
      params.grainDensity * GRAIN_DENSITY_THRESHOLD
    ) {
      const fallbackGrains = this.generateFallbackGrains(
        [],
        params.grainDensity,
        params.minDistance
      );

      // Convert fallback grains to variable-size grains
      return fallbackGrains.map((point) => {
        const sensitivityVariation = this.rng.random();

        const grainSize = this.generateVariableGrainSize(params.baseGrainSize);
        const developmentThreshold =
          this.calculateDevelopmentThreshold(grainSize);

        return {
          x: point.x,
          y: point.y,
          size: grainSize,
          // Sensitivity: multiplier (0.4-1.2) that scales grain density AFTER activation
          sensitivity: 0.8 + sensitivityVariation * 0.4,
          // Development threshold: minimum exposure needed to activate grain (make it visible)
          developmentThreshold,
        };
      });
    }

    return finalGrainPoints;
  }

  // Analyze grain distribution
  public analyzeDistribution(grains: Point2D[]): {
    quadrants: {
      topLeft: number;
      topRight: number;
      bottomLeft: number;
      bottomRight: number;
    };
    coverage: number;
    density: number;
    minDistance?: number;
    maxDistance?: number;
    medianDistance?: number;
  } {
    // Validate input
    assert(Array.isArray(grains), 'grains must be an array', { grains });

    const quadrants = {
      topLeft: 0,
      topRight: 0,
      bottomLeft: 0,
      bottomRight: 0,
    };

    const midX = this.width / 2;
    const midY = this.height / 2;

    for (const grain of grains) {
      if (grain.x < midX && grain.y < midY) {
        quadrants.topLeft++;
      } else if (grain.x >= midX && grain.y < midY) {
        quadrants.topRight++;
      } else if (grain.x < midX && grain.y >= midY) {
        quadrants.bottomLeft++;
      } else {
        quadrants.bottomRight++;
      }
    }

    const coverage = grains.length / (this.width * this.height);
    const density = (grains.length / (this.width * this.height)) * 1000; // per 1000 pixels

    // Calculate distances between grains (sample first 50 for performance)
    const distances: number[] = [];
    const sampleSize = Math.min(50, grains.length);

    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        const dist = Math.sqrt(
          (grains[i].x - grains[j].x) ** 2 + (grains[i].y - grains[j].y) ** 2
        );
        distances.push(dist);
      }
    }

    let minDistance: number | undefined;
    let maxDistance: number | undefined;
    let medianDistance: number | undefined;

    if (distances.length > 0) {
      distances.sort((a, b) => a - b);
      minDistance = distances[0];
      maxDistance = distances[distances.length - 1];
      medianDistance = distances[Math.floor(distances.length / 2)];
    }

    return {
      quadrants,
      coverage,
      density,
      minDistance,
      maxDistance,
      medianDistance,
    };
  }

  // Create spatial grid for grain acceleration using efficient 2D array structure
  public createGrainGrid(grains: GrainPoint[]): SpatialLookupGrid {
    // Validate input
    assert(Array.isArray(grains), 'grains must be an array', { grains });

    // Validate grain structure
    for (const grain of grains) {
      assertObject(grain, 'grain must be an object');
      assert(typeof grain.x === 'number', 'grain.x must be a number', {
        grain,
      });
      assert(typeof grain.y === 'number', 'grain.y must be a number', {
        grain,
      });
      assert(typeof grain.size === 'number', 'grain.size must be a number', {
        grain,
      });
      assert(
        typeof grain.sensitivity === 'number',
        'grain.sensitivity must be a number',
        { grain }
      );
      assert(
        grain.x >= 0 && grain.x < this.width,
        'grain.x must be within bounds',
        { grain, width: this.width }
      );
      assert(
        grain.y >= 0 && grain.y < this.height,
        'grain.y must be within bounds',
        { grain, height: this.height }
      );
      assert(grain.size > 0, 'grain.size must be positive', { grain });
      assert(grain.sensitivity >= 0, 'grain.sensitivity must be non-negative', {
        grain,
      });
    }

    console.log(`Creating spatial lookup grid for ${grains.length} grains...`);

    const grid = new SpatialLookupGrid(this.width, this.height, grains);
    const stats = grid.getGridStats();

    console.log(
      `Spatial grid created: ${stats.gridWidth}x${stats.gridHeight} (${stats.nonEmptyCells} non-empty cells, avg ${stats.averageGrainsPerCell.toFixed(1)} grains/cell)`
    );

    return grid;
  }

  // Generate grains with varying sizes using adaptive Poisson disk sampling
  private generateVariableSizeGrains(
    baseSize: number,
    targetCount: number
  ): GrainPoint[] {
    const grains: GrainPoint[] = [];
    const maxAttempts = Math.min(targetCount * 50, 50000); // Cap total attempts to prevent infinite loops
    let attempts = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 1000; // Stop if we can't place any grains for 1000 attempts

    // Use incremental spatial grid for fast nearest neighbor lookup during generation
    const incrementalGrid = new GrainGenerator.IncrementalSpatialGrid(
      this.width,
      this.height,
      baseSize
    );

    console.log(
      `Generating variable size grains: target=${targetCount}, maxAttempts=${maxAttempts}`
    );

    while (
      grains.length < targetCount &&
      attempts < maxAttempts &&
      consecutiveFailures < maxConsecutiveFailures
    ) {
      // Generate random position using integer seeds
      const x = this.rng.random() * this.width;
      const y = this.rng.random() * this.height;

      // Generate variable size for this grain
      const grainSize = this.generateVariableGrainSize(baseSize);

      // Check if this position is valid using incremental spatial grid
      if (incrementalGrid.isValidGrainPosition(x, y, grainSize)) {
        const sensitivityVariation = this.rng.random();
        const developmentThreshold =
          this.calculateDevelopmentThreshold(grainSize);

        const newGrain: GrainPoint = {
          x,
          y,
          size: grainSize,
          // Sensitivity: multiplier (0.4-1.2) that scales grain density AFTER activation
          sensitivity: 0.8 + sensitivityVariation * 0.4,
          // Development threshold: minimum exposure needed to activate grain (make it visible)
          developmentThreshold,
        };

        grains.push(newGrain);

        // Add to incremental spatial grid
        incrementalGrid.addGrain(newGrain);

        consecutiveFailures = 0; // Reset failure counter on success
      } else {
        consecutiveFailures++;
      }

      attempts++;

      // Log progress occasionally
      if (attempts % 10000 === 0) {
        console.log(
          `Variable grain generation progress: ${grains.length}/${targetCount} grains, ${attempts} attempts, ${consecutiveFailures} consecutive failures`
        );
      }
    }

    console.log(
      `Variable grain generation completed: ${grains.length}/${targetCount} grains in ${attempts} attempts`
    );
    return grains;
  }

  // Generate variable grain size with distribution bias towards smaller grains
  private generateVariableGrainSize(baseSize: number): number {
    const sizeVariation = this.rng.random();

    // Apply distribution bias (more small grains than large ones)
    const biasedVariation =
      sizeVariation ** (1.0 / GRAIN_SIZE_DISTRIBUTION_BIAS);

    // Size ranges from 0.5x to 2.5x base size
    const minSizeMultiplier = 0.5;
    const maxSizeMultiplier = 0.5 + GRAIN_SIZE_VARIATION_RANGE;

    const sizeMultiplier =
      minSizeMultiplier +
      biasedVariation * (maxSizeMultiplier - minSizeMultiplier);

    return Math.max(MIN_GRAIN_SIZE, baseSize * sizeMultiplier);
  }

  /**
   * Calculate per-grain development threshold based on grain properties and film characteristics.
   *
   * Development threshold is the minimum exposure needed to activate a grain (make it visible).
   * This acts as a binary gate - grains below threshold produce zero density.
   * This is separate from sensitivity, which multiplies the density of already-activated grains.
   *
   * This implements the proper development threshold system from the algorithm design.
   */
  private calculateDevelopmentThreshold(grainSize: number): number {
    const filmCharacteristics = FILM_CHARACTERISTICS[this.settings.filmType];
    const thresholdConfig = filmCharacteristics.developmentThreshold;

    // Base sensitivity from film type characteristics
    let threshold = thresholdConfig.baseSensitivity;

    // Grain size effect: larger grains are more sensitive (lower threshold)
    // Normalize grain size relative to base grain size for this ISO
    const baseGrainSize = Math.max(
      MIN_GRAIN_SIZE,
      this.settings.iso / ISO_TO_GRAIN_SIZE_DIVISOR
    );
    const normalizedSize = grainSize / baseGrainSize;
    const sizeEffect = (normalizedSize - 1.0) * thresholdConfig.sizeModifier;
    threshold -= sizeEffect; // Larger grains = lower threshold = more sensitive

    // Random variation per grain using seeded random
    const randomVariation = this.rng.random();
    const variationRange = thresholdConfig.randomVariation;
    const randomOffset = (randomVariation - 0.5) * variationRange; // Range: [-variation/2, +variation/2]
    threshold += randomOffset;

    // Ensure threshold stays in reasonable bounds [0.1, 1.5]
    return Math.max(0.1, Math.min(1.5, threshold));
  }

  /**
   * Incremental spatial grid for grain generation that supports adding grains one at a time.
   *
   * This class uses similar design patterns to SpatialLookupGrid but is optimized for incremental
   * building during grain generation. The main SpatialLookupGrid requires all grains upfront,
   * but during generation we need to check positions against a growing set of grains.
   *
   * Design similarities with SpatialLookupGrid:
   * - Same grid sizing logic (max(16, baseGrainSize * 2))
   * - 1D array with index calculation for better performance
   * - Same grid coordinate calculation approach
   *
   * Key differences:
   * - Supports addGrain() for incremental building
   * - Includes grain validation logic during placement
   * - Optimized for the specific needs of grain generation
   */
  private static IncrementalSpatialGrid = class {
    private grid: GrainPoint[][];
    private readonly gridWidth: number;
    private readonly gridHeight: number;
    private readonly gridSize: number;
    private readonly imageWidth: number;
    private readonly imageHeight: number;

    constructor(
      imageWidth: number,
      imageHeight: number,
      baseGrainSize: number
    ) {
      this.imageWidth = imageWidth;
      this.imageHeight = imageHeight;

      // Use similar grid sizing logic as SpatialLookupGrid
      this.gridSize = Math.max(16, Math.floor(baseGrainSize * 2));
      this.gridWidth = Math.ceil(imageWidth / this.gridSize);
      this.gridHeight = Math.ceil(imageHeight / this.gridSize);

      // Use 1D array with index calculation for better performance (like SpatialLookupGrid TODO)
      this.grid = Array(this.gridWidth * this.gridHeight)
        .fill(null)
        .map(() => []);
    }

    addGrain(grain: GrainPoint): void {
      const gridX = Math.floor(grain.x / this.gridSize);
      const gridY = Math.floor(grain.y / this.gridSize);
      const gridIndex = gridY * this.gridWidth + gridX;

      if (gridIndex >= 0 && gridIndex < this.grid.length) {
        this.grid[gridIndex].push(grain);
      }
    }

    isValidGrainPosition(x: number, y: number, grainSize: number): boolean {
      // Check bounds
      if (x < 0 || x >= this.imageWidth || y < 0 || y >= this.imageHeight) {
        return false;
      }

      // Calculate minimum distance using same logic as original implementation
      const minDistance = Math.max(
        MIN_GRAIN_DISTANCE,
        grainSize * GRAIN_DISTANCE_MULTIPLIER
      );

      // Get grid coordinates
      const gridX = Math.floor(x / this.gridSize);
      const gridY = Math.floor(y / this.gridSize);

      // Check neighboring grid cells
      const searchRadius = Math.ceil(minDistance / this.gridSize) + 1;

      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          const checkX = gridX + dx;
          const checkY = gridY + dy;

          if (
            checkX >= 0 &&
            checkX < this.gridWidth &&
            checkY >= 0 &&
            checkY < this.gridHeight
          ) {
            const gridIndex = checkY * this.gridWidth + checkX;
            const cellGrains = this.grid[gridIndex];

            for (const grain of cellGrains) {
              const distance = Math.sqrt(
                (x - grain.x) ** 2 + (y - grain.y) ** 2
              );

              // Calculate adjusted minimum distance for this specific grain pair
              const combinedSizeDistance = (grainSize + grain.size) * 0.6;
              const adjustedMinDistance = Math.max(
                minDistance,
                combinedSizeDistance
              );

              if (distance < adjustedMinDistance) {
                return false;
              }
            }
          }
        }
      }

      return true;
    }
  };
}
