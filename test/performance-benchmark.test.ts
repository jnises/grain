// Performance benchmark test for grain processing optimization
// Tests grain generation performance across different image sizes and settings

import { describe, it, expect } from 'vitest';
import type { GrainSettings } from '../src/types';

interface BenchmarkResult {
  settings: GrainSettings;
  imageSize: { width: number; height: number };
  processingTime: number;
  pixelsPerSecond: number;
  grainCount: number;
  grainsPerSecond: number;
}

interface BenchmarkComparison {
  lowISO: BenchmarkResult;
  highISO: BenchmarkResult;
  performanceRatio: number;
  grainCountRatio: number;
}

// Create test grain settings
function createTestSettings(iso: number): GrainSettings {
  return {
    iso,
    filmType: 'kodak',
    grainIntensity: 1.0,
    upscaleFactor: 1.0
  };
}

// Benchmark a specific configuration
async function benchmarkConfiguration(
  width: number, 
  height: number, 
  iso: number
): Promise<BenchmarkResult> {
  const settings = createTestSettings(iso);
  
  console.log(`\n🔍 Benchmarking ISO ${iso} mode...`);
  console.log(`Image size: ${width}x${height} (${width * height} pixels)`);
  
  // Import grain processor dynamically to avoid module loading issues
  const { GrainGenerator } = await import('../src/grain-generator');
  
  const startTime = performance.now();
  
  // Create processor instance
  const processor = new GrainGenerator(width, height, settings);
  
  // Generate grain structure
  const grainStructure = processor.generateGrainStructure();
  
  const endTime = performance.now();
  const processingTime = endTime - startTime;
  const pixelsPerSecond = (width * height) / (processingTime / 1000);
  const grainsPerSecond = grainStructure.length / (processingTime / 1000);
  
  return {
    settings,
    imageSize: { width, height },
    processingTime,
    pixelsPerSecond,
    grainCount: grainStructure.length,
    grainsPerSecond
  };
}

// Compare performance between low and high ISO settings
async function compareBenchmarks(width: number, height: number): Promise<BenchmarkComparison> {
  console.log(`\n📊 Starting Performance Comparison for ${width}x${height} image...`);
  
  const lowISO = await benchmarkConfiguration(width, height, 200);
  const highISO = await benchmarkConfiguration(width, height, 1600);
  
  const performanceRatio = lowISO.processingTime / highISO.processingTime;
  const grainCountRatio = highISO.grainCount / lowISO.grainCount;
  
  return {
    lowISO,
    highISO,
    performanceRatio,
    grainCountRatio
  };
}

// Run comprehensive benchmarks
async function runPerformanceBenchmarks(): Promise<void> {
  console.log('🚀 Starting Grain Processing Performance Benchmarks...');
  console.log('This test verifies grain generation performance across different settings.');
  
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
      console.log(`  Low ISO (200):    ${comparison.lowISO.processingTime.toFixed(2)}ms (${comparison.lowISO.grainCount} grains)`);
      console.log(`  High ISO (1600):  ${comparison.highISO.processingTime.toFixed(2)}ms (${comparison.highISO.grainCount} grains)`);
      console.log(`  Grain count ratio: ${comparison.grainCountRatio.toFixed(2)}x more grains at high ISO`);
      console.log(`  Performance ratio: ${comparison.performanceRatio.toFixed(2)}x`);
      
    } catch (error) {
      console.error(`❌ Error benchmarking ${size.width}x${size.height}:`, error);
    }
  }
  
  // Overall summary
  console.log(`\n🏁 Performance Benchmark Summary:`);
  console.log(`  Tests run: ${results.length}/${testSizes.length}`);
  
  const avgPerformanceRatio = results.reduce((sum, r) => sum + r.performanceRatio, 0) / results.length;
  const avgGrainCountRatio = results.reduce((sum, r) => sum + r.grainCountRatio, 0) / results.length;
  
  console.log(`  Average performance ratio: ${avgPerformanceRatio.toFixed(2)}x`);
  console.log(`  Average grain count increase: ${avgGrainCountRatio.toFixed(2)}x at high ISO`);
  
  // Detailed breakdown
  console.log(`\n📊 Detailed Performance Metrics:`);
  for (const result of results) {
    const size = result.lowISO.imageSize;
    console.log(`  ${size.width}x${size.height}:`);
    console.log(`    Low ISO:  ${(result.lowISO.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec, ${(result.lowISO.grainsPerSecond / 1000).toFixed(2)}K grains/sec`);
    console.log(`    High ISO: ${(result.highISO.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec, ${(result.highISO.grainsPerSecond / 1000).toFixed(2)}K grains/sec`);
  }
  
  return Promise.resolve();
}

// Vitest test cases
describe('Grain Processing Performance Benchmarks', () => {
  it('should demonstrate reasonable performance across ISO settings', async () => {
    const comparison = await compareBenchmarks(400, 300);
    
    // High ISO should generate more grains
    expect(comparison.grainCountRatio).toBeGreaterThan(1.5); // At least 50% more grains
    expect(comparison.highISO.grainCount).toBeGreaterThan(comparison.lowISO.grainCount);
    
    // Performance should be reasonable even with more grains
    expect(comparison.highISO.processingTime).toBeLessThan(1000); // Less than 1 second
    expect(comparison.lowISO.processingTime).toBeLessThan(1000); // Less than 1 second
    
    console.log(`Performance ratio: ${comparison.performanceRatio.toFixed(2)}x`);
    console.log(`High ISO: ${comparison.highISO.processingTime.toFixed(2)}ms (${comparison.highISO.grainCount} grains)`);
    console.log(`Low ISO: ${comparison.lowISO.processingTime.toFixed(2)}ms (${comparison.lowISO.grainCount} grains)`);
  }, 10000); // 10 second timeout for benchmarks
  
  it('should show consistent performance across different image sizes', async () => {
    const sizes = [
      { width: 200, height: 150 },
      { width: 400, height: 300 }
    ];
    
    for (const size of sizes) {
      const comparison = await compareBenchmarks(size.width, size.height);
      
      // Both configurations should complete in reasonable time
      expect(comparison.lowISO.processingTime).toBeLessThan(2000);
      expect(comparison.highISO.processingTime).toBeLessThan(2000);
      
      // High ISO should generate more grains
      expect(comparison.grainCountRatio).toBeGreaterThan(1.2);
      
      console.log(`${size.width}x${size.height}: ${comparison.performanceRatio.toFixed(2)}x performance ratio, ${comparison.grainCountRatio.toFixed(2)}x grain ratio`);
    }
  }, 15000); // 15 second timeout for multiple sizes
  
  it('should validate grain generation scales properly with image size', async () => {
    const small = await benchmarkConfiguration(200, 150, 800);
    const large = await benchmarkConfiguration(400, 300, 800);
    
    const pixelRatio = (large.imageSize.width * large.imageSize.height) / (small.imageSize.width * small.imageSize.height);
    const grainRatio = large.grainCount / small.grainCount;
    
    // Grain count should scale reasonably with image size
    expect(grainRatio).toBeGreaterThan(pixelRatio * 0.5); // At least half the pixel ratio
    expect(grainRatio).toBeLessThan(pixelRatio * 2); // At most twice the pixel ratio
    
    console.log(`Pixel ratio: ${pixelRatio.toFixed(2)}x, Grain ratio: ${grainRatio.toFixed(2)}x`);
  }, 10000);
});
