import { describe, it, expect } from 'vitest';
import { calculateLightnessFactor } from '../src/grain-math.js';

describe('calculateLightnessFactor', () => {
  const createRgbaArray = (values: number[]): Float32Array => {
    // Convert grayscale values to RGBA format (R=G=B=value, A=1)
    const rgba = new Float32Array(values.length * 4);
    for (let i = 0; i < values.length; i++) {
      rgba[i * 4] = values[i];     // R
      rgba[i * 4 + 1] = values[i]; // G
      rgba[i * 4 + 2] = values[i]; // B
      rgba[i * 4 + 3] = 1.0;       // A
    }
    return rgba;
  };

  it('should return 1.0 when original and processed have same lightness', () => {
    const original = createRgbaArray([0.5, 0.3, 0.8]);
    const processed = createRgbaArray([0.5, 0.3, 0.8]);
    
    const factor = calculateLightnessFactor(original, processed);
    expect(factor).toBeCloseTo(1.0, 6);
  });

  it('should return factor > 1 when processed is darker than original', () => {
    const original = createRgbaArray([0.8, 0.6, 0.4]);
    const processed = createRgbaArray([0.4, 0.3, 0.2]);
    
    const factor = calculateLightnessFactor(original, processed);
    expect(factor).toBeGreaterThan(1.0);
  });

  it('should return factor < 1 when processed is lighter than original', () => {
    const original = createRgbaArray([0.3, 0.2, 0.1]);
    const processed = createRgbaArray([0.6, 0.4, 0.2]);
    
    const factor = calculateLightnessFactor(original, processed);
    expect(factor).toBeLessThan(1.0);
  });

  it('should calculate correct ratio for simple case', () => {
    const original = createRgbaArray([0.6]); // Single pixel with 0.6 lightness
    const processed = createRgbaArray([0.3]); // Single pixel with 0.3 lightness
    
    const factor = calculateLightnessFactor(original, processed);
    expect(factor).toBeCloseTo(2.0, 6); // 0.6 / 0.3 = 2.0
  });

  it('should handle dark images correctly (below DARK_THRESHOLD)', () => {
    const original = createRgbaArray([0.005]); // Very dark original (below 0.01 threshold)
    const processed = createRgbaArray([0.003]); // Even darker processed
    
    const factor = calculateLightnessFactor(original, processed);
    // For dark images, should be clamped to <= 1.0
    expect(factor).toBeLessThanOrEqual(1.0);
    // Should return Math.min(1.0, 0.005 / Math.max(0.003, 0.001)) = Math.min(1.0, 0.005 / 0.003) = 1.0
    expect(factor).toBeCloseTo(1.0, 6);
  });

  it('should handle near-black processed image', () => {
    const original = createRgbaArray([0.5]);
    const processed = createRgbaArray([0.0001]); // Very close to black
    
    const factor = calculateLightnessFactor(original, processed);
    // Should return 1.0 when processed is nearly black to avoid extreme corrections
    expect(factor).toBe(1.0);
  });

  it('should clamp extreme lightness factors to maximum bound', () => {
    const original = createRgbaArray([0.9]);
    const processed = createRgbaArray([0.001]); // Very dark but above threshold
    
    const factor = calculateLightnessFactor(original, processed);
    // Should be clamped to maximum (100.0)
    expect(factor).toBe(100.0);
  });

  it('should clamp very small lightness factors to minimum bound', () => {
    const original = createRgbaArray([0.001]); // Below DARK_THRESHOLD, so special logic applies
    const processed = createRgbaArray([0.9]);
    
    const factor = calculateLightnessFactor(original, processed);
    // Since 0.001 < 0.01 (DARK_THRESHOLD), uses Math.min(1.0, 0.001 / 0.9)
    const expected = Math.min(1.0, 0.001 / 0.9);
    expect(factor).toBeCloseTo(expected, 6);
  });

  it('should clamp lightness factors to minimum bound for non-dark images', () => {
    const original = createRgbaArray([0.02]); // Above DARK_THRESHOLD
    const processed = createRgbaArray([10.0]); // Very bright processed
    
    const factor = calculateLightnessFactor(original, processed);
    // Should be clamped to minimum (0.01) since normal calculation would be 0.02/10 = 0.002
    expect(factor).toBe(0.01);
  });

  it('should work with multiple pixels', () => {
    const original = createRgbaArray([0.1, 0.3, 0.5, 0.7]); // Average = 0.4
    const processed = createRgbaArray([0.05, 0.15, 0.25, 0.35]); // Average = 0.2
    
    const factor = calculateLightnessFactor(original, processed);
    expect(factor).toBeCloseTo(2.0, 6); // 0.4 / 0.2 = 2.0
  });

  it('should handle pure black original image', () => {
    const original = createRgbaArray([0.0, 0.0, 0.0]);
    const processed = createRgbaArray([0.1, 0.2, 0.3]);
    
    const factor = calculateLightnessFactor(original, processed);
    // For zero original lightness and dark threshold logic, should return Math.min(1.0, 0 / 0.2) = 0
    expect(factor).toBe(0);
  });

  it('should handle identical arrays with various lightness levels', () => {
    const testValues = [0.1, 0.5, 0.9];
    
    for (const value of testValues) {
      const data = createRgbaArray([value, value, value]);
      const factor = calculateLightnessFactor(data, data);
      expect(factor).toBeCloseTo(1.0, 6);
    }
  });

  // Error cases
  it('should throw error for empty arrays', () => {
    const empty = new Float32Array(0);
    const nonEmpty = createRgbaArray([0.5]);
    
    expect(() => calculateLightnessFactor(empty, nonEmpty)).toThrow('originalData must not be empty');
  });

  it('should throw error for mismatched array lengths', () => {
    const short = createRgbaArray([0.5]);
    const long = createRgbaArray([0.5, 0.3]);
    
    expect(() => calculateLightnessFactor(short, long)).toThrow('processedData must have same length as originalData');
  });

  it('should throw error for non-RGBA format (length not divisible by 4)', () => {
    const badLength = new Float32Array(5); // Not divisible by 4
    const matchingBadLength = new Float32Array(5); // Same bad length to pass length check first
    
    expect(() => calculateLightnessFactor(badLength, matchingBadLength)).toThrow('data length must be divisible by 4 (RGBA format)');
  });

  it('should preserve precision for edge cases', () => {
    // Test with very small differences
    const original = createRgbaArray([0.100001]);
    const processed = createRgbaArray([0.100000]);
    
    const factor = calculateLightnessFactor(original, processed);
    expect(factor).toBeCloseTo(1.00001, 5);
  });
});
