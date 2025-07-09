// Integration test for grain generation performance benchmarks
// Tests the actual grain generation to measure real-world performance with variable grain sizes

import { describe, it, expect } from 'vitest';
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

// Create test image data
function createTestImageData(width: number, height: number): any {
  const data = new Uint8ClampedArray(width * height * 4);
  
  // Create a test pattern with varying luminance
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = Math.floor(128 + 127 * Math.sin(x / 20) * Math.cos(y / 20));
      data[i] = luminance;     // R
      data[i + 1] = luminance; // G 
      data[i + 2] = luminance; // B
      data[i + 3] = 255;       // A
    }
  }
  
  return { data, width, height };
}

describe('Grain Generation Performance Integration Tests', () => {
  it('should demonstrate efficient variable grain size processing', async () => {
    const width = 300;
    const height = 200;
    const totalPixels = width * height;
    
    console.log(`\n🧪 Testing grain generation performance for ${width}x${height} image...`);
    
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
    
    console.log(`  Low ISO (200): ${lowISOTime.toFixed(2)}ms (${lowISOResult.length} grains)`);
    console.log(`  High ISO (1600): ${highISOTime.toFixed(2)}ms (${highISOResult.length} grains)`);
    console.log(`  Grain count ratio: ${grainCountRatio.toFixed(2)}x more grains at high ISO`);
    console.log(`  Performance ratio: ${performanceRatio.toFixed(2)}x`);
    
    // Assertions
    expect(lowISOTime).toBeGreaterThan(0);
    expect(highISOTime).toBeGreaterThan(0);
    expect(lowISOResult.length).toBeGreaterThan(0);
    expect(highISOResult.length).toBeGreaterThan(0);
    
    // High ISO should generate more grains
    expect(grainCountRatio).toBeGreaterThan(1.5); // At least 50% more grains
    
    // Both should complete in reasonable time
    expect(lowISOTime).toBeLessThan(1000); // Less than 1 second
    expect(highISOTime).toBeLessThan(2000); // Less than 2 seconds even with more grains
    
    // Performance should scale reasonably
    expect(performanceRatio).toBeGreaterThan(0.2); // High ISO shouldn't be more than 5x slower
  }, 10000);
  
  it('should scale performance appropriately with image size', async () => {
    const testSizes = [
      { width: 200, height: 150, name: 'small' },
      { width: 400, height: 300, name: 'medium' }
    ];
    
    const results: Array<{ size: string; time: number; grainCount: number; pixelRatio: number }> = [];
    
    for (const size of testSizes) {
      console.log(`\n📏 Testing ${size.name} image (${size.width}x${size.height})...`);
      
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
      
      console.log(`  ${size.name}: ${time.toFixed(2)}ms (${grains.length} grains)`);
      console.log(`  Grains per second: ${(grains.length / (time / 1000)).toFixed(0)}`);
      
      // Each size should complete in reasonable time
      expect(time).toBeLessThan(3000); // Less than 3 seconds
      expect(grains.length).toBeGreaterThan(0);
    }
    
    // Performance should scale reasonably with image size
    if (results.length >= 2) {
      const smallResult = results[0];
      const mediumResult = results[1];
      
      const timeRatio = mediumResult.time / smallResult.time;
      const grainRatio = mediumResult.grainCount / smallResult.grainCount;
      
      console.log(`\n📊 Size scaling analysis:`);
      console.log(`  Time ratio: ${timeRatio.toFixed(2)}x`);
      console.log(`  Grain ratio: ${grainRatio.toFixed(2)}x`);
      console.log(`  Pixel ratio: ${mediumResult.pixelRatio.toFixed(2)}x`);
      
      // Time should scale sub-linearly with pixel count (due to efficiency)
      expect(timeRatio).toBeLessThan(mediumResult.pixelRatio * 1.5);
      expect(grainRatio).toBeGreaterThan(1.5); // Should have more grains in larger image
    }
  }, 15000);
  
  it('should demonstrate variable grain size generation effectiveness', async () => {
    // This test verifies that the variable grain size system works efficiently
    const width = 400;
    const height = 300;
    
    const settings: GrainSettings = {
      iso: 1200, // High ISO = more grains with size variation
      filmType: 'kodak',
      grainIntensity: 1.5,
      upscaleFactor: 1.0
    };
    
    console.log(`\n🎯 Testing variable grain size generation (ISO ${settings.iso})...`);
    
    const processor = await createGrainProcessor(width, height, settings);
    
    const start = performance.now();
    const grains = processor.generateGrainStructure();
    const end = performance.now();
    const processingTime = end - start;
    
    const grainsPerMs = grains.length / processingTime;
    
    // Analyze grain size distribution
    const sizes = grains.map(g => g.size);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    console.log(`  Processing time: ${processingTime.toFixed(2)}ms`);
    console.log(`  Total grains generated: ${grains.length}`);
    console.log(`  Grain generation rate: ${grainsPerMs.toFixed(0)} grains/ms`);
    console.log(`  Size range: ${minSize.toFixed(2)} - ${maxSize.toFixed(2)} (avg: ${avgSize.toFixed(2)})`);
    
    // With variable grain sizes, should process efficiently
    expect(processingTime).toBeLessThan(2000); // Should complete in under 2 seconds
    expect(grains.length).toBeGreaterThan(500); // Should generate substantial grains for high ISO
    expect(grainsPerMs).toBeGreaterThan(1); // Should maintain good throughput
    
    // Verify grain size variation
    expect(maxSize).toBeGreaterThan(minSize);
    expect(maxSize / minSize).toBeGreaterThan(1.5); // Should have meaningful size variation
    
    // Verify grain properties
    for (const grain of grains.slice(0, 10)) { // Check first 10 grains
      expect(grain.x).toBeGreaterThanOrEqual(0);
      expect(grain.x).toBeLessThan(width);
      expect(grain.y).toBeGreaterThanOrEqual(0);
      expect(grain.y).toBeLessThan(height);
      expect(grain.size).toBeGreaterThan(0);
      expect(grain.sensitivity).toBeGreaterThan(0);
      expect(typeof grain.shape).toBe('number');
    }
    
    console.log(`  Size variation: ${(maxSize / minSize).toFixed(2)}x range`);
  }, 10000);
});
