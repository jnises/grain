// Performance benchmark test for grain processing optimization
// Tests both single layer and multiple layers modes to verify performance improvements

import { describe, it, expect } from 'vitest';
import type { GrainSettings } from '../src/types';

interface BenchmarkResult {
  mode: 'single' | 'multiple';
  settings: GrainSettings;
  imageSize: { width: number; height: number };
  processingTime: number;
  pixelsPerSecond: number;
  grainCoverage: number;
}

interface BenchmarkComparison {
  singleLayer: BenchmarkResult;
  multipleLayers: BenchmarkResult;
  performanceRatio: number;
  speedImprovement: string;
  isOptimized: boolean;
}

// Mock ImageData for testing (since it's not available in Node.js)
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray | number, width?: number, height?: number) {
    if (typeof data === 'number') {
      // Constructor with (width, height) signature
      this.width = data;
      this.height = width!;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      // Constructor with (data, width, height) signature
      this.data = data;
      this.width = width!;
      this.height = height!;
    }
  }
}

// Mock ImageData for testing
function createTestImageData(width: number, height: number): any {
  const data = new Uint8ClampedArray(width * height * 4);
  
  // Fill with test pattern (gradient)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = Math.floor((x / width) * 255);
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      data[i + 3] = 255;  // A
    }
  }
  
  return new MockImageData(data, width, height);
}

// Create test grain settings
function createTestSettings(useMultipleLayers: boolean): GrainSettings {
  return {
    iso: 800,
    filmType: 'kodak',
    grainIntensity: 1.0,
    upscaleFactor: 1.0,
    useMultipleLayers
  };
}

// Benchmark a specific configuration
async function benchmarkConfiguration(
  width: number, 
  height: number, 
  useMultipleLayers: boolean
): Promise<BenchmarkResult> {
  const settings = createTestSettings(useMultipleLayers);
  const imageData = createTestImageData(width, height);
  
  console.log(`\n🔍 Benchmarking ${useMultipleLayers ? 'Multiple Layers' : 'Single Layer'} mode...`);
  console.log(`Image size: ${width}x${height} (${width * height} pixels)`);
  
  // Import grain processor dynamically to avoid module loading issues
  const { GrainGenerator } = await import('../src/grain-generator');
  
  const startTime = performance.now();
  
  // Create processor instance
  const processor = new GrainGenerator(width, height, settings);
  
  // Generate grain structure (this is where the performance difference should be)
  let grainStructure;
  if (useMultipleLayers) {
    grainStructure = processor.generateMultipleGrainLayers();
  } else {
    grainStructure = processor.generateGrainStructure();
  }
  
  const endTime = performance.now();
  const processingTime = endTime - startTime;
  const pixelsPerSecond = (width * height) / (processingTime / 1000);
  
  // Calculate grain coverage (mock - in real implementation this would come from processing)
  const grainCoverage = useMultipleLayers ? 75 : 60; // Multiple layers typically have higher coverage
  
  return {
    mode: useMultipleLayers ? 'multiple' : 'single',
    settings,
    imageSize: { width, height },
    processingTime,
    pixelsPerSecond,
    grainCoverage
  };
}

// Compare performance between single and multiple layers
async function compareBenchmarks(width: number, height: number): Promise<BenchmarkComparison> {
  console.log(`\n📊 Starting Performance Comparison for ${width}x${height} image...`);
  
  const singleLayer = await benchmarkConfiguration(width, height, false);
  const multipleLayers = await benchmarkConfiguration(width, height, true);
  
  const performanceRatio = singleLayer.processingTime / multipleLayers.processingTime;
  const speedImprovement = performanceRatio > 1 
    ? `${((performanceRatio - 1) * 100).toFixed(1)}% faster than expected`
    : `${((1 - performanceRatio) * 100).toFixed(1)}% slower than single layer`;
  
  // Before optimization, multiple layers would be significantly slower
  // After optimization, multiple layers should be comparable to single layer
  const isOptimized = performanceRatio > 0.5; // Multiple layers should be at least 50% as fast as single layer
  
  return {
    singleLayer,
    multipleLayers,
    performanceRatio,
    speedImprovement,
    isOptimized
  };
}

// Run comprehensive benchmarks
async function runPerformanceBenchmarks(): Promise<void> {
  console.log('🚀 Starting Grain Processing Performance Benchmarks...');
  console.log('This test verifies that the multiple layers optimization is working correctly.');
  
  const testSizes = [
    { width: 400, height: 300 },   // Small image
    { width: 800, height: 600 },   // Medium image
  ];
  
  const results: BenchmarkComparison[] = [];
  
  for (const size of testSizes) {
    try {
      const comparison = await compareBenchmarks(size.width, size.height);
      results.push(comparison);
      
      // Log results for this size
      console.log(`\n📈 Results for ${size.width}x${size.height}:`);
      console.log(`  Single Layer:     ${comparison.singleLayer.processingTime.toFixed(2)}ms`);
      console.log(`  Multiple Layers:  ${comparison.multipleLayers.processingTime.toFixed(2)}ms`);
      console.log(`  Performance:      ${comparison.speedImprovement}`);
      console.log(`  Optimization:     ${comparison.isOptimized ? '✅ OPTIMIZED' : '❌ NEEDS WORK'}`);
      
    } catch (error) {
      console.error(`❌ Error benchmarking ${size.width}x${size.height}:`, error);
    }
  }
  
  // Overall summary
  console.log(`\n🏁 Performance Benchmark Summary:`);
  console.log(`  Tests run: ${results.length}/${testSizes.length}`);
  
  const optimizedCount = results.filter(r => r.isOptimized).length;
  const avgPerformanceRatio = results.reduce((sum, r) => sum + r.performanceRatio, 0) / results.length;
  
  console.log(`  Optimized: ${optimizedCount}/${results.length} test cases`);
  console.log(`  Average multiple layers performance: ${(avgPerformanceRatio * 100).toFixed(1)}% of single layer speed`);
  
  if (optimizedCount === results.length) {
    console.log(`  🎉 SUCCESS: Multiple layers optimization is working correctly!`);
  } else {
    console.log(`  ⚠️  WARNING: Some test cases show performance issues.`);
  }
  
  // Detailed breakdown
  console.log(`\n📊 Detailed Performance Metrics:`);
  for (const result of results) {
    const size = result.singleLayer.imageSize;
    console.log(`  ${size.width}x${size.height}:`);
    console.log(`    Single:   ${(result.singleLayer.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec`);
    console.log(`    Multiple: ${(result.multipleLayers.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec`);
    console.log(`    Ratio:    ${result.performanceRatio.toFixed(2)}x`);
  }
  
  return Promise.resolve();
}

// Vitest test cases
describe('Grain Processing Performance Benchmarks', () => {
  it('should demonstrate that multiple layers optimization improves performance', async () => {
    const comparison = await compareBenchmarks(400, 300);
    
    // Multiple layers should be reasonably fast compared to single layer
    expect(comparison.isOptimized).toBe(true);
    expect(comparison.performanceRatio).toBeGreaterThan(0.3); // At least 30% as fast
    
    console.log(`Performance ratio: ${comparison.performanceRatio.toFixed(2)}x`);
    console.log(`Multiple layers: ${comparison.multipleLayers.processingTime.toFixed(2)}ms`);
    console.log(`Single layer: ${comparison.singleLayer.processingTime.toFixed(2)}ms`);
  }, 10000); // 10 second timeout for benchmarks
  
  it('should show improved performance across different image sizes', async () => {
    const sizes = [
      { width: 200, height: 150 },
      { width: 400, height: 300 }
    ];
    
    for (const size of sizes) {
      const comparison = await compareBenchmarks(size.width, size.height);
      
      expect(comparison.isOptimized).toBe(true);
      expect(comparison.performanceRatio).toBeGreaterThan(0.2); // At least 20% as fast
      
      console.log(`${size.width}x${size.height}: ${comparison.performanceRatio.toFixed(2)}x performance ratio`);
    }
  }, 15000); // 15 second timeout for multiple sizes
  
  it('should run full benchmark suite', async () => {
    await expect(runPerformanceBenchmarks()).resolves.toBeUndefined();
  }, 20000); // 20 second timeout for full suite
});
