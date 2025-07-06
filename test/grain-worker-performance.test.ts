// Integration test for grain worker performance benchmarks
// Tests the actual grain processing worker to measure real-world performance improvements

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

describe('Grain Worker Performance Integration Tests', () => {
  it('should demonstrate multiple layers are efficiently processed', async () => {
    const width = 300;
    const height = 200;
    const totalPixels = width * height;
    
    console.log(`\n🧪 Testing grain generation performance for ${width}x${height} image...`);
    
    // Test single layer
    const singleLayerSettings: GrainSettings = {
      iso: 800,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1.0,
      useMultipleLayers: false
    };
    
    const singleProcessor = await createGrainProcessor(width, height, singleLayerSettings);
    
    const singleStart = performance.now();
    const singleResult = singleProcessor.generateGrainStructure();
    const singleEnd = performance.now();
    const singleTime = singleEnd - singleStart;
    
    // Test multiple layers
    const multiLayerSettings: GrainSettings = {
      iso: 800,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1.0,
      useMultipleLayers: true
    };
    
    const multiProcessor = await createGrainProcessor(width, height, multiLayerSettings);
    
    const multiStart = performance.now();
    const multiResult = multiProcessor.generateMultipleGrainLayers();
    const multiEnd = performance.now();
    const multiTime = multiEnd - multiStart;
    
    // Calculate performance metrics
    const performanceRatio = singleTime / multiTime;
    const singleGrainCount = Array.isArray(singleResult) ? singleResult.length : 0;
    const multiGrainCount = Array.isArray(multiResult) ? 
      multiResult.reduce((sum: number, layer: any) => sum + layer.grains.length, 0) : 0;
    
    console.log(`  Single layer: ${singleTime.toFixed(2)}ms (${singleGrainCount} grains)`);
    console.log(`  Multiple layers: ${multiTime.toFixed(2)}ms (${multiGrainCount} grains in ${multiResult.length} layers)`);
    console.log(`  Performance ratio: ${performanceRatio.toFixed(2)}x`);
    
    // Assertions
    expect(singleTime).toBeGreaterThan(0);
    expect(multiTime).toBeGreaterThan(0);
    expect(singleGrainCount).toBeGreaterThan(0);
    expect(multiGrainCount).toBeGreaterThan(0);
    expect(multiResult.length).toBe(3); // Should have 3 layers
    
    // Performance assertion - multiple layers should be reasonably fast
    expect(performanceRatio).toBeGreaterThan(0.3); // At least 30% as fast as single layer
    
    // If multiple layers is faster than single layer, that's even better!
    if (performanceRatio > 1) {
      console.log(`  🎉 Multiple layers is faster! This indicates excellent optimization.`);
    } else if (performanceRatio > 0.5) {
      console.log(`  ✅ Multiple layers performance is good - within acceptable range.`);
    }
  }, 10000);
  
  it('should scale performance appropriately with image size', async () => {
    const testSizes = [
      { width: 200, height: 150, name: 'small' },
      { width: 400, height: 300, name: 'medium' }
    ];
    
    const results: Array<{ size: string; ratio: number; multiTime: number }> = [];
    
    for (const size of testSizes) {
      console.log(`\n📏 Testing ${size.name} image (${size.width}x${size.height})...`);
      
      const singleSettings: GrainSettings = {
        iso: 600,
        filmType: 'kodak',
        grainIntensity: 1.0,
        upscaleFactor: 1.0,
        useMultipleLayers: false
      };
      
      const multiSettings: GrainSettings = {
        ...singleSettings,
        useMultipleLayers: true
      };
      
      // Single layer test
      const singleProcessor = await createGrainProcessor(size.width, size.height, singleSettings);
      const singleStart = performance.now();
      singleProcessor.generateGrainStructure();
      const singleTime = performance.now() - singleStart;
      
      // Multiple layers test
      const multiProcessor = await createGrainProcessor(size.width, size.height, multiSettings);
      const multiStart = performance.now();
      multiProcessor.generateMultipleGrainLayers();
      const multiTime = performance.now() - multiStart;
      
      const ratio = singleTime / multiTime;
      results.push({ size: size.name, ratio, multiTime });
      
      console.log(`  ${size.name}: ${ratio.toFixed(2)}x performance ratio`);
      
      // Each size should have reasonable performance
      expect(ratio).toBeGreaterThan(0.2); // At least 20% as fast
    }
    
    // Overall performance should be consistent across sizes
    const avgRatio = results.reduce((sum, r) => sum + r.ratio, 0) / results.length;
    console.log(`\n📊 Average performance ratio across sizes: ${avgRatio.toFixed(2)}x`);
    
    expect(avgRatio).toBeGreaterThan(0.3); // Average should be at least 30%
  }, 15000);
  
  it('should demonstrate grain-to-layer map optimization effectiveness', async () => {
    // This test verifies that the optimization actually works by testing edge cases
    const width = 400;
    const height = 300;
    
    const settings: GrainSettings = {
      iso: 1600, // High ISO = more grains = more potential for O(n²) problems
      filmType: 'kodak',
      grainIntensity: 1.5,
      upscaleFactor: 1.0,
      useMultipleLayers: true
    };
    
    console.log(`\n🎯 Testing optimization with high grain density (ISO ${settings.iso})...`);
    
    const processor = await createGrainProcessor(width, height, settings);
    
    const start = performance.now();
    const layers = processor.generateMultipleGrainLayers();
    const end = performance.now();
    const processingTime = end - start;
    
    const totalGrains = layers.reduce((sum, layer) => sum + layer.grains.length, 0);
    const grainsPerMs = totalGrains / processingTime;
    
    console.log(`  Processing time: ${processingTime.toFixed(2)}ms`);
    console.log(`  Total grains generated: ${totalGrains}`);
    console.log(`  Grain generation rate: ${grainsPerMs.toFixed(0)} grains/ms`);
    
    // With optimization, even high grain counts should process quickly
    expect(processingTime).toBeLessThan(500); // Should complete in under 500ms
    expect(totalGrains).toBeGreaterThan(1000); // Should generate substantial grains for high ISO
    expect(grainsPerMs).toBeGreaterThan(10); // Should maintain good throughput
    
    // Verify we have the expected layer structure
    expect(layers).toHaveLength(3);
    expect(layers[0].layerType).toBe('primary');
    expect(layers[1].layerType).toBe('secondary');
    expect(layers[2].layerType).toBe('micro');
    
    console.log(`  Layer breakdown: ${layers.map(l => `${l.layerType}(${l.grains.length})`).join(', ')}`);
  }, 10000);
});
