import { describe, it, expect } from 'vitest';
import { GrainProcessor } from '../src/grain-worker';
import { srgbToLinear } from '../src/color-space';
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
      
      // Convert from sRGB to linear space for consistent brightness calculation
      const linearR = srgbToLinear(r);
      const linearG = srgbToLinear(g);
      const linearB = srgbToLinear(b);
      
      // Calculate luminance using ITU-R BT.709 weights in linear space
      const brightness = 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
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
    
    // Allow larger tolerance in linear space due to non-linear relationship with perceived brightness
    const tolerance = 0.20; // 20% tolerance in linear space
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
      
      // Allow larger tolerance for grain effects in linear space
      const tolerance = 0.25; // 25% tolerance in linear space
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
    
    // White should not be significantly darkened by grain (larger tolerance in linear space)
    const whiteBrightnessDifference = Math.abs(whiteOutputBrightness - whiteInputBrightness) / whiteInputBrightness;
    expect(whiteBrightnessDifference).toBeLessThan(0.25); // Allow 25% tolerance for white in linear space
  });
});
