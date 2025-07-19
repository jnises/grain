// Tests for color space conversion functions
import { describe, it, expect } from 'vitest';
import { srgbToLinear, linearToSrgb, convertImageDataToGrayscale } from '../src/color-space';

describe('Color Space Conversions', () => {
  describe('Gamma Correction Functions', () => {
    // Note: These functions are mathematical inverses but not perfect due to 
    // floating-point precision limitations. Tests use realistic tolerances.
    
    describe('srgbToLinear and linearToSrgb inverse relationship', () => {
      it('should be perfect inverses for values in [0,1] range', () => {
        // Test a comprehensive range of values
        const testValues = [
          0.0,     // Black
          0.001,   // Very dark
          0.01,    // Dark
          0.04045, // Gamma threshold
          0.1,     // Low gamma
          0.2,     // Low-mid
          0.5,     // Mid gray
          0.7,     // High-mid
          0.9,     // Bright
          0.99,    // Very bright
          1.0      // White
        ];

        for (const srgbValue of testValues) {
          // sRGB → Linear → sRGB should equal original
          const linear = srgbToLinear(srgbValue);
          const backToSrgb = linearToSrgb(linear);
          
          expect(backToSrgb).toBeCloseTo(srgbValue, 7);
        }
      });

      it('should be perfect inverses for linear values in [0,1] range', () => {
        const testValues = [
          0.0,       // Black
          0.000001,  // Very dark linear
          0.0031308, // Linear threshold  
          0.01,      // Low linear
          0.1,       // Mid linear
          0.5,       // High linear
          0.9,       // Very high linear
          1.0        // White
        ];

        for (const linearValue of testValues) {
          // Linear → sRGB → Linear should equal original
          const srgb = linearToSrgb(linearValue);
          const backToLinear = srgbToLinear(srgb);
          
          expect(backToLinear).toBeCloseTo(linearValue, 10);
        }
      });

      it('should handle the gamma threshold transition smoothly', () => {
        // Test values around the threshold to ensure continuity
        const thresholdArea = [
          0.04044,  // Just below threshold
          0.04045,  // At threshold
          0.04046   // Just above threshold
        ];

        for (const value of thresholdArea) {
          const linear = srgbToLinear(value);
          const backToSrgb = linearToSrgb(linear);
          
          expect(backToSrgb).toBeCloseTo(value, 6);
        }
      });

      it('should handle the linear threshold transition smoothly', () => {
        // Test values around the linear threshold
        const thresholdArea = [
          0.0031307,  // Just below linear threshold
          0.0031308,  // At linear threshold
          0.0031309   // Just above linear threshold
        ];

        for (const value of thresholdArea) {
          const srgb = linearToSrgb(value);
          const backToLinear = srgbToLinear(srgb);
          
          expect(backToLinear).toBeCloseTo(value, 8);
        }
      });
    });

    describe('srgbToLinear function properties', () => {
      it('should return 0 for input 0', () => {
        expect(srgbToLinear(0)).toBe(0);
      });

      it('should return 1 for input 1', () => {
        expect(srgbToLinear(1)).toBe(1);
      });

      it('should be monotonically increasing', () => {
        const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
        const linearValues = values.map(srgbToLinear);
        
        for (let i = 1; i < linearValues.length; i++) {
          expect(linearValues[i]).toBeGreaterThan(linearValues[i - 1]);
        }
      });

      it('should use linear scaling below threshold', () => {
        const lowValue = 0.02; // Below 0.04045 threshold
        const expected = lowValue / 12.92;
        expect(srgbToLinear(lowValue)).toBeCloseTo(expected, 10);
      });

      it('should use power function above threshold', () => {
        const highValue = 0.5; // Above 0.04045 threshold
        const expected = Math.pow((highValue + 0.055) / 1.055, 2.4);
        expect(srgbToLinear(highValue)).toBeCloseTo(expected, 10);
      });
    });

    describe('linearToSrgb function properties', () => {
      it('should return 0 for input 0', () => {
        expect(linearToSrgb(0)).toBe(0);
      });

      it('should return 1 for input 1', () => {
        expect(linearToSrgb(1)).toBeCloseTo(1, 10);
      });

      it('should be monotonically increasing', () => {
        const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
        const srgbValues = values.map(linearToSrgb);
        
        for (let i = 1; i < srgbValues.length; i++) {
          expect(srgbValues[i]).toBeGreaterThan(srgbValues[i - 1]);
        }
      });

      it('should use linear scaling below threshold', () => {
        const lowValue = 0.001; // Below 0.0031308 threshold
        const expected = lowValue * 12.92;
        expect(linearToSrgb(lowValue)).toBeCloseTo(expected, 10);
      });

      it('should use power function above threshold', () => {
        const highValue = 0.1; // Above 0.0031308 threshold
        const expected = 1.055 * Math.pow(highValue, 1.0 / 2.4) - 0.055;
        expect(linearToSrgb(highValue)).toBeCloseTo(expected, 10);
      });
    });
  });

  describe('Grayscale Conversion', () => {
    // Helper function to create mock ImageData for testing
    function createMockImageData(width: number, height: number, rgbValues: number[][]): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let i = 0; i < rgbValues.length; i++) {
        const baseIndex = i * 4;
        data[baseIndex] = rgbValues[i][0];     // Red
        data[baseIndex + 1] = rgbValues[i][1]; // Green
        data[baseIndex + 2] = rgbValues[i][2]; // Blue
        data[baseIndex + 3] = rgbValues[i][3] !== undefined ? rgbValues[i][3] : 255; // Alpha
      }
      
      return { width, height, data } as ImageData;
    }

    describe('convertImageDataToGrayscale', () => {
      it('should convert pure colors to correct grayscale values', () => {
        const testImage = createMockImageData(2, 2, [
          [255, 0, 0, 255],   // Pure red
          [0, 255, 0, 255],   // Pure green
          [0, 0, 255, 255],   // Pure blue
          [255, 255, 255, 255] // Pure white
        ]);
        
        const grayscaleImage = convertImageDataToGrayscale(testImage);
        
        // Check dimensions are preserved
        expect(grayscaleImage.width).toBe(2);
        expect(grayscaleImage.height).toBe(2);
        expect(grayscaleImage.data.length).toBe(16); // 2x2 pixels * 4 channels
        
        // Check ITU-R BT.709 weighted conversions in linear space
        // Red: sRGB(255,0,0) -> linear -> weighted -> sRGB ≈ 127
        expect(grayscaleImage.data[0]).toBe(127);  // Red channel
        expect(grayscaleImage.data[1]).toBe(127);  // Green channel
        expect(grayscaleImage.data[2]).toBe(127);  // Blue channel
        expect(grayscaleImage.data[3]).toBe(255);  // Alpha preserved
        
        // Green: sRGB(0,255,0) -> linear -> weighted -> sRGB ≈ 220
        expect(grayscaleImage.data[4]).toBe(220);  // Red channel
        expect(grayscaleImage.data[5]).toBe(220);  // Green channel
        expect(grayscaleImage.data[6]).toBe(220);  // Blue channel
        expect(grayscaleImage.data[7]).toBe(255);  // Alpha preserved
        
        // Blue: sRGB(0,0,255) -> linear -> weighted -> sRGB ≈ 76
        expect(grayscaleImage.data[8]).toBe(76);   // Red channel
        expect(grayscaleImage.data[9]).toBe(76);   // Green channel
        expect(grayscaleImage.data[10]).toBe(76);  // Blue channel
        expect(grayscaleImage.data[11]).toBe(255); // Alpha preserved
        
        // White: Linear luminance calculation results in 255
        expect(grayscaleImage.data[12]).toBe(255); // Red channel
        expect(grayscaleImage.data[13]).toBe(255); // Green channel
        expect(grayscaleImage.data[14]).toBe(255); // Blue channel
        expect(grayscaleImage.data[15]).toBe(255); // Alpha preserved
      });

      it('should handle black and gray values correctly', () => {
        const testImage = createMockImageData(1, 3, [
          [0, 0, 0, 255],     // Black
          [128, 128, 128, 255], // Middle gray
          [64, 96, 160, 128]  // Mixed color with partial alpha
        ]);
        
        const grayscaleImage = convertImageDataToGrayscale(testImage);
        
        // Black should remain black
        expect(grayscaleImage.data[0]).toBe(0);
        expect(grayscaleImage.data[1]).toBe(0);
        expect(grayscaleImage.data[2]).toBe(0);
        expect(grayscaleImage.data[3]).toBe(255);
        
        // Middle gray should remain middle gray
        expect(grayscaleImage.data[4]).toBe(128);
        expect(grayscaleImage.data[5]).toBe(128);
        expect(grayscaleImage.data[6]).toBe(128);
        expect(grayscaleImage.data[7]).toBe(255);
        
        // Mixed color in linear space: sRGB(64,96,160) -> linear -> weighted -> sRGB ≈ 97
        expect(grayscaleImage.data[8]).toBe(97);
        expect(grayscaleImage.data[9]).toBe(97);
        expect(grayscaleImage.data[10]).toBe(97);
        expect(grayscaleImage.data[11]).toBe(128); // Alpha preserved
      });

      it('should preserve alpha channel correctly', () => {
        const testImage = createMockImageData(1, 2, [
          [255, 255, 255, 0],   // White with transparent alpha
          [255, 255, 255, 127]  // White with semi-transparent alpha
        ]);
        
        const grayscaleImage = convertImageDataToGrayscale(testImage);
        
        // Check alpha values are preserved
        expect(grayscaleImage.data[3]).toBe(0);   // Transparent
        expect(grayscaleImage.data[7]).toBe(127); // Semi-transparent
      });

      it('should handle edge case values without errors', () => {
        const testImage = createMockImageData(1, 1, [
          [255, 255, 255, 255]
        ]);
        
        expect(() => convertImageDataToGrayscale(testImage)).not.toThrow();
        
        const result = convertImageDataToGrayscale(testImage);
        expect(result.width).toBe(1);
        expect(result.height).toBe(1);
        expect(result.data.length).toBe(4);
      });
    });
  });
});
