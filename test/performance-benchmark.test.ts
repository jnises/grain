// Performance benchmark test for grain processing optimization
// Pure benchmarks for tracking performance over time and profiling

import { describe, it } from 'vitest';
import {
  GrainGenerator,
  SeededRandomNumberGenerator,
} from '../src/grain-generator';
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

  // Use the already imported GrainGenerator

  const startTime = performance.now();

  // Create processor instance
  const processor = new GrainGenerator(
    width,
    height,
    settings,
    new SeededRandomNumberGenerator(12345)
  );

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
    grainsPerSecond,
  };
}

// Compare performance between low and high ISO settings
async function compareBenchmarks(
  width: number,
  height: number
): Promise<BenchmarkComparison> {
  console.log(
    `\n📊 Starting Performance Comparison for ${width}x${height} image...`
  );

  const lowISO = await benchmarkConfiguration(width, height, 200);
  const highISO = await benchmarkConfiguration(width, height, 1600);

  const performanceRatio = lowISO.processingTime / highISO.processingTime;
  const grainCountRatio = highISO.grainCount / lowISO.grainCount;

  return {
    lowISO,
    highISO,
    performanceRatio,
    grainCountRatio,
  };
}

// Run comprehensive benchmarks
export async function runPerformanceBenchmarks(): Promise<void> {
  console.log('🚀 Starting Grain Processing Performance Benchmarks...');
  console.log(
    'This test verifies grain generation performance across different settings.'
  );

  const testSizes = [
    { width: 400, height: 300 }, // Small image
    { width: 800, height: 600 }, // Medium image
  ];

  const results: BenchmarkComparison[] = [];

  for (const size of testSizes) {
    try {
      const comparison = await compareBenchmarks(size.width, size.height);
      results.push(comparison);

      // Log results for this size
      console.log(`\n📈 Results for ${size.width}x${size.height}:`);
      console.log(
        `  Low ISO (200):    ${comparison.lowISO.processingTime.toFixed(2)}ms (${comparison.lowISO.grainCount} grains)`
      );
      console.log(
        `  High ISO (1600):  ${comparison.highISO.processingTime.toFixed(2)}ms (${comparison.highISO.grainCount} grains)`
      );
      console.log(
        `  Grain count ratio: ${comparison.grainCountRatio.toFixed(2)}x more grains at high ISO`
      );
      console.log(
        `  Performance ratio: ${comparison.performanceRatio.toFixed(2)}x`
      );
    } catch (error) {
      console.error(
        `❌ Error benchmarking ${size.width}x${size.height}:`,
        error
      );
    }
  }

  // Overall summary
  console.log(`\n🏁 Performance Benchmark Summary:`);
  console.log(`  Tests run: ${results.length}/${testSizes.length}`);

  const avgPerformanceRatio =
    results.reduce((sum, r) => sum + r.performanceRatio, 0) / results.length;
  const avgGrainCountRatio =
    results.reduce((sum, r) => sum + r.grainCountRatio, 0) / results.length;

  console.log(
    `  Average performance ratio: ${avgPerformanceRatio.toFixed(2)}x`
  );
  console.log(
    `  Average grain count increase: ${avgGrainCountRatio.toFixed(2)}x at high ISO`
  );

  // Detailed breakdown
  console.log(`\n📊 Detailed Performance Metrics:`);
  for (const result of results) {
    const size = result.lowISO.imageSize;
    console.log(`  ${size.width}x${size.height}:`);
    console.log(
      `    Low ISO:  ${(result.lowISO.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec, ${(result.lowISO.grainsPerSecond / 1000).toFixed(2)}K grains/sec`
    );
    console.log(
      `    High ISO: ${(result.highISO.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec, ${(result.highISO.grainsPerSecond / 1000).toFixed(2)}K grains/sec`
    );
  }

  return Promise.resolve();
}

// Benchmark runner (no assertions, just performance measurement and reporting)
describe('Grain Processing Performance Benchmarks', () => {
  it('runs ISO performance comparison benchmark', async () => {
    const comparison = await compareBenchmarks(400, 300);

    console.log(`\n📊 ISO Performance Comparison Results:`);
    console.log(
      `  Performance ratio: ${comparison.performanceRatio.toFixed(2)}x`
    );
    console.log(
      `  High ISO: ${comparison.highISO.processingTime.toFixed(2)}ms (${comparison.highISO.grainCount} grains)`
    );
    console.log(
      `  Low ISO: ${comparison.lowISO.processingTime.toFixed(2)}ms (${comparison.lowISO.grainCount} grains)`
    );
    console.log(
      `  Grain count ratio: ${comparison.grainCountRatio.toFixed(2)}x more grains at high ISO`
    );
  }, 10000);

  it('runs image size scaling benchmark', async () => {
    const sizes = [
      { width: 200, height: 150 },
      { width: 400, height: 300 },
      { width: 800, height: 600 },
    ];

    console.log(`\n📏 Image Size Scaling Benchmark:`);

    for (const size of sizes) {
      const comparison = await compareBenchmarks(size.width, size.height);

      console.log(`  ${size.width}x${size.height}:`);
      console.log(
        `    Performance ratio: ${comparison.performanceRatio.toFixed(2)}x`
      );
      console.log(
        `    Grain count ratio: ${comparison.grainCountRatio.toFixed(2)}x`
      );
      console.log(
        `    Low ISO time: ${comparison.lowISO.processingTime.toFixed(2)}ms`
      );
      console.log(
        `    High ISO time: ${comparison.highISO.processingTime.toFixed(2)}ms`
      );
    }
  }, 20000);

  it('runs grain scaling analysis benchmark', async () => {
    const small = await benchmarkConfiguration(200, 150, 800);
    const medium = await benchmarkConfiguration(400, 300, 800);
    const large = await benchmarkConfiguration(800, 600, 800);

    const smallPixels = small.imageSize.width * small.imageSize.height;
    const mediumPixels = medium.imageSize.width * medium.imageSize.height;
    const largePixels = large.imageSize.width * large.imageSize.height;

    console.log(`\n🔍 Grain Scaling Analysis (ISO 800):`);
    console.log(
      `  Small (${small.imageSize.width}x${small.imageSize.height}):`
    );
    console.log(
      `    Time: ${small.processingTime.toFixed(2)}ms, Grains: ${small.grainCount}`
    );
    console.log(
      `    Grains/sec: ${small.grainsPerSecond.toFixed(0)}, Pixels/sec: ${(small.pixelsPerSecond / 1000).toFixed(0)}K`
    );

    console.log(
      `  Medium (${medium.imageSize.width}x${medium.imageSize.height}):`
    );
    console.log(
      `    Time: ${medium.processingTime.toFixed(2)}ms, Grains: ${medium.grainCount}`
    );
    console.log(
      `    Grains/sec: ${medium.grainsPerSecond.toFixed(0)}, Pixels/sec: ${(medium.pixelsPerSecond / 1000).toFixed(0)}K`
    );

    console.log(
      `  Large (${large.imageSize.width}x${large.imageSize.height}):`
    );
    console.log(
      `    Time: ${large.processingTime.toFixed(2)}ms, Grains: ${large.grainCount}`
    );
    console.log(
      `    Grains/sec: ${large.grainsPerSecond.toFixed(0)}, Pixels/sec: ${(large.pixelsPerSecond / 1000).toFixed(0)}K`
    );

    console.log(`  Scaling ratios:`);
    console.log(
      `    Medium/Small - Pixels: ${(mediumPixels / smallPixels).toFixed(2)}x, Grains: ${(medium.grainCount / small.grainCount).toFixed(2)}x, Time: ${(medium.processingTime / small.processingTime).toFixed(2)}x`
    );
    console.log(
      `    Large/Medium - Pixels: ${(largePixels / mediumPixels).toFixed(2)}x, Grains: ${(large.grainCount / medium.grainCount).toFixed(2)}x, Time: ${(large.processingTime / medium.processingTime).toFixed(2)}x`
    );
  }, 40000);
});
