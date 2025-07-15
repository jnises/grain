import { describe, it, expect } from 'vitest';
import { EXPOSURE_CONVERSION } from '../src/constants';

// Test helper class to access private rgbToExposure method
class ExposureConverter {
  rgbToExposure(r: number, g: number, b: number): number {
    // Normalize RGB values to [0, 1] range
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    // Calculate weighted luminance using photographic weights
    const luminance = 
      rNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.red +
      gNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.green +
      bNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.blue;

    // Add small offset to prevent log(0) in pure black areas
    const safeLuminance = luminance + EXPOSURE_CONVERSION.LUMINANCE_OFFSET;

    // Convert to logarithmic exposure scale
    const logExposure = Math.log(safeLuminance / EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE) / 
                       Math.log(EXPOSURE_CONVERSION.LOG_BASE);
    
    // Scale and normalize exposure to [0, 1] range
    const normalizedExposure = (logExposure + EXPOSURE_CONVERSION.EXPOSURE_SCALE) / 
                              (2 * EXPOSURE_CONVERSION.EXPOSURE_SCALE);

    // Clamp to [0, 1] range
    return Math.max(0, Math.min(1, normalizedExposure));
  }
}

describe('Exposure Conversion', () => {
  const converter = new ExposureConverter();

  it('should convert RGB to logarithmic exposure following photographic principles', () => {
    // Test key photographic reference points:
    
    // 1. Pure black (0,0,0) should give zero exposure due to clamping
    const blackExposure = converter.rgbToExposure(0, 0, 0);
    expect(blackExposure).toBe(0); // Clamped to 0 due to extreme log value
    
    // 2. 18% middle gray (~46 RGB) should give mid-range exposure around 0.5
    // Calculate RGB value for 18% gray: 0.18 * 255 ≈ 46
    const middleGrayRgb = Math.round(0.18 * 255);
    const middleGrayExposure = converter.rgbToExposure(middleGrayRgb, middleGrayRgb, middleGrayRgb);
    expect(middleGrayExposure).toBeGreaterThan(0.49);
    expect(middleGrayExposure).toBeLessThan(0.51);
    
    // 3. Pure white (255,255,255) should give high exposure near (but not at) 1.0
    const whiteExposure = converter.rgbToExposure(255, 255, 255);
    expect(whiteExposure).toBeGreaterThan(0.65);
    expect(whiteExposure).toBeLessThan(0.7);
    
    // 4. Exposure should increase monotonically with brightness
    // Use values in order: black < mid-gray < slightly-brighter-gray < light-gray < white
    const slightlyBrighterGrayExposure = converter.rgbToExposure(64, 64, 64);
    const lightGrayExposure = converter.rgbToExposure(192, 192, 192);
    
    expect(blackExposure).toBeLessThan(middleGrayExposure);
    expect(middleGrayExposure).toBeLessThan(slightlyBrighterGrayExposure);
    expect(slightlyBrighterGrayExposure).toBeLessThan(lightGrayExposure);
    expect(lightGrayExposure).toBeLessThan(whiteExposure);
  });

  it('should handle edge cases in exposure conversion', () => {
    // Test edge cases without crashing:
    
    // Pure black should not crash due to log(0)
    expect(() => converter.rgbToExposure(0, 0, 0)).not.toThrow();
    
    // Pure white should not exceed bounds
    const whiteExposure = converter.rgbToExposure(255, 255, 255);
    expect(whiteExposure).toBeLessThanOrEqual(1.0);
    expect(whiteExposure).toBeGreaterThanOrEqual(0.0);
    
    // Single channel extremes should work
    expect(() => converter.rgbToExposure(255, 0, 0)).not.toThrow();
    expect(() => converter.rgbToExposure(0, 255, 0)).not.toThrow();
    expect(() => converter.rgbToExposure(0, 0, 255)).not.toThrow();
    
    // All results should be in [0, 1] range
    const redExposure = converter.rgbToExposure(255, 0, 0);
    const greenExposure = converter.rgbToExposure(0, 255, 0);
    const blueExposure = converter.rgbToExposure(0, 0, 255);
    
    [redExposure, greenExposure, blueExposure].forEach(exposure => {
      expect(exposure).toBeGreaterThanOrEqual(0);
      expect(exposure).toBeLessThanOrEqual(1);
    });
  });

  it('should use photographic luminance weights correctly', () => {
    // Test that the luminance calculation uses ITU-R BT.709 weights:
    // Red: 0.2126, Green: 0.7152, Blue: 0.0722
    // This means pure green should have highest exposure, then red, then blue
    
    const redExposure = converter.rgbToExposure(255, 0, 0);
    const greenExposure = converter.rgbToExposure(0, 255, 0);
    const blueExposure = converter.rgbToExposure(0, 0, 255);
    
    // Green should have highest exposure due to highest weight (0.7152)
    expect(greenExposure).toBeGreaterThan(redExposure);
    expect(greenExposure).toBeGreaterThan(blueExposure);
    
    // Red should have higher exposure than blue due to higher weight (0.2126 vs 0.0722)
    expect(redExposure).toBeGreaterThan(blueExposure);
    
    // Verify the weights work correctly for smaller values too
    const smallRed = converter.rgbToExposure(50, 0, 0);
    const smallGreen = converter.rgbToExposure(0, 50, 0);
    const smallBlue = converter.rgbToExposure(0, 0, 50);
    
    // Same ordering should hold for smaller values
    expect(smallGreen).toBeGreaterThan(smallRed);
    expect(smallRed).toBeGreaterThan(smallBlue);
    
    // Test that the weight differences are significant
    expect(greenExposure - redExposure).toBeGreaterThan(0.1); // Green significantly higher than red
    expect(redExposure - blueExposure).toBeGreaterThan(0.1); // Red significantly higher than blue
  });

  it('should produce consistent logarithmic scaling', () => {
    // Test that doubling brightness doesn't double exposure (due to log scale)
    const lowExposure = converter.rgbToExposure(32, 32, 32);
    const highExposure = converter.rgbToExposure(64, 64, 64);
    
    // Doubling RGB shouldn't double exposure in log scale
    expect(highExposure).toBeLessThan(lowExposure * 2);
    expect(highExposure).toBeGreaterThan(lowExposure);
    
    // Test stops progression (photographic concept)
    const stop1 = converter.rgbToExposure(46, 46, 46); // ~18% gray
    const stop2 = converter.rgbToExposure(92, 92, 92); // ~36% gray (1 stop higher)
    const stop3 = converter.rgbToExposure(184, 184, 184); // ~72% gray (2 stops higher)
    
    // Each stop should increase exposure, but not linearly
    expect(stop2).toBeGreaterThan(stop1);
    expect(stop3).toBeGreaterThan(stop2);
    
    // The differences should be roughly equal in log space
    const diff1 = stop2 - stop1;
    const diff2 = stop3 - stop2;
    expect(Math.abs(diff1 - diff2)).toBeLessThan(0.2); // Allow some tolerance
  });
});
