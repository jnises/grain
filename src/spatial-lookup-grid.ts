// Efficient spatial lookup grid for dense grain distributions
// Uses 2D arrays instead of Map<string, Array> for better memory efficiency and performance

import type { GrainPoint } from './types';
import { devAssert } from './utils';

export class SpatialLookupGrid {
  // Use flatter array structure for better performance - each cell is accessed via grid[y * gridWidth + x]
  private grid: GrainPoint[][];
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  private readonly gridSize: number;
  private readonly maxGrainSize: number;
  private readonly maxGrainSizeGrid: Float32Array;

  constructor(imageWidth: number, imageHeight: number, grains: GrainPoint[]) {
    // Calculate optimal grid size based on grain sizes
    let maxGrainSize = 1;
    for (const grain of grains) {
      if (grain.size > maxGrainSize) {
        maxGrainSize = grain.size;
      }
    }
    this.maxGrainSize = maxGrainSize;
    this.gridSize = Math.max(16, Math.floor(maxGrainSize * 2));

    // Calculate grid dimensions
    this.gridWidth = Math.ceil(imageWidth / this.gridSize);
    this.gridHeight = Math.ceil(imageHeight / this.gridSize);

    // Initialize flatter array grid for better performance
    const totalCells = this.gridWidth * this.gridHeight;
    this.grid = Array(totalCells);
    this.maxGrainSizeGrid = new Float32Array(totalCells); // All initialized to 0
    for (let i = 0; i < totalCells; i++) {
      this.grid[i] = [];
    }

    // Populate grid with grains
    this.populateGrid(grains);
  }

  private populateGrid(grains: GrainPoint[]): void {
    for (const grain of grains) {
      const gridX = Math.floor(grain.x / this.gridSize);
      const gridY = Math.floor(grain.y / this.gridSize);

      // Assert that grain is within image bounds
      devAssert(
        () =>
          gridX >= 0 &&
          gridX < this.gridWidth &&
          gridY >= 0 &&
          gridY < this.gridHeight,
        `Grain at position (${grain.x}, ${grain.y}) is outside image bounds. Grid coordinates: (${gridX}, ${gridY}), Grid dimensions: ${this.gridWidth}x${this.gridHeight}`
      );

      const cellIndex = gridY * this.gridWidth + gridX;
      this.grid[cellIndex].push(grain);

      // Update the max grain size for this cell
      if (grain.size > this.maxGrainSizeGrid[cellIndex]) {
        this.maxGrainSizeGrid[cellIndex] = grain.size;
      }
    }
  }

  /**
   * Get the grid cell size used for spatial partitioning
   */
  getGridSize(): number {
    return this.gridSize;
  }

  /**
   * Get the maximum grain size in this grid
   */
  getMaxGrainSize(): number {
    return this.maxGrainSize;
  }

  /**
   * Get the appropriate lookup radius for a specific position.
   * This is more efficient than a global lookup radius because it considers the
   * maximum grain size only in the local neighborhood of the point.
   */
  getGrainLookupRadius(x: number, y: number): number {
    const gridX = Math.floor(x / this.gridSize);
    const gridY = Math.floor(y / this.gridSize);

    let maxLocalSize = 0;

    // Check a 3x3 grid of cells around the current cell
    for (let dY = -1; dY <= 1; dY++) {
      for (let dX = -1; dX <= 1; dX++) {
        const aX = gridX + dX;
        const aY = gridY + dY;

        if (aX >= 0 && aX < this.gridWidth && aY >= 0 && aY < this.gridHeight) {
          const cellIndex = aY * this.gridWidth + aX;
          if (this.maxGrainSizeGrid[cellIndex] > maxLocalSize) {
            maxLocalSize = this.maxGrainSizeGrid[cellIndex];
          }
        }
      }
    }

    // Fallback to global max size if no grains are in the neighborhood,
    // though this is unlikely with proper grain generation.
    if (maxLocalSize === 0) {
      maxLocalSize = this.maxGrainSize;
    }

    // Grain influence radius factor of 2 is used in calculatePixelGrainEffect
    const GRAIN_INFLUENCE_RADIUS_FACTOR = 2;
    return maxLocalSize * GRAIN_INFLUENCE_RADIUS_FACTOR;
  }

  /**
   * Get all grains in the cell containing the given point
   */
  getGrainsAt(x: number, y: number): GrainPoint[] {
    const gridX = Math.floor(x / this.gridSize);
    const gridY = Math.floor(y / this.gridSize);

    if (
      gridX >= 0 &&
      gridX < this.gridWidth &&
      gridY >= 0 &&
      gridY < this.gridHeight
    ) {
      const cellIndex = gridY * this.gridWidth + gridX;
      return this.grid[cellIndex];
    }

    return [];
  }

  /**
   * Get all grains in cells within a radius around the given point
   * This is the main method used for spatial queries during grain processing
   */
  getGrainsNear(x: number, y: number, radius: number): GrainPoint[] {
    const result: GrainPoint[] = [];

    // Calculate the range of grid cells to check
    const minGridX = Math.max(0, Math.floor((x - radius) / this.gridSize));
    const maxGridX = Math.min(
      this.gridWidth - 1,
      Math.floor((x + radius) / this.gridSize)
    );
    const minGridY = Math.max(0, Math.floor((y - radius) / this.gridSize));
    const maxGridY = Math.min(
      this.gridHeight - 1,
      Math.floor((y + radius) / this.gridSize)
    );

    // Collect grains from all relevant cells using flatter array access
    for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        const cellIndex = gridY * this.gridWidth + gridX;
        result.push(...this.grid[cellIndex]);
      }
    }

    return result;
  }

  /**
   * Get statistics about the grid for debugging and optimization
   */
  getGridStats(): {
    gridWidth: number;
    gridHeight: number;
    gridSize: number;
    totalCells: number;
    nonEmptyCells: number;
    totalGrainReferences: number;
    averageGrainsPerCell: number;
    maxGrainsPerCell: number;
  } {
    let nonEmptyCells = 0;
    let totalGrainReferences = 0;
    let maxGrainsPerCell = 0;

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cellIndex = y * this.gridWidth + x;
        const cellCount = this.grid[cellIndex].length;
        if (cellCount > 0) {
          nonEmptyCells++;
          totalGrainReferences += cellCount;
          maxGrainsPerCell = Math.max(maxGrainsPerCell, cellCount);
        }
      }
    }

    return {
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      gridSize: this.gridSize,
      totalCells: this.gridWidth * this.gridHeight,
      nonEmptyCells,
      totalGrainReferences,
      averageGrainsPerCell:
        nonEmptyCells > 0 ? totalGrainReferences / nonEmptyCells : 0,
      maxGrainsPerCell,
    };
  }

  /**
   * Get the total number of grid cells
   */
  getTotalCells(): number {
    return this.gridWidth * this.gridHeight;
  }
}
