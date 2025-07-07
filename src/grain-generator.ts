// Core grain generation logic extracted for testing
// This file contains the grain generation algorithms without Web Worker dependencies

import type { GrainSettings, Point2D, GrainPoint, GrainLayer } from './types';
import { SEEDED_RANDOM_MULTIPLIER } from './constants';
import { 
  assertPositiveInteger, 
  assertObject, 
  assertPositiveNumber, 
  assertArray, 
  assertPoint2D,
  assertNonNegativeNumber,
  assertInRange,
  assertFiniteNumber,
  assert
} from './utils';

// File-level constants shared across multiple methods
const ISO_TO_GRAIN_SIZE_DIVISOR = 200;
const MIN_GRAIN_SIZE = 0.5;
const ISO_TO_DENSITY_DIVISOR = 3000; // Reduced from 10000 to increase density
const MAX_DENSITY_FACTOR = 0.15; // Increased from 0.05 to allow much higher densities
const GRAIN_DISTANCE_MULTIPLIER = 1.2; // Increased from 0.3 to give more reasonable distances
const MIN_GRAIN_DISTANCE = 0.5; // Reduced from 1 to allow smaller grains when appropriate

const PRIMARY_LAYER_SIZE_MULTIPLIER = 1.5;
const SECONDARY_LAYER_SIZE_MULTIPLIER = 0.8;
const MICRO_LAYER_SIZE_MULTIPLIER = 0.3;
const PRIMARY_LAYER_DENSITY_MULTIPLIER = 0.4;
const SECONDARY_LAYER_DENSITY_MULTIPLIER = 0.35;
const MICRO_LAYER_DENSITY_MULTIPLIER = 0.25;

export class GrainGenerator {
  private width: number;
  private height: number;
  private settings: GrainSettings;

  constructor(width: number, height: number, settings: GrainSettings) {
    // Validate input parameters with custom assertions that provide type narrowing
    assertPositiveInteger(width, 'width');
    assertPositiveInteger(height, 'height');
    assertObject(settings, 'settings');
    
    // Validate settings properties
    assertPositiveNumber(settings.iso, 'settings.iso');
    assertNonNegativeNumber(settings.grainIntensity, 'settings.grainIntensity');
    assertPositiveNumber(settings.upscaleFactor, 'settings.upscaleFactor');
    
    // Validate film type
    assert(
      ['kodak', 'fuji', 'ilford'].includes(settings.filmType),
      'settings.filmType must be one of: kodak, fuji, ilford',
      { filmType: settings.filmType, validTypes: ['kodak', 'fuji', 'ilford'] }
    );

    this.width = width;
    this.height = height;
    this.settings = settings;
  }

  // Generate pseudorandom number with seed
  public seededRandom(seed: number): number {
    const x = Math.sin(seed) * SEEDED_RANDOM_MULTIPLIER;
    return x - Math.floor(x);
  }

  // Generate Poisson disk sampling for grain placement
  public generatePoissonDiskSampling(minDistance: number, maxSamples: number): Point2D[] {
    // Validate input parameters with custom assertions
    assertPositiveNumber(minDistance, 'minDistance');
    assertPositiveInteger(maxSamples, 'maxSamples');

    // Log parameters for debugging
    console.log(`Generating Poisson disk sampling: minDistance=${minDistance}, maxSamples=${maxSamples}, imageSize=${this.width}x${this.height}`);

    // Poisson disk sampling constants
    const POISSON_CANDIDATES_PER_POINT = 30; // Standard value from literature
    
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
        calculation: `ceil(${this.width}/${cellSize}) x ceil(${this.height}/${cellSize})`
      }
    );

    // Initialize grid to track which cells contain points
    const grid: Array<Array<Point2D | null>> = Array(gridWidth).fill(null).map(() => Array(gridHeight).fill(null));
    const activeList: Point2D[] = [];
    
    // Helper function to get grid coordinates for a point
    const getGridCoords = (point: Point2D) => ({
      x: Math.floor(point.x / cellSize),
      y: Math.floor(point.y / cellSize)
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
          
          if (checkX >= 0 && checkX < gridWidth && 
              checkY >= 0 && checkY < gridHeight && 
              grid[checkX][checkY]) {
            const existingPoint = grid[checkX][checkY]!;
            const distance = Math.sqrt(
              Math.pow(candidate.x - existingPoint.x, 2) + 
              Math.pow(candidate.y - existingPoint.y, 2)
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
    
    // Start with a single well-positioned initial point
    const initialPoint = {
      x: this.width * (0.3 + Math.random() * 0.4), // Center-ish but with some randomness
      y: this.height * (0.3 + Math.random() * 0.4)
    };
    addPoint(initialPoint);
    
    // Track generation progress for early termination
    let generationRounds = 0;
    let pointsAddedInLastRound = 0;
    const maxGenerationRounds = 1000; // Prevent infinite loops
    const minPointsPerRound = Math.max(1, Math.ceil(maxSamples / 1000)); // Require some progress
    
    // Process active points until no more can be added
    while (activeList.length > 0 && points.length < maxSamples && generationRounds < maxGenerationRounds) {
      generationRounds++;
      const pointsAtRoundStart = points.length;
      
      // Process all current active points in this round
      const activePointsThisRound = [...activeList]; // Copy to avoid modification during iteration
      
      for (const activePoint of activePointsThisRound) {
        if (points.length >= maxSamples) break;
        
        let foundValidPoint = false;
        
        // Try to generate new points around this active point
        for (let attempt = 0; attempt < POISSON_CANDIDATES_PER_POINT; attempt++) {
          // Generate point in annulus between minDistance and 2*minDistance
          const angle = Math.random() * 2 * Math.PI;
          const radius = minDistance * (1 + Math.random()); // Between minDistance and 2*minDistance
          
          const candidate = {
            x: activePoint.x + Math.cos(angle) * radius,
            y: activePoint.y + Math.sin(angle) * radius
          };
          
          // Check if candidate is within image bounds
          if (candidate.x >= 0 && candidate.x < this.width && 
              candidate.y >= 0 && candidate.y < this.height) {
            
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
          const index = activeList.indexOf(activePoint);
          if (index >= 0) {
            activeList.splice(index, 1);
          }
        }
      }
      
      pointsAddedInLastRound = points.length - pointsAtRoundStart;
      
      // Early termination if we're not making progress
      if (pointsAddedInLastRound < minPointsPerRound && generationRounds > 10) {
        console.log(`Early termination: only ${pointsAddedInLastRound} points added in round ${generationRounds}`);
        break;
      }
    }
    
    // Log final results for debugging
    console.log(`Poisson disk sampling completed: generated ${points.length}/${maxSamples} points in ${generationRounds} rounds, ${activeList.length} active points remaining`);
    
    return points;
  }

  // Fallback grain generation for better coverage
  public generateFallbackGrains(existingGrains: Point2D[], targetCount: number): Point2D[] {
    // Validate input parameters with custom assertions
    assertArray(existingGrains, 'existingGrains');
    assertNonNegativeNumber(targetCount, 'targetCount');
    assert(
      Number.isInteger(targetCount),
      'targetCount must be an integer',
      { targetCount, isInteger: Number.isInteger(targetCount) }
    );

    // Type guard for existing grains array
    existingGrains.forEach((grain, index) => {
      assertPoint2D(grain, `existingGrains[${index}]`);
    });

    console.log(`Generating fallback grains: ${existingGrains.length} existing, ${targetCount} target`);

    // Fallback grid generation constants
    const FALLBACK_GRID_CENTER_OFFSET = 0.5;
    const FALLBACK_GRID_RANDOMNESS = 0.6;
    
    const fallbackGrains: Point2D[] = [...existingGrains];
    const remainingCount = targetCount - existingGrains.length;
    
    if (remainingCount <= 0) {
      console.log(`No additional grains needed: ${existingGrains.length} >= ${targetCount}`);
      return fallbackGrains;
    }
    
    // Calculate grid size to fit approximately the target number of grains
    const gridSize = Math.sqrt(this.width * this.height / targetCount);
    
    // Validate grid size with custom assertion
    assertFiniteNumber(gridSize, 'gridSize');
    assert(
      gridSize > 0,
      'Grid size must be positive',
      { 
        gridSize, 
        imageArea: this.width * this.height, 
        targetCount,
        calculation: `sqrt(${this.width * this.height} / ${targetCount})`
      }
    );
    
    const cols = Math.ceil(this.width / gridSize);
    const rows = Math.ceil(this.height / gridSize);
    
    console.log(`Fallback grid: ${cols}x${rows} cells, gridSize=${gridSize.toFixed(2)}`);
    
    // Generate grains in grid pattern
    for (let row = 0; row < rows && fallbackGrains.length < targetCount; row++) {
      for (let col = 0; col < cols && fallbackGrains.length < targetCount; col++) {
        // Calculate base position
        const baseX = (col + FALLBACK_GRID_CENTER_OFFSET) * gridSize;
        const baseY = (row + FALLBACK_GRID_CENTER_OFFSET) * gridSize;
        
        // Add random offset to avoid perfect grid
        const offsetX = (Math.random() - FALLBACK_GRID_CENTER_OFFSET) * gridSize * FALLBACK_GRID_RANDOMNESS;
        const offsetY = (Math.random() - FALLBACK_GRID_CENTER_OFFSET) * gridSize * FALLBACK_GRID_RANDOMNESS;
         const x = Math.max(0, Math.min(this.width - 1, baseX + offsetX));
        const y = Math.max(0, Math.min(this.height - 1, baseY + offsetY));
        
        // Validate final coordinates with custom assertion
        assertInRange(x, 0, this.width - 1, 'fallback grain x coordinate');
        assertInRange(y, 0, this.height - 1, 'fallback grain y coordinate');

        fallbackGrains.push({ x, y });
      }
    }
    
    console.log(`Fallback generation completed: ${fallbackGrains.length} total grains (${fallbackGrains.length - existingGrains.length} new)`);
    
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
    const baseGrainSize = Math.max(MIN_GRAIN_SIZE, this.settings.iso / ISO_TO_GRAIN_SIZE_DIVISOR);
    const imageArea = this.width * this.height;
    const densityFactor = Math.min(MAX_DENSITY_FACTOR, this.settings.iso / ISO_TO_DENSITY_DIVISOR); // Increased max from 0.01 to 0.05
    const grainDensity = Math.floor(imageArea * densityFactor);
    const minDistance = Math.max(MIN_GRAIN_DISTANCE, baseGrainSize * GRAIN_DISTANCE_MULTIPLIER);

    return {
      baseGrainSize,
      grainDensity,
      minDistance,
      densityFactor,
      imageArea
    };
  }

  // Generate complete grain structure
  public generateGrainStructure(): GrainPoint[] {
    // Grain analysis and variation constants
    const GRAIN_DENSITY_THRESHOLD = 0.5;
    const QUADRANT_MAX_RATIO = 0.5;
    const SIZE_VARIATION_SEED_MULTIPLIER = 123.456;
    const SENSITIVITY_VARIATION_SEED_MULTIPLIER = 789.012;
    const SHAPE_VARIATION_SEED_MULTIPLIER = 345.678;
    
    const params = this.calculateGrainParameters();
    
    // For now, prefer fallback generation due to Poisson clustering issues
    // Try Poisson disk sampling first
    const grainPoints = this.generatePoissonDiskSampling(params.minDistance, params.grainDensity);
    
    let finalGrainPoints = grainPoints;
    
    // Always check distribution and prefer fallback if needed
    if (grainPoints.length >= params.grainDensity * GRAIN_DENSITY_THRESHOLD) {
      const analysis = this.analyzeDistribution(grainPoints);
      const totalGrains = grainPoints.length;
      const maxQuadrant = Math.max(
        analysis.quadrants.topLeft,
        analysis.quadrants.topRight,
        analysis.quadrants.bottomLeft,
        analysis.quadrants.bottomRight
      );
      
      // If any quadrant has too many grains (> 50% of total), use fallback
      if (maxQuadrant > totalGrains * QUADRANT_MAX_RATIO) {
        finalGrainPoints = this.generateFallbackGrains([], params.grainDensity);
      }
    } else {
      // Not enough grains, use fallback
      finalGrainPoints = this.generateFallbackGrains(grainPoints, params.grainDensity);
    }
    
    return finalGrainPoints.map((point, index) => {
      const sizeVariation = this.seededRandom(index * SIZE_VARIATION_SEED_MULTIPLIER);
      const sensitivityVariation = this.seededRandom(index * SENSITIVITY_VARIATION_SEED_MULTIPLIER);
      const shapeVariation = this.seededRandom(index * SHAPE_VARIATION_SEED_MULTIPLIER);
      
      return {
        x: point.x,
        y: point.y,
        size: params.baseGrainSize * (0.5 + sizeVariation * 1.5),
        sensitivity: 0.8 + sensitivityVariation * 0.4,
        shape: shapeVariation
      };
    });
  }

  // Analyze grain distribution
  public analyzeDistribution(grains: Point2D[]): {
    quadrants: { topLeft: number; topRight: number; bottomLeft: number; bottomRight: number };
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
      bottomRight: 0
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
    const density = grains.length / (this.width * this.height) * 1000; // per 1000 pixels
    
    // Calculate distances between grains (sample first 50 for performance)
    const distances: number[] = [];
    const sampleSize = Math.min(50, grains.length);
    
    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        const dist = Math.sqrt(
          Math.pow(grains[i].x - grains[j].x, 2) + 
          Math.pow(grains[i].y - grains[j].y, 2)
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
      medianDistance
    };
  }

  // Create spatial grid for grain acceleration
  public createGrainGrid(grains: GrainPoint[]): Map<string, GrainPoint[]> {
    // Validate input
    assert(Array.isArray(grains), 'grains must be an array', { grains });
    
    if (grains.length === 0) {
      return new Map<string, GrainPoint[]>();
    }
    
    // Validate grain structure
    for (const grain of grains) {
      assertObject(grain, 'grain must be an object');
      assert(typeof grain.x === 'number', 'grain.x must be a number', { grain });
      assert(typeof grain.y === 'number', 'grain.y must be a number', { grain });
      assert(typeof grain.size === 'number', 'grain.size must be a number', { grain });
      assert(typeof grain.sensitivity === 'number', 'grain.sensitivity must be a number', { grain });
      assert(typeof grain.shape === 'number', 'grain.shape must be a number', { grain });
      assert(grain.x >= 0 && grain.x < this.width, 'grain.x must be within bounds', { grain, width: this.width });
      assert(grain.y >= 0 && grain.y < this.height, 'grain.y must be within bounds', { grain, height: this.height });
      assert(grain.size > 0, 'grain.size must be positive', { grain });
      assert(grain.sensitivity >= 0, 'grain.sensitivity must be non-negative', { grain });
      assert(grain.shape >= 0, 'grain.shape must be non-negative', { grain });
    }
    
    const maxGrainSize = Math.max(...grains.map(g => g.size));
    const gridSize = Math.max(8, Math.floor(maxGrainSize * 2));
    const grainGrid = new Map<string, GrainPoint[]>();
    
    for (const grain of grains) {
      const influenceRadius = grain.size * 2;
      const minGridX = Math.floor((grain.x - influenceRadius) / gridSize);
      const maxGridX = Math.floor((grain.x + influenceRadius) / gridSize);
      const minGridY = Math.floor((grain.y - influenceRadius) / gridSize);
      const maxGridY = Math.floor((grain.y + influenceRadius) / gridSize);
      
      // Add grain to all grid cells it can influence
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
          const key = `${gridX},${gridY}`;
          if (!grainGrid.has(key)) {
            grainGrid.set(key, []);
          }
          grainGrid.get(key)!.push(grain);
        }
      }
    }
    
    return grainGrid;
  }

  // Generate multiple grain layers for realistic film grain
  public generateMultipleGrainLayers(): GrainLayer[] {
    const layers: GrainLayer[] = [];
    const params = this.calculateGrainParameters();
    
    // Primary grain layer (largest, most visible)
    const primaryGrains = this.generateGrainLayer(
      'primary', 
      params.baseGrainSize * PRIMARY_LAYER_SIZE_MULTIPLIER, 
      params.grainDensity * PRIMARY_LAYER_DENSITY_MULTIPLIER
    );
    layers.push(primaryGrains);
    
    // Secondary grain layer (medium size clusters)
    const secondaryGrains = this.generateGrainLayer(
      'secondary', 
      params.baseGrainSize * SECONDARY_LAYER_SIZE_MULTIPLIER, 
      params.grainDensity * SECONDARY_LAYER_DENSITY_MULTIPLIER
    );
    layers.push(secondaryGrains);
    
    // Micro grain layer (fine texture)
    const microGrains = this.generateGrainLayer(
      'micro', 
      params.baseGrainSize * MICRO_LAYER_SIZE_MULTIPLIER, 
      params.grainDensity * MICRO_LAYER_DENSITY_MULTIPLIER
    );
    layers.push(microGrains);
    
    return layers;
  }
  
  // Generate a single grain layer with specific characteristics
  private generateGrainLayer(layerType: 'primary' | 'secondary' | 'micro', baseSize: number, density: number): GrainLayer {
    const targetGrainCount = Math.floor(density);
    const minDistance = Math.max(1, baseSize * 0.3);
    
    // Generate grain points using existing methods
    const grainPoints = this.generatePoissonDiskSampling(minDistance, targetGrainCount);
    let finalGrainPoints = grainPoints;
    
    // Use fallback if not enough grains
    if (grainPoints.length < targetGrainCount * 0.5) {
      finalGrainPoints = this.generateFallbackGrains(grainPoints, targetGrainCount);
    }
    
    // Layer-specific adjustments
    let layerSizeMultiplier = 1.0;
    let layerSensitivityMultiplier = 1.0;
    let layerIntensityMultiplier = 1.0;
    
    switch (layerType) {
      case 'primary':
        layerSizeMultiplier = 1.2;
        layerSensitivityMultiplier = 1.1;
        layerIntensityMultiplier = 1.0;
        break;
      case 'secondary':
        layerSizeMultiplier = 0.8;
        layerSensitivityMultiplier = 0.9;
        layerIntensityMultiplier = 0.7;
        break;
      case 'micro':
        layerSizeMultiplier = 0.4;
        layerSensitivityMultiplier = 0.8;
        layerIntensityMultiplier = 0.5;
        break;
    }
    
    // Convert to GrainPoint objects with layer-specific properties
    const grains = finalGrainPoints.map((point, index) => {
      const sizeVariation = this.seededRandom(index * 123.456 + layerType.length);
      const sensitivityVariation = this.seededRandom(index * 789.012 + layerType.length);
      const shapeVariation = this.seededRandom(index * 345.678 + layerType.length);
      
      return {
        x: point.x,
        y: point.y,
        size: baseSize * layerSizeMultiplier * (0.5 + sizeVariation * 1.5),
        sensitivity: (0.8 + sensitivityVariation * 0.4) * layerSensitivityMultiplier,
        shape: shapeVariation
      };
    });
    
    return {
      layerType,
      grains,
      baseSize,
      density,
      intensityMultiplier: layerIntensityMultiplier
    };
  }
}
