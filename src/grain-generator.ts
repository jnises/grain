// Core grain generation logic extracted for testing
// This file contains the grain generation algorithms without Web Worker dependencies

import type { GrainSettings, Point2D, GrainPoint } from './types';

export class GrainGenerator {
  private width: number;
  private height: number;
  private settings: GrainSettings;

  constructor(width: number, height: number, settings: GrainSettings) {
    this.width = width;
    this.height = height;
    this.settings = settings;
  }

  // Generate pseudorandom number with seed
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // Generate Poisson disk sampling for grain placement
  public generatePoissonDiskSampling(minDistance: number, maxSamples: number): Point2D[] {
    const points: Point2D[] = [];
    const cellSize = minDistance / Math.sqrt(2);
    const gridWidth = Math.ceil(this.width / cellSize);
    const gridHeight = Math.ceil(this.height / cellSize);
    const grid: Array<Array<Point2D | null>> = Array(gridWidth).fill(null).map(() => Array(gridHeight).fill(null));
    
    // Start with random point
    const initialPoint = {
      x: Math.random() * this.width,
      y: Math.random() * this.height
    };
    points.push(initialPoint);
    
    const activeList = [initialPoint];
    grid[Math.floor(initialPoint.x / cellSize)][Math.floor(initialPoint.y / cellSize)] = initialPoint;
    
    let attempts = 0;
    const maxAttempts = maxSamples * 100; // Prevent infinite loops
    
    while (activeList.length > 0 && points.length < maxSamples && attempts < maxAttempts) {
      attempts++;
      const randomIndex = Math.floor(Math.random() * activeList.length);
      const point = activeList[randomIndex];
      let found = false;
      
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = minDistance + Math.random() * minDistance; // Changed back to ensure minimum distance
        const newPoint = {
          x: point.x + Math.cos(angle) * radius,
          y: point.y + Math.sin(angle) * radius
        };
        
        if (newPoint.x >= 0 && newPoint.x < this.width && 
            newPoint.y >= 0 && newPoint.y < this.height) {
          
          const gridX = Math.floor(newPoint.x / cellSize);
          const gridY = Math.floor(newPoint.y / cellSize);
          
          let valid = true;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const checkX = gridX + dx;
              const checkY = gridY + dy;
              if (checkX >= 0 && checkX < gridWidth && 
                  checkY >= 0 && checkY < gridHeight && 
                  grid[checkX][checkY]) {
                const existingPoint = grid[checkX][checkY]!;
                const distance = Math.sqrt(
                  Math.pow(newPoint.x - existingPoint.x, 2) + 
                  Math.pow(newPoint.y - existingPoint.y, 2)
                );
                if (distance < minDistance) {
                  valid = false;
                  break;
                }
              }
            }
            if (!valid) break;
          }
          
          if (valid) {
            points.push(newPoint);
            activeList.push(newPoint);
            grid[gridX][gridY] = newPoint;
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        activeList.splice(randomIndex, 1);
      }
    }
    
    return points;
  }

  // Fallback grain generation for better coverage
  public generateFallbackGrains(existingGrains: Point2D[], targetCount: number): Point2D[] {
    const fallbackGrains: Point2D[] = [...existingGrains];
    const remainingCount = targetCount - existingGrains.length;
    
    if (remainingCount <= 0) {
      return fallbackGrains;
    }
    
    // Calculate grid size to fit approximately the target number of grains
    const gridSize = Math.sqrt(this.width * this.height / targetCount);
    const cols = Math.ceil(this.width / gridSize);
    const rows = Math.ceil(this.height / gridSize);
    
    // Generate grains in grid pattern
    for (let row = 0; row < rows && fallbackGrains.length < targetCount; row++) {
      for (let col = 0; col < cols && fallbackGrains.length < targetCount; col++) {
        // Calculate base position
        const baseX = (col + 0.5) * gridSize;
        const baseY = (row + 0.5) * gridSize;
        
        // Add random offset to avoid perfect grid
        const offsetX = (Math.random() - 0.5) * gridSize * 0.6;
        const offsetY = (Math.random() - 0.5) * gridSize * 0.6;
        
        const x = Math.max(0, Math.min(this.width - 1, baseX + offsetX));
        const y = Math.max(0, Math.min(this.height - 1, baseY + offsetY));
        
        fallbackGrains.push({ x, y });
      }
    }
    
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
    const baseGrainSize = Math.max(0.5, this.settings.iso / 200);
    const imageArea = this.width * this.height;
    const densityFactor = Math.min(0.05, this.settings.iso / 10000); // Increased max from 0.01 to 0.05
    const grainDensity = Math.floor(imageArea * densityFactor);
    const minDistance = Math.max(1, baseGrainSize * 0.3);

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
    const params = this.calculateGrainParameters();
    
    // For now, prefer fallback generation due to Poisson clustering issues
    // Try Poisson disk sampling first
    const grainPoints = this.generatePoissonDiskSampling(params.minDistance, params.grainDensity);
    
    let finalGrainPoints = grainPoints;
    
    // Always check distribution and prefer fallback if needed
    if (grainPoints.length >= params.grainDensity * 0.5) {
      const analysis = this.analyzeDistribution(grainPoints);
      const totalGrains = grainPoints.length;
      const maxQuadrant = Math.max(
        analysis.quadrants.topLeft,
        analysis.quadrants.topRight,
        analysis.quadrants.bottomLeft,
        analysis.quadrants.bottomRight
      );
      
      // If any quadrant has too many grains (> 50% of total), use fallback
      if (maxQuadrant > totalGrains * 0.5) {
        finalGrainPoints = this.generateFallbackGrains([], params.grainDensity);
      }
    } else {
      // Not enough grains, use fallback
      finalGrainPoints = this.generateFallbackGrains(grainPoints, params.grainDensity);
    }
    
    return finalGrainPoints.map((point, index) => {
      const sizeVariation = this.seededRandom(index * 123.456);
      const sensitivityVariation = this.seededRandom(index * 789.012);
      const shapeVariation = this.seededRandom(index * 345.678);
      
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
}
