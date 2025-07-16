import { describe, it, expect } from 'vitest';
import { GrainProcessor } from '../src/grain-worker';
import type { GrainSettings } from '../src/types';

describe('Exposure Brightness Preservation', () => {
  const DEFAULT_SETTINGS: GrainSettings = {
    iso: 400,
    filmType: 'kodak',
    grainIntensity: 0.5,
    upscaleFactor: 1.0
  };

  function calculateAverageBrightness(imageData: { data: Uint8ClampedArray; width: number; height: number }): number {
    let totalBrightness = 0;
    const pixelCount = imageData.width * imageData.height;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i] / 255.0;
      const g = imageData.data[i + 1] / 255.0;
      const b = imageData.data[i + 2] / 255.0;
      
      // Calculate luminance using ITU-R BT.709 weights (same as the grain algorithm)
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalBrightness += brightness;
    }
    
    return totalBrightness / pixelCount;
  }

  function createTestImage(width: number, height: number, grayValue: number): { data: Uint8ClampedArray; width: number; height: number } {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = grayValue;     // Red
      data[i + 1] = grayValue; // Green
      data[i + 2] = grayValue; // Blue
      data[i + 3] = 255;       // Alpha
    }
    return { data, width, height };
  }

  it('should preserve overall brightness for middle gray (18% gray)', async () => {
    const width = 100;
    const height = 100;
    const grayValue = Math.round(255 * 0.18); // 18% middle gray
    
    const inputImage = createTestImage(width, height, grayValue);
    const grainProcessor = new GrainProcessor(width, height, DEFAULT_SETTINGS);
    
    const result = await grainProcessor.processImage(inputImage as ImageData);
    
    const inputBrightness = calculateAverageBrightness(inputImage);
    const outputBrightness = calculateAverageBrightness(result);
    
    console.log(`Input brightness: ${inputBrightness.toFixed(2)}`);
    console.log(`Output brightness: ${outputBrightness.toFixed(2)}`);
    console.log(`Brightness change: ${((outputBrightness - inputBrightness) / inputBrightness * 100).toFixed(2)}%`);
    
    // Allow 5% tolerance for grain effects
    const tolerance = 0.05;
    const brightnessDifference = Math.abs(outputBrightness - inputBrightness) / inputBrightness;
    
    expect(brightnessDifference).toBeLessThan(tolerance);
  });

  it('should preserve overall brightness for various gray levels', async () => {
    const width = 50;
    const height = 50;
    const testGrayValues = [64, 128, 192]; // 25%, 50%, 75% gray
    
    for (const grayValue of testGrayValues) {
      const inputImage = createTestImage(width, height, grayValue);
      const grainProcessor = new GrainProcessor(width, height, DEFAULT_SETTINGS);
      
      const result = await grainProcessor.processImage(inputImage as ImageData);
      
      const inputBrightness = calculateAverageBrightness(inputImage);
      const outputBrightness = calculateAverageBrightness(result);
      
      console.log(`Gray ${grayValue}: Input ${inputBrightness.toFixed(2)} -> Output ${outputBrightness.toFixed(2)} (${((outputBrightness - inputBrightness) / inputBrightness * 100).toFixed(2)}% change)`);
      
      // Allow 10% tolerance for grain effects at different brightness levels
      const tolerance = 0.10;
      const brightnessDifference = Math.abs(outputBrightness - inputBrightness) / inputBrightness;
      
      expect(brightnessDifference).toBeLessThan(tolerance);
    }
  });

  it('should preserve overall brightness for black and white extremes', async () => {
    const width = 50;
    const height = 50;
    
    // Test pure black (should have minimal grain effect)
    const blackImage = createTestImage(width, height, 0);
    const grainProcessor1 = new GrainProcessor(width, height, DEFAULT_SETTINGS);
    const blackResult = await grainProcessor1.processImage(blackImage as ImageData);
    
    const blackInputBrightness = calculateAverageBrightness(blackImage);
    const blackOutputBrightness = calculateAverageBrightness(blackResult);
    
    console.log(`Black: Input ${blackInputBrightness.toFixed(2)} -> Output ${blackOutputBrightness.toFixed(2)}`);
    
    // Black should remain very close to black
    expect(blackOutputBrightness).toBeLessThan(10);
    
    // Test pure white (should have grain effect but not be much darker)
    const whiteImage = createTestImage(width, height, 255);
    const grainProcessor2 = new GrainProcessor(width, height, DEFAULT_SETTINGS);
    const whiteResult = await grainProcessor2.processImage(whiteImage as ImageData);
    
    const whiteInputBrightness = calculateAverageBrightness(whiteImage);
    const whiteOutputBrightness = calculateAverageBrightness(whiteResult);
    
    console.log(`White: Input ${whiteInputBrightness.toFixed(2)} -> Output ${whiteOutputBrightness.toFixed(2)} (${((whiteOutputBrightness - whiteInputBrightness) / whiteInputBrightness * 100).toFixed(2)}% change)`);
    
    // White should not be significantly darkened by grain
    const whiteBrightnessDifference = Math.abs(whiteOutputBrightness - whiteInputBrightness) / whiteInputBrightness;
    expect(whiteBrightnessDifference).toBeLessThan(0.15); // Allow 15% tolerance for white
  });
});
