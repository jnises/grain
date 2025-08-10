import { describe, it, expect } from 'vitest';
import { createTestGrainProcessor, createMockImageData } from './test-utils.js';
import type { GrainSettings } from '../src/types.js';

describe('GrainProcessor White Output Fix', () => {
  const defaultSettings: GrainSettings = {
    iso: 800,
    filmType: 'kodak',
  };

  it('should preserve middle gray on average when processing middle gray input', async () => {
    // Test parameters
    const width = 100;
    const height = 100;
    const middleGray = 128; // Middle gray value (0-255)
    
    // Create test processor and middle gray image
    const processor = createTestGrainProcessor(width, height, defaultSettings);
    const inputImage = createMockImageData(width, height, middleGray);
    
    // Process the image
    const result = await processor.processImage(inputImage);
    
    // Calculate average output values
    let totalR = 0, totalG = 0, totalB = 0;
    const pixelCount = width * height;
    
    for (let i = 0; i < result.data.length; i += 4) {
      totalR += result.data[i];
      totalG += result.data[i + 1];
      totalB += result.data[i + 2];
    }
    
    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;
    
    console.log(`Input: ${middleGray}, Output averages: R=${avgR.toFixed(1)}, G=${avgG.toFixed(1)}, B=${avgB.toFixed(1)}`);
    
    // The output should be close to the input on average
    // Allow some tolerance for grain effects, but not massive deviation
    const tolerance = 30; // Allow ±30 from middle gray (reasonable for grain effects)
    
    expect(avgR).toBeGreaterThan(middleGray - tolerance);
    expect(avgR).toBeLessThan(middleGray + tolerance);
    expect(avgG).toBeGreaterThan(middleGray - tolerance);
    expect(avgG).toBeLessThan(middleGray + tolerance);
    expect(avgB).toBeGreaterThan(middleGray - tolerance);
    expect(avgB).toBeLessThan(middleGray + tolerance);
    
    // Also check that we're not getting mostly white output (>240)
    let whitePixels = 0;
    for (let i = 0; i < result.data.length; i += 4) {
      if (result.data[i] > 240 && result.data[i + 1] > 240 && result.data[i + 2] > 240) {
        whitePixels++;
      }
    }
    
    const whitePixelPercentage = (whitePixels / pixelCount) * 100;
    console.log(`White pixels: ${whitePixels}/${pixelCount} (${whitePixelPercentage.toFixed(1)}%)`);
    
    // Should not have mostly white output (this was the bug)
    expect(whitePixelPercentage).toBeLessThan(50); // Less than 50% should be white
  });

  it('should not produce completely white output for any reasonable input', async () => {
    // Test with different gray levels to ensure we don't get white output anywhere
    const width = 50;
    const height = 50;
    const testGrayLevels = [64, 128, 192]; // Dark gray, middle gray, light gray
    
    for (const grayLevel of testGrayLevels) {
      const processor = createTestGrainProcessor(width, height, defaultSettings);
      const inputImage = createMockImageData(width, height, grayLevel);
      
      const result = await processor.processImage(inputImage);
      
      // Count white pixels
      let whitePixels = 0;
      const pixelCount = width * height;
      
      for (let i = 0; i < result.data.length; i += 4) {
        if (result.data[i] > 240 && result.data[i + 1] > 240 && result.data[i + 2] > 240) {
          whitePixels++;
        }
      }
      
      const whitePixelPercentage = (whitePixels / pixelCount) * 100;
      
      console.log(`Input gray level ${grayLevel}: ${whitePixelPercentage.toFixed(1)}% white pixels`);
      
      // For any input, we shouldn't get more than 80% white pixels
      // (even light gray input should show some grain variation)
      expect(whitePixelPercentage).toBeLessThan(80);
    }
  });
});
