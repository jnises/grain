import { describe, it, expect } from 'vitest';
import { rgbToExposureFloat } from '../src/grain-math';

describe('Exposure Conversion', () => {
  it('should convert RGB to logarithmic exposure following photographic principles', () => {
    // Test key photographic reference points:
    
    // 1. Pure black (0,0,0) should give zero exposure due to clamping
    const blackExposure = rgbToExposureFloat(0, 0, 0);
    expect(blackExposure).toBe(0); // Clamped to 0 due to extreme log value
    
    // 2. 18% middle gray should give mid-range exposure around 0.5
    const middleGrayFloat = 0.18; // 18% gray in floating-point
    const middleGrayExposure = rgbToExposureFloat(middleGrayFloat, middleGrayFloat, middleGrayFloat);
    expect(middleGrayExposure).toBeGreaterThan(0.49);
    expect(middleGrayExposure).toBeLessThan(0.51);
    
    // 3. Pure white (1.0,1.0,1.0) should give high exposure near (but not at) 1.0
    const whiteExposure = rgbToExposureFloat(1.0, 1.0, 1.0);
    expect(whiteExposure).toBeGreaterThan(0.65);
    expect(whiteExposure).toBeLessThan(0.7);
    
    // 4. Exposure should increase monotonically with brightness
    // Use values in order: black < mid-gray < slightly-brighter-gray < light-gray < white
    const slightlyBrighterGrayExposure = rgbToExposureFloat(0.25, 0.25, 0.25); // 64/255 ≈ 0.25
    const lightGrayExposure = rgbToExposureFloat(0.75, 0.75, 0.75); // 192/255 ≈ 0.75
    
    expect(blackExposure).toBeLessThan(middleGrayExposure);
    expect(middleGrayExposure).toBeLessThan(slightlyBrighterGrayExposure);
    expect(slightlyBrighterGrayExposure).toBeLessThan(lightGrayExposure);
    expect(lightGrayExposure).toBeLessThan(whiteExposure);
  });

  it('should handle edge cases in exposure conversion', () => {
    // Test edge cases without crashing:
    
    // Pure black should not crash due to log(0)
    expect(() => rgbToExposureFloat(0, 0, 0)).not.toThrow();
    
    // Pure white should not exceed bounds
    const whiteExposure = rgbToExposureFloat(1.0, 1.0, 1.0);
    expect(whiteExposure).toBeLessThanOrEqual(1.0);
    expect(whiteExposure).toBeGreaterThanOrEqual(0.0);
    
    // Single channel extremes should work
    expect(() => rgbToExposureFloat(1.0, 0, 0)).not.toThrow();
    expect(() => rgbToExposureFloat(0, 1.0, 0)).not.toThrow();
    expect(() => rgbToExposureFloat(0, 0, 1.0)).not.toThrow();
    
    // All results should be in [0, 1] range
    const redExposure = rgbToExposureFloat(1.0, 0, 0);
    const greenExposure = rgbToExposureFloat(0, 1.0, 0);
    const blueExposure = rgbToExposureFloat(0, 0, 1.0);
    
    [redExposure, greenExposure, blueExposure].forEach(exposure => {
      expect(exposure).toBeGreaterThanOrEqual(0);
      expect(exposure).toBeLessThanOrEqual(1);
    });
  });

  it('should use photographic luminance weights correctly', () => {
    // Test that the luminance calculation uses ITU-R BT.709 weights:
    // Red: 0.2126, Green: 0.7152, Blue: 0.0722
    // This means pure green should have highest exposure, then red, then blue
    
    const redExposure = rgbToExposureFloat(1.0, 0, 0);
    const greenExposure = rgbToExposureFloat(0, 1.0, 0);
    const blueExposure = rgbToExposureFloat(0, 0, 1.0);
    
    // Green should have highest exposure due to highest weight (0.7152)
    expect(greenExposure).toBeGreaterThan(redExposure);
    expect(greenExposure).toBeGreaterThan(blueExposure);
    
    // Red should have higher exposure than blue due to higher weight (0.2126 vs 0.0722)
    expect(redExposure).toBeGreaterThan(blueExposure);
    
    // Verify the weights work correctly for smaller values too
    const smallRed = rgbToExposureFloat(0.2, 0, 0); // 50/255 ≈ 0.2
    const smallGreen = rgbToExposureFloat(0, 0.2, 0);
    const smallBlue = rgbToExposureFloat(0, 0, 0.2);
    
    // Same ordering should hold for smaller values
    expect(smallGreen).toBeGreaterThan(smallRed);
    expect(smallRed).toBeGreaterThan(smallBlue);
    
    // Test that the weight differences are significant
    expect(greenExposure - redExposure).toBeGreaterThan(0.1); // Green significantly higher than red
    expect(redExposure - blueExposure).toBeGreaterThan(0.1); // Red significantly higher than blue
  });

  it('should produce consistent logarithmic scaling', () => {
    // Test that doubling lightness doesn't double exposure (due to log scale)
    const lowExposure = rgbToExposureFloat(0.125, 0.125, 0.125); // 32/255 ≈ 0.125
    const highExposure = rgbToExposureFloat(0.25, 0.25, 0.25); // 64/255 ≈ 0.25
    
    // Doubling RGB shouldn't double exposure in log scale
    expect(highExposure).toBeLessThan(lowExposure * 2);
    expect(highExposure).toBeGreaterThan(lowExposure);
    
    // Test stops progression (photographic concept)
    const stop1 = rgbToExposureFloat(0.18, 0.18, 0.18); // 18% gray
    const stop2 = rgbToExposureFloat(0.36, 0.36, 0.36); // 36% gray (1 stop higher)
    const stop3 = rgbToExposureFloat(0.72, 0.72, 0.72); // 72% gray (2 stops higher)
    
    // Each stop should increase exposure, but not linearly
    expect(stop2).toBeGreaterThan(stop1);
    expect(stop3).toBeGreaterThan(stop2);
    
    // The differences should be roughly equal in log space
    const diff1 = stop2 - stop1;
    const diff2 = stop3 - stop2;
    expect(Math.abs(diff1 - diff2)).toBeLessThan(0.2); // Allow some tolerance
  });
});
