// Tests for color space conversion functions
import { describe, it, expect } from 'vitest';
import { srgbToLinear, linearToSrgb, rgbToLab } from '../src/color-space';

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

  describe('rgbToLab function', () => {
    it('should convert white RGB (255,255,255) to approximately white LAB', () => {
      const lab = rgbToLab(255, 255, 255);
      expect(lab.l).toBeCloseTo(100, 1); // L should be close to 100 for white
      expect(lab.a).toBeCloseTo(0, 1);   // a should be close to 0 for neutral
      expect(lab.b).toBeCloseTo(0, 1);   // b should be close to 0 for neutral
    });

    it('should convert black RGB (0,0,0) to approximately black LAB', () => {
      const lab = rgbToLab(0, 0, 0);
      expect(lab.l).toBeCloseTo(0, 1);   // L should be close to 0 for black
      expect(lab.a).toBeCloseTo(0, 1);   // a should be close to 0 for neutral
      expect(lab.b).toBeCloseTo(0, 1);   // b should be close to 0 for neutral
    });

    it('should convert red RGB (255,0,0) to positive a value', () => {
      const lab = rgbToLab(255, 0, 0);
      expect(lab.a).toBeGreaterThan(0);  // Red should have positive a
    });

    it('should convert blue RGB (0,0,255) to negative b value', () => {
      const lab = rgbToLab(0, 0, 255);
      expect(lab.b).toBeLessThan(0);     // Blue should have negative b
    });

    it('should handle mid-gray consistently', () => {
      const lab = rgbToLab(128, 128, 128);
      expect(lab.l).toBeGreaterThan(0);
      expect(lab.l).toBeLessThan(100);
      expect(lab.a).toBeCloseTo(0, 1);   // Should be neutral
      expect(lab.b).toBeCloseTo(0, 1);   // Should be neutral
    });

    it('should throw on invalid RGB values', () => {
      expect(() => rgbToLab(-1, 0, 0)).toThrow();
      expect(() => rgbToLab(0, -1, 0)).toThrow();
      expect(() => rgbToLab(0, 0, -1)).toThrow();
      expect(() => rgbToLab(256, 0, 0)).toThrow();
      expect(() => rgbToLab(0, 256, 0)).toThrow();
      expect(() => rgbToLab(0, 0, 256)).toThrow();
    });
  });
});
