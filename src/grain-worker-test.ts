// Test cases for grain distribution debugging
// This file contains test functions to verify grain generation and distribution

import { GrainGenerator } from './grain-generator';
import type { GrainSettings, Point2D, GrainPoint } from './types';
import { assertPositiveInteger, assertPositiveNumber, assertArray, assertPoint2D, assertObject, assert } from './utils';

// Test functions that use the main GrainGenerator class
export function testPoissonDistribution(
  width: number,
  height: number,
  minDistance: number,
  maxSamples: number
): Point2D[] {
  // Validate input parameters with custom assertions
  assertPositiveInteger(width, 'width');
  assertPositiveInteger(height, 'height');
  assertPositiveNumber(minDistance, 'minDistance');
  assertPositiveInteger(maxSamples, 'maxSamples');

  const settings: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
    grainIntensity: 1.0,
    upscaleFactor: 1.0
  };
  
  const generator = new GrainGenerator(width, height, settings);
  return generator.generatePoissonDiskSampling(minDistance, maxSamples);
}

export function testGrainGeneration(
  width: number,
  height: number,
  settings: GrainSettings
): GrainPoint[] {
  // Validate input parameters with custom assertions
  assertPositiveInteger(width, 'width');
  assertPositiveInteger(height, 'height');
  assertObject(settings, 'settings');

  // Type guard for settings using custom assertion
  assert(
    isValidGrainSettings(settings),
    'Invalid grain settings structure',
    { settings, requiredProperties: ['iso', 'filmType', 'grainIntensity', 'upscaleFactor'] }
  );

  const generator = new GrainGenerator(width, height, settings);
  return generator.generateGrainStructure();
}

// Type guard helper
function isValidGrainSettings(settings: any): settings is GrainSettings {
  return settings &&
         typeof settings.iso === 'number' && settings.iso > 0 &&
         typeof settings.filmType === 'string' &&
         ['kodak', 'fuji', 'ilford'].includes(settings.filmType) &&
         typeof settings.grainIntensity === 'number' && settings.grainIntensity >= 0 &&
         typeof settings.upscaleFactor === 'number' && settings.upscaleFactor > 0;
}

export function validatePointDistribution(points: Point2D[], minDistance: number): boolean {
  // Validate input parameters with custom assertions
  assertArray(points, 'points');
  assertPositiveNumber(minDistance, 'minDistance');

  // Type guard for points array using custom assertion
  points.forEach((point, index) => {
    assertPoint2D(point, `points[${index}]`);
  });

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance = Math.sqrt(
        (points[i].x - points[j].x) ** 2 + 
        (points[i].y - points[j].y) ** 2
      );
      if (distance < minDistance) {
        return false;
      }
    }
  }
  return true;
}

// Debug function to analyze grain distribution
export function analyzeGrainDistribution(points: Point2D[] | GrainPoint[], width: number, height: number) {
  // Validate input parameters with custom assertions
  assertArray(points, 'points');
  assertPositiveInteger(width, 'width');
  assertPositiveInteger(height, 'height');

  // Type guard for points array using custom assertion
  points.forEach((point, index) => {
    assertPoint2D(point, `points[${index}]`);
  });

  console.log(`Generated ${points.length} grain points`);
  console.log(`Canvas size: ${width}x${height} (${width * height} pixels)`);
  console.log(`Grain density: ${((points.length / (width * height)) * 10000).toFixed(2)} grains per 10k pixels`);
  
  // Check if we have variable grain sizes
  const hasVariableSizes = points.length > 0 && 'size' in points[0];
  if (hasVariableSizes) {
    const grainPoints = points as GrainPoint[];
    const sizes = grainPoints.map(p => p.size);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    console.log(`Grain sizes - Min: ${minSize.toFixed(2)}, Max: ${maxSize.toFixed(2)}, Avg: ${avgSize.toFixed(2)}`);
    
    // Size distribution analysis
    const smallGrains = grainPoints.filter(p => p.size < avgSize * 0.8).length;
    const mediumGrains = grainPoints.filter(p => p.size >= avgSize * 0.8 && p.size <= avgSize * 1.2).length;
    const largeGrains = grainPoints.filter(p => p.size > avgSize * 1.2).length;
    
    console.log(`Size distribution - Small: ${smallGrains}, Medium: ${mediumGrains}, Large: ${largeGrains}`);
  }
  
  if (points.length > 0) {
    // Calculate bounds
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    console.log(`X range: ${minX.toFixed(1)} to ${maxX.toFixed(1)}`);
    console.log(`Y range: ${minY.toFixed(1)} to ${maxY.toFixed(1)}`);
    
    // Calculate average distances
    let totalDistance = 0;
    let distanceCount = 0;
    
    for (let i = 0; i < Math.min(points.length, 100); i++) {
      for (let j = i + 1; j < Math.min(points.length, 100); j++) {
        const distance = Math.sqrt(
          (points[i].x - points[j].x) ** 2 + 
          (points[i].y - points[j].y) ** 2
        );
        totalDistance += distance;
        distanceCount++;
      }
    }
    
    if (distanceCount > 0) {
      console.log(`Average distance (sample): ${(totalDistance / distanceCount).toFixed(2)}`);
    }
  }
}

// Test runner for grain distribution
export function runGrainDistributionTests() {
  console.log('=== Grain Distribution Tests ===');
  
  // Test 1: Basic Poisson disk sampling
  console.log('\n1. Basic Poisson disk sampling');
  const points1 = testPoissonDistribution(400, 300, 5, 1000);
  analyzeGrainDistribution(points1, 400, 300);
  console.log(`Min distance validation: ${validatePointDistribution(points1, 5)}`);
  
  // Test 2: High density
  console.log('\n2. High density test');
  const points2 = testPoissonDistribution(400, 300, 2, 5000);
  analyzeGrainDistribution(points2, 400, 300);
  console.log(`Min distance validation: ${validatePointDistribution(points2, 2)}`);
  
  // Test 3: Low density
  console.log('\n3. Low density test');
  const points3 = testPoissonDistribution(400, 300, 20, 100);
  analyzeGrainDistribution(points3, 400, 300);
  console.log(`Min distance validation: ${validatePointDistribution(points3, 20)}`);
  
  // Test 4: Different ISO settings
  console.log('\n4. ISO variation test');
  const isoSettings = [
    { iso: 100, filmType: 'kodak' as const, grainIntensity: 1.0, upscaleFactor: 1.0 },
    { iso: 400, filmType: 'kodak' as const, grainIntensity: 1.0, upscaleFactor: 1.0 },
    { iso: 1600, filmType: 'kodak' as const, grainIntensity: 1.0, upscaleFactor: 1.0 },
  ];
  
  isoSettings.forEach(settings => {
    console.log(`\nISO ${settings.iso}:`);
    const points = testGrainGeneration(400, 300, settings);
    analyzeGrainDistribution(points, 400, 300);
  });
}

// Make functions available in browser context
if (typeof window !== 'undefined') {
  (window as any).grainTests = {
    testPoissonDistribution,
    testGrainGeneration,
    validatePointDistribution,
    analyzeGrainDistribution,
    runGrainDistributionTests
  };
}
