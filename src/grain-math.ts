// Mathematical utility functions for grain processing
// These are pure functions that don't depend on class state

import type { GrainDensity } from './types';
import { SEEDED_RANDOM_MULTIPLIER, EXPOSURE_CONVERSION } from './constants';
import { assertInRange } from './utils';

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
 * Convert Uint8ClampedArray to floating-point values (0.0-1.0 range)
 * for precision preservation during processing
 */
export function convertToFloatingPoint(uint8Data: Uint8ClampedArray): Float32Array {
  const floatData = new Float32Array(uint8Data.length);
  for (let i = 0; i < uint8Data.length; i++) {
    floatData[i] = uint8Data[i] / 255.0;
  }
  return floatData;
}

/**
 * Convert floating-point values back to Uint8ClampedArray
 * with optional brightness correction to preserve overall image brightness
 */
export function convertToUint8(floatData: Float32Array, brightnessFactor: number = 1.0): Uint8ClampedArray {
  const uint8Data = new Uint8ClampedArray(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    // Apply brightness correction and clamp to valid range
    const correctedValue = floatData[i] * brightnessFactor;
    uint8Data[i] = Math.round(Math.max(0, Math.min(255, correctedValue * 255)));
  }
  return uint8Data;
}

/**
 * Calculate average brightness ratio between original and processed image
 * for brightness preservation
 */
export function calculateBrightnessFactor(originalData: Float32Array, processedData: Float32Array): number {
  let originalSum = 0;
  let processedSum = 0;

  // Calculate average brightness for RGB channels only (skip alpha)
  for (let i = 0; i < originalData.length; i += 4) {
    const originalBrightness = (originalData[i] + originalData[i + 1] + originalData[i + 2]) / 3;
    const processedBrightness = (processedData[i] + processedData[i + 1] + processedData[i + 2]) / 3;
    
    originalSum += originalBrightness;
    processedSum += processedBrightness;
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
  return Math.max(0.1, Math.min(10.0, brightnessFactor));
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
 * Apply Beer-Lambert law compositing for physically accurate results (integer version)
 * Pure function implementing Beer-Lambert law physics
 */
export function applyBeerLambertCompositing(grainDensity: GrainDensity): [number, number, number] {
  // PHYSICAL CORRECTION: The input image was used to determine grain exposure during "photography".
  // When "viewing" the film, WHITE printing light passes through the developed grains.
  // Beer-Lambert law: final = white_light * exp(-density)
  // This is correct physics - the original color should NOT be used here.
  const WHITE_LIGHT = 255;
  
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
 * Convert RGB to photographic exposure using logarithmic scaling
 * Pure function that replaces linear LAB luminance conversion with proper exposure simulation
 */
export function rgbToExposure(r: number, g: number, b: number): number {
  // Validate input parameters with assertions instead of clamping
  assertInRange(r, 0, 255, 'r');
  assertInRange(g, 0, 255, 'g');
  assertInRange(b, 0, 255, 'b');

  // Normalize RGB values to [0, 1] range
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  // Calculate weighted luminance using photographic weights
  // These weights account for human eye sensitivity (ITU-R BT.709)
  const luminance = 
    rNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.red +
    gNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.green +
    bNorm * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.blue;

  // Add small offset to prevent log(0) in pure black areas
  const safeLuminance = luminance + EXPOSURE_CONVERSION.LUMINANCE_OFFSET;

  // Convert to logarithmic exposure scale
  // This follows photographic principles where exposure is measured in stops (log scale)
  // Formula: exposure = log(luminance / middle_gray) * scale_factor
  const logExposure = Math.log(safeLuminance / EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE) / 
                     Math.log(EXPOSURE_CONVERSION.LOG_BASE);
  
  // Scale and normalize exposure to [0, 1] range for grain calculations
  // This maps the exposure range to usable values for grain strength calculations
  const normalizedExposure = (logExposure + EXPOSURE_CONVERSION.EXPOSURE_SCALE) / 
                            (2 * EXPOSURE_CONVERSION.EXPOSURE_SCALE);

  // Clamp to [0, 1] range to handle extreme values
  return Math.max(0, Math.min(1, normalizedExposure));
}

/**
 * Convert floating-point RGB to photographic exposure
 * Same logic as rgbToExposure but operates on floating-point values (0.0-1.0)
 */
export function rgbToExposureFloat(r: number, g: number, b: number): number {
  // Validate inputs with assertions instead of clamping
  assertInRange(r, 0, 1, 'r');
  assertInRange(g, 0, 1, 'g');
  assertInRange(b, 0, 1, 'b');
  
  // Calculate weighted luminance using photographic weights
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
  const result = Math.max(0, Math.min(1, normalizedExposure));
  return Number.isFinite(result) ? result : 0;
}
