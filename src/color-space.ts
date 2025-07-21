// Color space conversion utilities
// Pure functions for converting between different color spaces

import { assertImageData, devAssertInRange } from './utils';
import { EXPOSURE_CONVERSION, RGB_COLOR_CONSTANTS } from './constants';

/**
 * Convert sRGB gamma-encoded value to linear RGB
 * Pure function for gamma correction
 */
export function srgbToLinear(value: number): number {
  devAssertInRange(value, 0, 1, 'value');
  return value <= RGB_GAMMA_THRESHOLD
    ? value / RGB_GAMMA_LINEAR_DIVISOR
    : Math.pow(
        (value + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER,
        RGB_GAMMA_POWER
      );
}

/**
 * Convert linear RGB value to sRGB gamma-encoded
 * Pure function for gamma encoding
 */
export function linearToSrgb(value: number): number {
  const LINEAR_TO_SRGB_THRESHOLD = 0.0031308;

  devAssertInRange(value, 0, 1, 'value');
  return value <= LINEAR_TO_SRGB_THRESHOLD
    ? value * RGB_GAMMA_LINEAR_DIVISOR
    : RGB_GAMMA_MULTIPLIER * Math.pow(value, 1.0 / RGB_GAMMA_POWER) -
        RGB_GAMMA_OFFSET;
}

/**
 * Convert ImageData to grayscale using ITU-R BT.709 luminance weights
 * Pure function for RGB to grayscale conversion operating in linear space
 * Returns new ImageData with grayscale values duplicated across RGB channels
 */
export function convertImageDataToGrayscale(imageData: ImageData): ImageData {
  assertImageData(imageData, 'imageData');
  const { width, height, data } = imageData;
  const grayscaleData = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];

    // Convert sRGB to linear space for physically correct luminance calculation
    const rSrgb = data[i] * RGB_COLOR_CONSTANTS.BYTE_TO_NORMALIZED;
    const gSrgb = data[i + 1] * RGB_COLOR_CONSTANTS.BYTE_TO_NORMALIZED;
    const bSrgb = data[i + 2] * RGB_COLOR_CONSTANTS.BYTE_TO_NORMALIZED;

    const rLinear = srgbToLinear(rSrgb);
    const gLinear = srgbToLinear(gSrgb);
    const bLinear = srgbToLinear(bSrgb);

    // Calculate luminance in linear space using ITU-R BT.709 weights
    const linearLuminance =
      rLinear * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.red +
      gLinear * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.green +
      bLinear * EXPOSURE_CONVERSION.LUMINANCE_WEIGHTS.blue;

    // Convert back to sRGB space and clamp to valid range
    const srgbLuminance = linearToSrgb(linearLuminance);
    const luminance = Math.round(
      Math.max(
        RGB_COLOR_CONSTANTS.MIN_COLOR_VALUE,
        Math.min(
          RGB_COLOR_CONSTANTS.MAX_COLOR_VALUE,
          srgbLuminance * RGB_COLOR_CONSTANTS.NORMALIZED_TO_BYTE
        )
      )
    );

    // Set RGB channels to the same grayscale value
    grayscaleData[i] = luminance; // Red
    grayscaleData[i + 1] = luminance; // Green
    grayscaleData[i + 2] = luminance; // Blue
    grayscaleData[i + 3] = alpha; // Alpha (preserved)
  }

  // Create new ImageData with grayscale values
  return typeof ImageData !== 'undefined'
    ? new ImageData(grayscaleData, width, height)
    : ({ width, height, data: grayscaleData } as ImageData);
}

// Color space conversion constants
const RGB_GAMMA_THRESHOLD = 0.04045;
const RGB_GAMMA_LINEAR_DIVISOR = 12.92;
const RGB_GAMMA_POWER = 2.4;
const RGB_GAMMA_OFFSET = 0.055;
const RGB_GAMMA_MULTIPLIER = 1.055;
