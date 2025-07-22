// Mathematical utility functions for grain processing
// These are pure functions that don't depend on class state

import { EXPOSURE_CONVERSION, RGB_COLOR_CONSTANTS } from './constants';
import { srgbToLinear, linearToSrgb } from './color-space';
import {
  assert,
  devAssert,
  assertFiniteNumber,
  devAssertInRange,
} from './utils';

/**
 * Squirrel Noise 5 algorithm for pseudorandom number generation
 * Based on Squirrel Eiserloh's noise function for uniform distribution
 * Pure function for deterministic hash generation
 * Exported for use by other modules to avoid duplication
 */
export function squirrelNoise5(positionX: number, seed: number = 0): number {
  devAssert(
    () => Number.isFinite(positionX),
    `positionX must be finite, got ${positionX}`
  );
  devAssert(
    () => Number.isInteger(positionX),
    `positionX must be an integer, got ${positionX}`
  );
  devAssert(() => Number.isFinite(seed), `seed must be finite, got ${seed}`);
  devAssert(
    () => Number.isInteger(seed),
    `seed must be an integer, got ${seed}`
  );

  // Squirrel Noise 5 constants
  const SQ5_BIT_NOISE1 = 0xd2a80a3f; // 11010010101010000000101000111111
  const SQ5_BIT_NOISE2 = 0xa884f197; // 10101000100001001111000110010111
  const SQ5_BIT_NOISE3 = 0x6c736f4b; // 01101100011100110110111101001011
  const SQ5_BIT_NOISE4 = 0xb79f3abb; // 10110111100111110011101010111011
  const SQ5_BIT_NOISE5 = 0x1b56c4f5; // 00011011010101101100010011110101

  let mangledBits = positionX >>> 0; // Convert to unsigned 32-bit integer
  mangledBits = (mangledBits * SQ5_BIT_NOISE1) >>> 0;
  mangledBits = (mangledBits + (seed >>> 0)) >>> 0;
  mangledBits = (mangledBits ^ (mangledBits >>> 9)) >>> 0;
  mangledBits = (mangledBits + SQ5_BIT_NOISE2) >>> 0;
  mangledBits = (mangledBits ^ (mangledBits >>> 11)) >>> 0;
  mangledBits = (mangledBits * SQ5_BIT_NOISE3) >>> 0;
  mangledBits = (mangledBits ^ (mangledBits >>> 13)) >>> 0;
  mangledBits = (mangledBits + SQ5_BIT_NOISE4) >>> 0;
  mangledBits = (mangledBits ^ (mangledBits >>> 15)) >>> 0;
  mangledBits = (mangledBits * SQ5_BIT_NOISE5) >>> 0;
  mangledBits = (mangledBits ^ (mangledBits >>> 17)) >>> 0;

  return mangledBits;
}

/**
 * Hash a seed to improve distribution and avoid systematic patterns
 * Combines the input with a prime number before hashing to break up regular patterns
 * Pure function for deterministic seed transformation
 */
function hashSeed(seed: number, salt: number = 0x9e3779b9): number {
  devAssert(() => Number.isFinite(seed), `seed must be finite, got ${seed}`);
  devAssert(
    () => Number.isInteger(seed),
    `seed must be an integer, got ${seed}`
  );
  devAssert(() => Number.isFinite(salt), `salt must be finite, got ${salt}`);
  devAssert(
    () => Number.isInteger(salt),
    `salt must be an integer, got ${salt}`
  );
  devAssert(
    () => seed >= 0,
    `seed must be unsigned (non-negative), got ${seed}`
  );
  devAssert(
    () => salt >= 0,
    `salt must be unsigned (non-negative), got ${salt}`
  );
  // Use squirrelNoise5's seed argument directly for mixing
  return squirrelNoise5(seed, salt);
}

/**
 * Generate pseudorandom number with seed using Squirrel Noise 5
 * Pure function for deterministic random number generation
 * Returns a value in [0, 1) range
 */
export function seededRandom(seed: number): number {
  devAssert(() => Number.isFinite(seed), `seed must be finite, got ${seed}`);
  devAssert(
    () => Number.isInteger(seed),
    `seed must be an integer, got ${seed}`
  );

  // Hash the integer seed
  const hashedSeed = hashSeed(seed);

  // Convert to [0, 1) range by dividing by 2^32
  return hashedSeed / 0x100000000;
}

/**
 * Generate pseudorandom number with improved seeding for grain properties
 * Combines index with a property-specific salt to avoid systematic patterns
 * Pure function for deterministic random number generation
 */
export function seededRandomForGrain(
  index: number,
  property: 'size' | 'sensitivity' | 'threshold'
): number {
  devAssert(() => Number.isFinite(index), `index must be finite, got ${index}`);
  devAssert(
    () => Number.isInteger(index),
    `index must be an integer, got ${index}`
  );

  // Use different salts for different grain properties to ensure independence
  const salts = {
    size: 0x456789ab,
    sensitivity: 0x789012cd,
    threshold: 0x234567ef,
  };

  const hashedSeed = hashSeed(index, salts[property]);
  return hashedSeed / 0x100000000;
}

/**
 * Calculates grain falloff weight using Gaussian distribution
 * Shared function used for both exposure sampling and pixel effects
 * Pure function for calculating falloff based on distance and grain properties
 */
export function calculateGrainFalloff(
  distance: number,
  grainRadius: number
): number {
  // Validate input parameters (dev-only for performance)
  devAssert(Number.isFinite(distance), 'distance must be finite', { distance });
  devAssert(grainRadius > 0, 'grainRadius must be positive', { grainRadius });

  // Constants for grain falloff calculation
  const GAUSSIAN_SIGMA_FACTOR = 0.7; // Controls spread of Gaussian based on grain radius
  const MIN_FALLOFF_WEIGHT = 0.0; // No minimum weight for falloff (unlike sampling)

  // Gaussian falloff for consistent behavior between sampling and rendering
  const gaussianSigma = grainRadius * GAUSSIAN_SIGMA_FACTOR;
  const gaussianWeight = Math.exp(
    -(distance * distance) / (2 * gaussianSigma * gaussianSigma)
  );

  return Math.max(gaussianWeight, MIN_FALLOFF_WEIGHT);
}

/**
 * Calculates sample weight using enhanced weighting profiles
 * Pure function for calculating sample weights based on distance and grain properties
 */
export function calculateSampleWeight(
  distance: number,
  grainRadius: number
): number {
  // Validate input parameters (dev-only for performance)
  devAssert(Number.isFinite(distance), 'distance must be finite', { distance });
  devAssert(grainRadius > 0, 'grainRadius must be positive', { grainRadius });

  // Constants for sample weight calculation
  const MIN_SAMPLE_WEIGHT = 0.05; // Minimum weight for edge samples

  // Use shared grain falloff function for consistency
  const falloffWeight = calculateGrainFalloff(distance, grainRadius);

  // For sampling, we want a minimum weight to avoid complete zeros
  return Math.max(falloffWeight, MIN_SAMPLE_WEIGHT);
}

/**
 * Convert Uint8ClampedArray from sRGB to linear floating-point values (0.0-1.0 range)
 * Applies gamma correction to convert from sRGB to linear space for physically correct processing
 */
export function convertSrgbToLinearFloat(
  uint8Data: Uint8ClampedArray
): Float32Array {
  assert(uint8Data.length > 0, 'uint8Data must not be empty', {
    length: uint8Data.length,
  });
  assert(
    uint8Data.length % 4 === 0,
    'uint8Data length must be divisible by 4 (RGBA format)',
    { length: uint8Data.length }
  );

  const floatData = new Float32Array(uint8Data.length);
  for (let i = 0; i < uint8Data.length; i++) {
    if (i % 4 === 3) {
      // Alpha channel doesn't need gamma correction
      floatData[i] = uint8Data[i] * RGB_COLOR_CONSTANTS.BYTE_TO_NORMALIZED;
    } else {
      // RGB channels: convert to linear space
      const srgbValue = uint8Data[i] * RGB_COLOR_CONSTANTS.BYTE_TO_NORMALIZED;
      floatData[i] = srgbToLinear(srgbValue);
    }
  }
  return floatData;
}

/**
 * Apply lightness scaling to linear RGB values
 * Scales RGB channels while preserving alpha channel
 */
export function applyLightnessScaling(
  floatData: Float32Array,
  lightnessFactor: number,
  isDataNegative: boolean = false
): Float32Array {
  assert(floatData.length > 0, 'floatData must not be empty', {
    length: floatData.length,
  });
  assert(
    floatData.length % 4 === 0,
    'floatData length must be divisible by 4 (RGBA format)',
    { length: floatData.length }
  );
  assertFiniteNumber(lightnessFactor, 'lightnessFactor');
  assert(lightnessFactor >= 0, 'lightnessFactor must be non-negative', {
    lightnessFactor,
  });

  const scaledData = new Float32Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    if (i % 4 === 3) {
      // Alpha channel - no scaling
      scaledData[i] = floatData[i];
    } else {
      // RGB channels - apply lightness scaling
      if (isDataNegative) {
        // If lightnessFactor > 1 (processed positive was too dark), we need to make negative brighter
        // So, we want to multiply by a factor < 1.0.
        // Example: negative 0.1 (dark) needs to become 0.5 (less dark)
        // If lightnessFactor = 2 (processed positive was half as bright as original)
        // We want to make negative twice as bright.
        // So, new_negative = old_negative * (1.0 / lightnessFactor)
        scaledData[i] = floatData[i] * (1.0 / lightnessFactor);
      } else {
        scaledData[i] = floatData[i] * lightnessFactor;
      }
    }
  }
  return scaledData;
}

/**
 * Convert linear floating-point values back to sRGB Uint8ClampedArray
 * Applies gamma encoding to convert from linear space back to sRGB
 */
export function convertLinearFloatToSrgb(
  floatData: Float32Array
): Uint8ClampedArray {
  assert(floatData.length > 0, 'floatData must not be empty', {
    length: floatData.length,
  });
  assert(
    floatData.length % 4 === 0,
    'floatData length must be divisible by 4 (RGBA format)',
    { length: floatData.length }
  );

  const uint8Data = new Uint8ClampedArray(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const value = floatData[i];

    if (i % 4 === 3) {
      // Alpha channel doesn't need gamma correction
      uint8Data[i] = Math.round(
        Math.max(
          RGB_COLOR_CONSTANTS.MIN_COLOR_VALUE,
          Math.min(
            RGB_COLOR_CONSTANTS.MAX_COLOR_VALUE,
            value * RGB_COLOR_CONSTANTS.NORMALIZED_TO_BYTE
          )
        )
      );
    } else {
      // RGB channels: clamp to valid linear range, then gamma encode
      const clampedValue = Math.max(
        RGB_COLOR_CONSTANTS.MIN_NORMALIZED_COLOR,
        Math.min(RGB_COLOR_CONSTANTS.MAX_NORMALIZED_COLOR, value)
      );

      // Convert from linear to sRGB and then to 8-bit
      const srgbValue = linearToSrgb(clampedValue);
      uint8Data[i] = Math.round(
        Math.max(
          RGB_COLOR_CONSTANTS.MIN_COLOR_VALUE,
          Math.min(
            RGB_COLOR_CONSTANTS.MAX_COLOR_VALUE,
            srgbValue * RGB_COLOR_CONSTANTS.NORMALIZED_TO_BYTE
          )
        )
      );
    }
  }
  return uint8Data;
}

/**
 * Calculate average lightness ratio between original and processed image
 * for lightness preservation using grayscale luminance calculation
 * Operates on linear grayscale values for physically correct lightness calculation
 *
 * @param originalData - Original image data in linear RGB format (Float32Array, RGBA)
 * @param processedData - Processed image data in linear RGB format (Float32Array, RGBA)
 * @returns Lightness correction factor:
 *   - Factor > 1.0: Processed image is darker than original, needs brightening
 *   - Factor = 1.0: Processed and original have same average lightness
 *   - Factor < 1.0: Processed image is brighter than original, needs darkening
 *   - Special handling for very dark images (< 0.01): clamped to ≤ 1.0 to avoid amplifying noise
 *   - Clamped to range [0.01, 100.0] for non-dark images to prevent extreme corrections
 */
export function calculateLightnessFactor(
  originalData: Float32Array,
  processedData: Float32Array
): number {
  assert(originalData.length > 0, 'originalData must not be empty', {
    length: originalData.length,
  });
  assert(
    processedData.length === originalData.length,
    'processedData must have same length as originalData',
    {
      originalLength: originalData.length,
      processedLength: processedData.length,
    }
  );
  assert(
    originalData.length % 4 === 0,
    'data length must be divisible by 4 (RGBA format)',
    { length: originalData.length }
  );

  let originalSum = 0;
  let processedSum = 0;

  // Calculate average lightness for grayscale data (RGB channels contain identical values)
  // Since the image has been converted to grayscale, we can use any single channel
  for (let i = 0; i < originalData.length; i += 4) {
    // Use red channel since all RGB channels contain identical grayscale values
    const originalLuminance = originalData[i];
    const currentProcessedLuminance = processedData[i];

    originalSum += originalLuminance;
    processedSum += currentProcessedLuminance;
  }

  const pixelCount = originalData.length / 4;
  const avgOriginalLightness = originalSum / pixelCount;
  const avgProcessedLightness = processedSum / pixelCount;

  // Special case: if original image is very dark (near black), don't amplify
  // grain effects - they should remain minimal
  const DARK_THRESHOLD = 0.01;
  const PROCESSED_MIN = 0.001;
  const LIGHTNESS_FACTOR_MIN = 0.01;
  const LIGHTNESS_FACTOR_MAX = 100.0;

  if (avgOriginalLightness < DARK_THRESHOLD) {
    return Math.min(
      1.0,
      avgOriginalLightness / Math.max(avgProcessedLightness, PROCESSED_MIN)
    );
  }

  // Avoid division by zero and ensure reasonable bounds
  if (avgProcessedLightness < PROCESSED_MIN) {
    return 1.0; // Keep original lightness if processed is nearly black
  }

  const lightnessFactor = avgOriginalLightness / avgProcessedLightness;

  // Clamp to reasonable range to avoid extreme corrections
  // In linear space, corrections can be more extreme than in gamma space
  return Math.max(
    LIGHTNESS_FACTOR_MIN,
    Math.min(LIGHTNESS_FACTOR_MAX, lightnessFactor)
  );
}

/**
 * Apply Beer-Lambert law compositing for grayscale processing (floating-point version)
 * Pure function implementing Beer-Lambert law physics for monochrome film
 */
export function applyBeerLambertCompositingGrayscale(density: number): number {
  devAssert(Number.isFinite(density), 'density must be finite', { density });

  // PHYSICAL CORRECTION: The input image was used to determine grain exposure during "photography".
  // When "viewing" the film, WHITE printing light passes through the developed grains.
  // Beer-Lambert law: final = white_light * exp(-density)
  const WHITE_LIGHT = 1.0; // Floating-point white light (normalized)

  return WHITE_LIGHT * Math.exp(-density);
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
  // Validate inputs - NaN/Infinity will be caught here (dev-only for performance)
  devAssert(r >= 0 && r <= 1, 'r must be in range [0,1]', { r });
  devAssert(g >= 0 && g <= 1, 'g must be in range [0,1]', { g });
  devAssert(b >= 0 && b <= 1, 'b must be in range [0,1]', { b });

  // Calculate weighted luminance using photographic weights
  // Note: Input values are already in linear space, so this is physically correct
  const luminance =
    r * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.red +
    g * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.green +
    b * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.blue;

  // Add small offset to prevent log(0) in pure black areas
  const safeLuminance = luminance + EXPOSURE_CONVERSION.LUMINANCE_OFFSET;

  // Convert to logarithmic exposure scale
  const logExposure =
    Math.log(safeLuminance / EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE) /
    Math.log(EXPOSURE_CONVERSION.LOG_BASE);

  // Scale and normalize exposure to [0, 1] range
  const normalizedExposure =
    (logExposure + EXPOSURE_CONVERSION.EXPOSURE_SCALE) /
    (2 * EXPOSURE_CONVERSION.EXPOSURE_SCALE);

  // Clamp to [0, 1] range and validate result
  // Note: The Number.isFinite check is defensive programming - with valid inputs,
  // the mathematical operations above cannot produce NaN or Infinity
  const result = Math.max(0, Math.min(1, normalizedExposure));

  assert(
    Number.isFinite(result),
    'rgbToExposureFloat produced non-finite result',
    {
      r,
      g,
      b,
      luminance,
      safeLuminance,
      logExposure,
      normalizedExposure,
      result,
    }
  );

  return result;
}

/**
 * Calculate exposure from grayscale luminance value
 * Pure logarithmic exposure calculation from single luminance value
 * This is used for monochrome grain processing where input has already been converted to grayscale
 * @param luminance - Grayscale luminance value [0, 1]
 * @returns Normalized exposure value [0, 1]
 */
export function grayscaleToExposure(luminance: number): number {
  // Validate input - using devAssertInRange for performance in hot code path
  devAssertInRange(luminance, 0, 1, 'luminance');

  // Add small offset to prevent log(0) in pure black areas
  const safeLuminance = luminance + EXPOSURE_CONVERSION.LUMINANCE_OFFSET;

  // Convert to logarithmic exposure scale
  const logExposure =
    Math.log(safeLuminance / EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE) /
    Math.log(EXPOSURE_CONVERSION.LOG_BASE);

  // Scale and normalize exposure to [0, 1] range
  const normalizedExposure =
    (logExposure + EXPOSURE_CONVERSION.EXPOSURE_SCALE) /
    (2 * EXPOSURE_CONVERSION.EXPOSURE_SCALE);

  // Clamp to [0, 1] range and validate result
  const result = Math.max(0, Math.min(1, normalizedExposure));

  assert(
    Number.isFinite(result),
    'grayscaleToExposure produced non-finite result',
    {
      luminance,
      safeLuminance,
      logExposure,
      normalizedExposure,
      result,
    }
  );

  return result;
}
