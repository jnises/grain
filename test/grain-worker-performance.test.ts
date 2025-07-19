// Integration benchmarks for grain generation performance measurement
// Pure performance measurement without testing logic
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it } from 'vitest';
import type { GrainSettings } from '../src/types';

// Mock Worker environment
const mockPostMessage = (message: any) => {
  // In real tests, we'd capture these messages
  console.log('Worker message:', message.type, message.stage || message.progress);
};

// Mock globals for worker environment
(globalThis as any).postMessage = mockPostMessage;
(globalThis as any).self = { onmessage: null };

// Import the worker class after setting up mocks
async function createGrainProcessor(width: number, height: number, settings: GrainSettings) {
  // Dynamically import to avoid module loading issues
  const { GrainGenerator } = await import('../src/grain-generator');
  
  return new GrainGenerator(width, height, settings);
}

describe('Grain Generation Performance Integration Benchmarks', () => {
  it('runs variable grain size processing benchmark', async () => {
    const width = 300;
    const height = 200;
    
    console.log(`\n🧪 Variable Grain Size Processing Benchmark for ${width}x${height} image...`);
    
    // Test low ISO
    const lowISOSettings: GrainSettings = {
      iso: 200,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1.0
    };
    
    const lowISOProcessor = await createGrainProcessor(width, height, lowISOSettings);
    
    const lowISOStart = performance.now();
    const lowISOResult = lowISOProcessor.generateGrainStructure();
    const lowISOEnd = performance.now();
    const lowISOTime = lowISOEnd - lowISOStart;
    
    // Test high ISO
    const highISOSettings: GrainSettings = {
      iso: 1600,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1.0
    };
    
    const highISOProcessor = await createGrainProcessor(width, height, highISOSettings);
    
    const highISOStart = performance.now();
    const highISOResult = highISOProcessor.generateGrainStructure();
    const highISOEnd = performance.now();
    const highISOTime = highISOEnd - highISOStart;
    
    // Calculate performance metrics
    const performanceRatio = lowISOTime / highISOTime;
    const grainCountRatio = highISOResult.length / lowISOResult.length;
    
    console.log(`📊 Results:`);
    console.log(`  Low ISO (200): ${lowISOTime.toFixed(2)}ms (${lowISOResult.length} grains)`);
    console.log(`  High ISO (1600): ${highISOTime.toFixed(2)}ms (${highISOResult.length} grains)`);
    console.log(`  Grain count ratio: ${grainCountRatio.toFixed(2)}x more grains at high ISO`);
    console.log(`  Performance ratio: ${performanceRatio.toFixed(2)}x`);
    console.log(`  Low ISO throughput: ${(lowISOResult.length / (lowISOTime / 1000)).toFixed(0)} grains/sec`);
    console.log(`  High ISO throughput: ${(highISOResult.length / (highISOTime / 1000)).toFixed(0)} grains/sec`);
  }, 10000);
  
  it('runs image size scaling benchmark', async () => {
    const testSizes = [
      { width: 200, height: 150, name: 'small' },
      { width: 400, height: 300, name: 'medium' },
      { width: 600, height: 450, name: 'large' }
    ];
    
    console.log(`\n📏 Image Size Scaling Benchmark:`);
    
    const results: Array<{ size: string; time: number; grainCount: number; pixelRatio: number }> = [];
    
    for (const size of testSizes) {
      console.log(`  Testing ${size.name} image (${size.width}x${size.height})...`);
      
      const settings: GrainSettings = {
        iso: 800,
        filmType: 'kodak',
        grainIntensity: 1.0,
        upscaleFactor: 1.0
      };
      
      const processor = await createGrainProcessor(size.width, size.height, settings);
      const start = performance.now();
      const grains = processor.generateGrainStructure();
      const time = performance.now() - start;
      
      const pixelCount = size.width * size.height;
      const pixelRatio = pixelCount / (200 * 150); // Relative to smallest size
      
      results.push({ 
        size: size.name, 
        time, 
        grainCount: grains.length,
        pixelRatio 
      });
      
      console.log(`    ${size.name}: ${time.toFixed(2)}ms (${grains.length} grains)`);
      console.log(`    Grains per second: ${(grains.length / (time / 1000)).toFixed(0)}`);
      console.log(`    Pixels per second: ${((pixelCount) / (time / 1000) / 1000).toFixed(0)}K`);
    }
    
    // Performance scaling analysis
    if (results.length >= 2) {
      console.log(`\n📊 Size scaling analysis:`);
      for (let i = 1; i < results.length; i++) {
        const prev = results[i-1];
        const curr = results[i];
        
        const timeRatio = curr.time / prev.time;
        const grainRatio = curr.grainCount / prev.grainCount;
        const pixelRatio = curr.pixelRatio / prev.pixelRatio;
        
        console.log(`  ${curr.size} vs ${prev.size}:`);
        console.log(`    Time ratio: ${timeRatio.toFixed(2)}x`);
        console.log(`    Grain ratio: ${grainRatio.toFixed(2)}x`);
        console.log(`    Pixel ratio: ${pixelRatio.toFixed(2)}x`);
        console.log(`    Efficiency: ${(grainRatio / timeRatio).toFixed(2)}x more grains per unit time`);
      }
    }
  }, 20000);
  
  it('runs variable grain size generation analysis benchmark', async () => {
    // Benchmark to analyze the effectiveness of variable grain size generation
    const width = 400;
    const height = 300;
    
    const settings: GrainSettings = {
      iso: 1200, // High ISO = more grains with size variation
      filmType: 'kodak',
      grainIntensity: 1.5,
      upscaleFactor: 1.0
    };
    
    console.log(`\n🎯 Variable Grain Size Generation Analysis (ISO ${settings.iso}):`);
    
    const processor = await createGrainProcessor(width, height, settings);
    
    const start = performance.now();
    const grains = processor.generateGrainStructure();
    const end = performance.now();
    const processingTime = end - start;
    
    const grainsPerMs = grains.length / processingTime;
    const pixelsPerMs = (width * height) / processingTime;
    
    // Analyze grain size distribution
    const sizes = grains.map(g => g.size);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    // Size distribution analysis
    const sizeRanges = [
      { min: 0, max: avgSize * 0.8, name: 'small' },
      { min: avgSize * 0.8, max: avgSize * 1.2, name: 'medium' },
      { min: avgSize * 1.2, max: Infinity, name: 'large' }
    ];
    
    const sizeCounts = sizeRanges.map(range => ({
      ...range,
      count: sizes.filter(size => size >= range.min && size < range.max).length
    }));
    
    console.log(`📊 Performance Results:`);
    console.log(`  Processing time: ${processingTime.toFixed(2)}ms`);
    console.log(`  Total grains generated: ${grains.length}`);
    console.log(`  Grain generation rate: ${grainsPerMs.toFixed(1)} grains/ms`);
    console.log(`  Pixel processing rate: ${(pixelsPerMs / 1000).toFixed(1)}K pixels/ms`);
    
    console.log(`\n📏 Size Distribution:`);
    console.log(`  Size range: ${minSize.toFixed(2)} - ${maxSize.toFixed(2)} (avg: ${avgSize.toFixed(2)})`);
    console.log(`  Size variation: ${(maxSize / minSize).toFixed(2)}x range`);
    
    sizeCounts.forEach(range => {
      const percentage = (range.count / grains.length * 100).toFixed(1);
      console.log(`  ${range.name.padEnd(6)}: ${range.count.toString().padStart(4)} grains (${percentage}%)`);
    });
    
    console.log(`\n🔍 Sample Grain Properties (first 5):`);
    for (let i = 0; i < Math.min(5, grains.length); i++) {
      const grain = grains[i];
      console.log(`  Grain ${i+1}: pos(${grain.x.toFixed(1)}, ${grain.y.toFixed(1)}) size=${grain.size.toFixed(2)} sensitivity=${grain.sensitivity.toFixed(2)}`);
    }
  }, 15000);
});
