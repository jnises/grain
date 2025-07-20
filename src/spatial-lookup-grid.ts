// Efficient spatial lookup grid for dense grain distributions
// Uses 2D arrays instead of Map<string, Array> for better memory efficiency and performance

import type { GrainPoint } from './types';

export class SpatialLookupGrid {
    // TODO: Better to do a `GrainPoint[][]` using `grid[y * this.gridWidth + x]` for lookup instead of the nested approach?
  private grid: GrainPoint[][][];
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  private readonly gridSize: number;

  constructor(imageWidth: number, imageHeight: number, grains: GrainPoint[]) {
    // Calculate optimal grid size based on grain sizes
    const maxGrainSize = grains.length > 0 ? Math.max(...grains.map(g => g.size)) : 1;
    this.gridSize = Math.max(16, Math.floor(maxGrainSize * 2));
    
    // Calculate grid dimensions
    this.gridWidth = Math.ceil(imageWidth / this.gridSize);
    this.gridHeight = Math.ceil(imageHeight / this.gridSize);
    
    // Initialize 2D array grid
    this.grid = Array(this.gridWidth);
    for (let x = 0; x < this.gridWidth; x++) {
      this.grid[x] = Array(this.gridHeight);
      for (let y = 0; y < this.gridHeight; y++) {
        this.grid[x][y] = [];
      }
    }

    // Populate grid with grains
    this.populateGrid(grains);
  }

  private populateGrid(grains: GrainPoint[]): void {
    for (const grain of grains) {
      const gridX = Math.min(Math.floor(grain.x / this.gridSize), this.gridWidth - 1);
      const gridY = Math.min(Math.floor(grain.y / this.gridSize), this.gridHeight - 1);
      
      // Bounds check
      if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
        this.grid[gridX][gridY].push(grain);
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
   * Get all grains in the cell containing the given point
   */
  getGrainsAt(x: number, y: number): GrainPoint[] {
    const gridX = Math.floor(x / this.gridSize);
    const gridY = Math.floor(y / this.gridSize);
    
    if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
      return this.grid[gridX][gridY];
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
    const maxGridX = Math.min(this.gridWidth - 1, Math.floor((x + radius) / this.gridSize));
    const minGridY = Math.max(0, Math.floor((y - radius) / this.gridSize));
    const maxGridY = Math.min(this.gridHeight - 1, Math.floor((y + radius) / this.gridSize));
    
    // Collect grains from all relevant cells
    for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
      for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
        result.push(...this.grid[gridX][gridY]);
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

    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        const cellCount = this.grid[x][y].length;
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
      averageGrainsPerCell: nonEmptyCells > 0 ? totalGrainReferences / nonEmptyCells : 0,
      maxGrainsPerCell
    };
  }
}
