// Mathematical utility functions for grain processing
// These are pure functions that don't depend on class state

import type { GrainDensity } from './types';
import { SEEDED_RANDOM_MULTIPLIER, EXPOSURE_CONVERSION } from './constants';
import { srgbToLinear, linearToSrgb } from './color-space';
import { assertInRange, assert } from './utils';

/**
 * Generate pseudorandom number with seed
 * Pure function for deterministic random number generation
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * SEEDED_RANDOM_MULTIPLIER;
  return x - Math.floor(x);
}

/**
 * Calculates sample weight using enhanced weighting profiles
 * Pure function for calculating sample weights based on distance and grain properties
 */
export function calculateSampleWeight(distance: number, grainRadius: number, grainShape: number): number {
  // Base Gaussian weighting
  const gaussianSigma = grainRadius * 0.7; // Adjust spread based on grain radius
  const gaussianWeight = Math.exp(-(distance * distance) / (2 * gaussianSigma * gaussianSigma));
  
  // Shape-aware weight modification
  // More angular grains (higher shape values) have sharper falloff
  const shapeInfluence = 0.5 + grainShape * 0.5; // Range: 0.5 to 1.0
  const shapedWeight = Math.pow(gaussianWeight, shapeInfluence);
  
  // Ensure minimum weight for edge samples
  const minWeight = 0.05;
  return Math.max(shapedWeight, minWeight);
}

/**
 * Convert Uint8ClampedArray from sRGB to linear floating-point values (0.0-1.0 range)
 * Applies gamma correction to convert from sRGB to linear space for physically correct processing
 */
export function convertSrgbToLinearFloat(uint8Data: Uint8ClampedArray): Float32Array {
  const floatData = new Float32Array(uint8Data.length);
  for (let i = 0; i < uint8Data.length; i++) {
    if (i % 4 === 3) {
      // Alpha channel doesn't need gamma correction
      floatData[i] = uint8Data[i] / 255.0;
    } else {
      // RGB channels: convert to linear space
      const srgbValue = uint8Data[i] / 255.0;
      floatData[i] = srgbToLinear(srgbValue);
    }
  }
  return floatData;
}

/**
 * Apply brightness scaling to linear RGB values
 * Scales RGB channels while preserving alpha channel
 */
export function applyBrightnessScaling(floatData: Float32Array, brightnessFactor: number): Float32Array {
  const scaledData = new Float32Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    if (i % 4 === 3) {
      // Alpha channel - no scaling
      scaledData[i] = floatData[i];
    } else {
      // RGB channels - apply brightness scaling
      scaledData[i] = floatData[i] * brightnessFactor;
    }
  }
  return scaledData;
}

/**
 * Convert linear floating-point values back to sRGB Uint8ClampedArray
 * Applies gamma encoding to convert from linear space back to sRGB
 */
export function convertLinearFloatToSrgb(floatData: Float32Array): Uint8ClampedArray {
  const uint8Data = new Uint8ClampedArray(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const value = floatData[i];
    
    if (i % 4 === 3) {
      // Alpha channel doesn't need gamma correction
      uint8Data[i] = Math.round(Math.max(0, Math.min(255, value * 255)));
    } else {
      // RGB channels: clamp to valid linear range, then gamma encode
      const clampedValue = Math.max(0, Math.min(1, value));
      
      // Convert from linear to sRGB and then to 8-bit
      const srgbValue = linearToSrgb(clampedValue);
      uint8Data[i] = Math.round(Math.max(0, Math.min(255, srgbValue * 255)));
    }
  }
  return uint8Data;
}

/**
 * Calculate average brightness ratio between original and processed image
 * for brightness preservation using perceptually accurate luminance calculation
 * Operates on linear RGB values for physically correct brightness calculation
 */
export function calculateBrightnessFactor(originalData: Float32Array, processedData: Float32Array): number {
  let originalSum = 0;
  let processedSum = 0;

  // Calculate average brightness for RGB channels only (skip alpha)
  // Using ITU-R BT.709 luminance weights applied to linear RGB values
  for (let i = 0; i < originalData.length; i += 4) {
    const originalLuminance = originalData[i] * 0.2126 + originalData[i + 1] * 0.7152 + originalData[i + 2] * 0.0722;
    const processedLuminance = processedData[i] * 0.2126 + processedData[i + 1] * 0.7152 + processedData[i + 2] * 0.0722;
    
    originalSum += originalLuminance;
    processedSum += processedLuminance;
  }

  const pixelCount = originalData.length / 4;
  const avgOriginalBrightness = originalSum / pixelCount;
  const avgProcessedBrightness = processedSum / pixelCount;

  // Special case: if original image is very dark (near black), don't amplify
  // grain effects - they should remain minimal
  if (avgOriginalBrightness < 0.01) {
    return Math.min(1.0, avgOriginalBrightness / Math.max(avgProcessedBrightness, 0.001));
  }

  // Avoid division by zero and ensure reasonable bounds
  if (avgProcessedBrightness < 0.001) {
    return 1.0; // Keep original brightness if processed is nearly black
  }

  const brightnessFactor = avgOriginalBrightness / avgProcessedBrightness;
  
  // Clamp to reasonable range to avoid extreme corrections
  // In linear space, corrections can be more extreme than in gamma space
  return Math.max(0.01, Math.min(100.0, brightnessFactor));
}

/**
 * Apply Beer-Lambert law compositing for physically accurate results (floating-point version)
 * Pure function implementing Beer-Lambert law physics
 */
export function applyBeerLambertCompositingFloat(grainDensity: GrainDensity): [number, number, number] {
  // PHYSICAL CORRECTION: The input image was used to determine grain exposure during "photography".
  // When "viewing" the film, WHITE printing light passes through the developed grains.
  // Beer-Lambert law: final = white_light * exp(-density)
  // This is correct physics - the original color should NOT be used here.
  const WHITE_LIGHT = 1.0; // Floating-point white light (normalized)
  
  return [
    WHITE_LIGHT * Math.exp(-grainDensity.r),
    WHITE_LIGHT * Math.exp(-grainDensity.g),
    WHITE_LIGHT * Math.exp(-grainDensity.b)
  ];
}

/**
 * Calculate chromatic aberration effect
 * Simulates slight color separation based on distance from grain center
 */
export function calculateChromaticAberration(normalizedDistance: number): { red: number; green: number; blue: number } {
  // Chromatic aberration is strongest at edges
  const aberrationStrength = normalizedDistance * 0.02; // Very subtle effect
  
  return {
    red: 1 + aberrationStrength * 0.5,   // Red slightly displaced outward
    green: 1,                             // Green remains centered (reference)
    blue: 1 - aberrationStrength * 0.3   // Blue slightly displaced inward
  };
}

/**
 * Convert linear RGB to photographic exposure
 * Operates on linear RGB values (0.0-1.0) for physically correct exposure calculation
 * 
 * NOTE: With valid linear inputs [0,1], the mathematical operations cannot produce NaN or Infinity:
 * - Luminance calculation is a simple weighted sum
 * - safeLuminance includes offset to prevent log(0)
 * - All subsequent operations are safe linear/logarithmic transformations
 * The Number.isFinite check at the end is defensive programming but mathematically unnecessary.
 */
export function rgbToExposureFloat(r: number, g: number, b: number): number {
  // Validate inputs - NaN/Infinity will be caught here
  assertInRange(r, 0, 1, 'r');
  assertInRange(g, 0, 1, 'g');
  assertInRange(b, 0, 1, 'b');
  
  // Calculate weighted luminance using photographic weights
  // Note: Input values are already in linear space, so this is physically correct
  const luminance = 
    r * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.red +
    g * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.green +
    b * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.blue;

  // Add small offset to prevent log(0) in pure black areas
  const safeLuminance = luminance + EXPOSURE_CONVERSION.LUMINANCE_OFFSET;

  // Convert to logarithmic exposure scale
  const logExposure = Math.log(safeLuminance / EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE) / 
                     Math.log(EXPOSURE_CONVERSION.LOG_BASE);
  
  // Scale and normalize exposure to [0, 1] range
  const normalizedExposure = (logExposure + EXPOSURE_CONVERSION.EXPOSURE_SCALE) / 
                            (2 * EXPOSURE_CONVERSION.EXPOSURE_SCALE);

  // Clamp to [0, 1] range and validate result
  // Note: The Number.isFinite check is defensive programming - with valid inputs,
  // the mathematical operations above cannot produce NaN or Infinity
  const result = Math.max(0, Math.min(1, normalizedExposure));
  
  assert(Number.isFinite(result), 'rgbToExposureFloat produced non-finite result', {
    r, g, b, luminance, safeLuminance, logExposure, normalizedExposure, result
  });
  
  return result;
}
