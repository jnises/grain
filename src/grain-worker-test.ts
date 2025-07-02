// Test cases for grain distribution debugging
// This file contains test functions to verify grain generation and distribution

import type { GrainSettings, Point2D, GrainPoint } from './types';

// Test version of GrainProcessor with exposed methods for testing
class GrainProcessorTest {
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
    
    console.log(`Poisson Grid: ${gridWidth}x${gridHeight}, cellSize: ${cellSize}`);
    
    // Start with random point
    const initialPoint = {
      x: Math.random() * this.width,
      y: Math.random() * this.height
    };
    points.push(initialPoint);
    
    const activeList = [initialPoint];
    grid[Math.floor(initialPoint.x / cellSize)][Math.floor(initialPoint.y / cellSize)] = initialPoint;
    
    let attempts = 0;
    let maxAttempts = maxSamples * 100; // Prevent infinite loops
    
    while (activeList.length > 0 && points.length < maxSamples && attempts < maxAttempts) {
      attempts++;
      const randomIndex = Math.floor(Math.random() * activeList.length);
      const point = activeList[randomIndex];
      let found = false;
      
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = minDistance * (1 + Math.random());
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
    
    console.log(`Poisson sampling: ${attempts} attempts, ${points.length} points generated`);
    return points;
  }

  // Fallback grain generation for better coverage
  public generateFallbackGrains(existingGrains: Point2D[], targetCount: number): Point2D[] {
    const fallbackGrains: Point2D[] = [...existingGrains];
    const gridSize = Math.max(8, Math.sqrt(this.width * this.height / targetCount));
    
    console.log(`Fallback grid size: ${gridSize} for target ${targetCount} grains`);
    
    let addedCount = 0;
    // Add grains in a regular grid pattern with random offset
    for (let y = gridSize / 2; y < this.height && fallbackGrains.length < targetCount; y += gridSize) {
      for (let x = gridSize / 2; x < this.width && fallbackGrains.length < targetCount; x += gridSize) {
        // Add random offset to avoid perfect grid
        const offsetX = (Math.random() - 0.5) * gridSize * 0.8;
        const offsetY = (Math.random() - 0.5) * gridSize * 0.8;
        const newX = Math.max(0, Math.min(this.width - 1, x + offsetX));
        const newY = Math.max(0, Math.min(this.height - 1, y + offsetY));
        
        fallbackGrains.push({ x: newX, y: newY });
        addedCount++;
      }
    }
    
    console.log(`Fallback method added ${addedCount} grains, total: ${fallbackGrains.length}`);
    return fallbackGrains;
  }

  // Generate grain structure with debugging
  public generateGrainStructure(): GrainPoint[] {
    const baseGrainSize = Math.max(0.5, this.settings.iso / 200);
    const imageArea = this.width * this.height;
    const densityFactor = Math.min(0.01, this.settings.iso / 10000);
    const grainDensity = Math.floor(imageArea * densityFactor);
    const minDistance = Math.max(1, baseGrainSize * 0.3);
    
    console.log('=== Grain Generation Debug ===');
    console.log(`Image: ${this.width}x${this.height} (${imageArea} pixels)`);
    console.log(`ISO: ${this.settings.iso}`);
    console.log(`Base grain size: ${baseGrainSize}`);
    console.log(`Density factor: ${densityFactor}`);
    console.log(`Target grain density: ${grainDensity}`);
    console.log(`Min distance: ${minDistance}`);
    
    const grainPoints = this.generatePoissonDiskSampling(minDistance, grainDensity);
    
    // If we didn't generate enough grains, use fallback method
    let finalGrainPoints = grainPoints;
    if (grainPoints.length < grainDensity * 0.5) {
      console.log(`Using fallback: ${grainPoints.length} < ${grainDensity * 0.5}`);
      finalGrainPoints = this.generateFallbackGrains(grainPoints, grainDensity);
    }
    
    console.log(`Final grain count: ${finalGrainPoints.length}`);
    
    return finalGrainPoints.map((point, index) => {
      const sizeVariation = this.seededRandom(index * 123.456);
      const sensitivityVariation = this.seededRandom(index * 789.012);
      const shapeVariation = this.seededRandom(index * 345.678);
      
      return {
        x: point.x,
        y: point.y,
        size: baseGrainSize * (0.5 + sizeVariation * 1.5),
        sensitivity: 0.8 + sensitivityVariation * 0.4,
        shape: shapeVariation
      };
    });
  }

  // Test grain distribution across image quadrants
  public testGrainDistribution(grains: GrainPoint[]): void {
    console.log('\n=== Grain Distribution Analysis ===');
    
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
    
    console.log('Grain distribution by quadrant:');
    console.log(`Top-left: ${quadrants.topLeft} (${(quadrants.topLeft/grains.length*100).toFixed(1)}%)`);
    console.log(`Top-right: ${quadrants.topRight} (${(quadrants.topRight/grains.length*100).toFixed(1)}%)`);
    console.log(`Bottom-left: ${quadrants.bottomLeft} (${(quadrants.bottomLeft/grains.length*100).toFixed(1)}%)`);
    console.log(`Bottom-right: ${quadrants.bottomRight} (${(quadrants.bottomRight/grains.length*100).toFixed(1)}%)`);
    
    // Check for clustering
    const distances: number[] = [];
    for (let i = 0; i < Math.min(100, grains.length); i++) {
      for (let j = i + 1; j < Math.min(100, grains.length); j++) {
        const dist = Math.sqrt(
          Math.pow(grains[i].x - grains[j].x, 2) + 
          Math.pow(grains[i].y - grains[j].y, 2)
        );
        distances.push(dist);
      }
    }
    
    if (distances.length > 0) {
      distances.sort((a, b) => a - b);
      const minDist = distances[0];
      const medianDist = distances[Math.floor(distances.length / 2)];
      const maxDist = distances[distances.length - 1];
      
      console.log(`Distance analysis (first 100 grains):`);
      console.log(`Min distance: ${minDist.toFixed(2)}`);
      console.log(`Median distance: ${medianDist.toFixed(2)}`);
      console.log(`Max distance: ${maxDist.toFixed(2)}`);
    }
  }

  // Generate a visual representation of grain distribution
  public generateGrainMap(grains: GrainPoint[]): string {
    const mapWidth = 50;
    const mapHeight = 25;
    const map: string[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill('.'));
    
    for (const grain of grains) {
      const mapX = Math.floor((grain.x / this.width) * mapWidth);
      const mapY = Math.floor((grain.y / this.height) * mapHeight);
      
      if (mapX >= 0 && mapX < mapWidth && mapY >= 0 && mapY < mapHeight) {
        map[mapY][mapX] = '#';
      }
    }
    
    return map.map(row => row.join('')).join('\n');
  }
}

// Test runner function
export function runGrainDistributionTests(): void {
  const testCases = [
    { width: 400, height: 300, iso: 100 },
    { width: 400, height: 300, iso: 400 },
    { width: 400, height: 300, iso: 800 },
    { width: 800, height: 600, iso: 400 },
    { width: 1200, height: 800, iso: 400 }
  ];

  for (const testCase of testCases) {
    console.log(`\n========================================`);
    console.log(`Testing ${testCase.width}x${testCase.height}, ISO ${testCase.iso}`);
    console.log(`========================================`);
    
    const settings: GrainSettings = {
      iso: testCase.iso,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1.0
    };
    
    const processor = new GrainProcessorTest(testCase.width, testCase.height, settings);
    const grains = processor.generateGrainStructure();
    
    processor.testGrainDistribution(grains);
    
    console.log('\nGrain distribution map:');
    console.log(processor.generateGrainMap(grains));
  }
}

// Simple test to verify basic functionality
export function testBasicGrainGeneration(): void {
  console.log('=== Basic Grain Generation Test ===');
  
  const settings: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
    grainIntensity: 1.0,
    upscaleFactor: 1.0
  };
  
  const processor = new GrainProcessorTest(400, 300, settings);
  
  // Test Poisson disk sampling directly
  console.log('\n--- Testing Poisson Disk Sampling ---');
  const poissonPoints = processor.generatePoissonDiskSampling(5, 1000);
  console.log(`Generated ${poissonPoints.length} points with min distance 5`);
  
  // Test fallback generation
  console.log('\n--- Testing Fallback Generation ---');
  const fallbackPoints = processor.generateFallbackGrains([], 1000);
  console.log(`Generated ${fallbackPoints.length} fallback points`);
  
  // Test full grain structure
  console.log('\n--- Testing Full Grain Structure ---');
  const grains = processor.generateGrainStructure();
  console.log(`Generated ${grains.length} total grains`);
  
  if (grains.length > 0) {
    console.log('Sample grain properties:');
    console.log(`First grain: x=${grains[0].x.toFixed(2)}, y=${grains[0].y.toFixed(2)}, size=${grains[0].size.toFixed(2)}`);
    if (grains.length > 1) {
      console.log(`Last grain: x=${grains[grains.length-1].x.toFixed(2)}, y=${grains[grains.length-1].y.toFixed(2)}, size=${grains[grains.length-1].size.toFixed(2)}`);
    }
  }
}
