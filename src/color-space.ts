// Color space conversion utilities
// Pure functions for converting between different color spaces

import type { LabColor } from './types';
import { assert, assertInRange } from './utils';

/**
 * Convert sRGB gamma-encoded value to linear RGB
 * Pure function for gamma correction
 */
export function srgbToLinear(value: number): number {
  return value <= RGB_GAMMA_THRESHOLD 
    ? value / RGB_GAMMA_LINEAR_DIVISOR
    : Math.pow((value + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER, RGB_GAMMA_POWER);
}

/**
 * Convert linear RGB value to sRGB gamma-encoded
 * Pure function for gamma encoding
 */
export function linearToSrgb(value: number): number {
  return value <= 0.0031308 
    ? value * RGB_GAMMA_LINEAR_DIVISOR
    : RGB_GAMMA_MULTIPLIER * Math.pow(value, 1.0 / RGB_GAMMA_POWER) - RGB_GAMMA_OFFSET;
}

/**
 * Convert ImageData to grayscale using ITU-R BT.709 luminance weights
 * Pure function for RGB to grayscale conversion operating in linear space
 * Returns new ImageData with grayscale values duplicated across RGB channels
 */
export function convertImageDataToGrayscale(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const grayscaleData = new Uint8ClampedArray(data.length);
  
  // ITU-R BT.709 luminance weights for perceptually accurate grayscale conversion
  const LUMINANCE_WEIGHTS = {
    red: 0.2126,
    green: 0.7152,
    blue: 0.0722
  } as const;
  
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    
    // Convert sRGB to linear space for physically correct luminance calculation
    const rSrgb = data[i] / 255.0;
    const gSrgb = data[i + 1] / 255.0;
    const bSrgb = data[i + 2] / 255.0;
    
    const rLinear = srgbToLinear(rSrgb);
    const gLinear = srgbToLinear(gSrgb);
    const bLinear = srgbToLinear(bSrgb);
    
    // Calculate luminance in linear space using ITU-R BT.709 weights
    const linearLuminance = 
      rLinear * LUMINANCE_WEIGHTS.red +
      gLinear * LUMINANCE_WEIGHTS.green +
      bLinear * LUMINANCE_WEIGHTS.blue;
    
    // Convert back to sRGB space and clamp to valid range
    const srgbLuminance = linearToSrgb(linearLuminance);
    const luminance = Math.round(Math.max(0, Math.min(255, srgbLuminance * 255)));
    
    // Set RGB channels to the same grayscale value
    grayscaleData[i] = luminance;     // Red
    grayscaleData[i + 1] = luminance; // Green
    grayscaleData[i + 2] = luminance; // Blue
    grayscaleData[i + 3] = alpha;     // Alpha (preserved)
  }
  
  // Create new ImageData with grayscale values
  return typeof ImageData !== 'undefined' 
    ? new ImageData(grayscaleData, width, height)
    : { width, height, data: grayscaleData } as ImageData;
}

// Color space conversion constants
const RGB_MAX_VALUE = 255;
const RGB_GAMMA_THRESHOLD = 0.04045;
const RGB_GAMMA_LINEAR_DIVISOR = 12.92;
const RGB_GAMMA_POWER = 2.4;
const RGB_GAMMA_OFFSET = 0.055;
const RGB_GAMMA_MULTIPLIER = 1.055;

const RGB_TO_XYZ_MATRIX = {
  x: { r: 0.4124564, g: 0.3575761, b: 0.1804375 },
  y: { r: 0.2126729, g: 0.7151522, b: 0.0721750 },
  z: { r: 0.0193339, g: 0.1191920, b: 0.9503041 }
} as const;

const D65_ILLUMINANT = {
  x: 0.95047,
  y: 1.00000,
  z: 1.08883
} as const;

const LAB_EPSILON = 0.008856;
const LAB_KAPPA = 7.787;
const LAB_DELTA = 16 / 116;
const LAB_L_MULTIPLIER = 116;
const LAB_L_OFFSET = 16;
const LAB_A_MULTIPLIER = 500;
const LAB_B_MULTIPLIER = 200;

/**
 * Convert RGB color values to LAB color space
 * @deprecated This function is legacy from the RGB processing era. 
 * The system now processes grayscale images exclusively where R=G=B.
 * Consider removing this function in future cleanup tasks.
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns LAB color object with l, a, b components
 */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  // Validate input parameters with custom assertions
  assertInRange(r, 0, 255, 'r');
  assertInRange(g, 0, 255, 'g');
  assertInRange(b, 0, 255, 'b');

  // Normalize RGB values
  r /= RGB_MAX_VALUE;
  g /= RGB_MAX_VALUE;
  b /= RGB_MAX_VALUE;

  // Apply gamma correction
  r = r > RGB_GAMMA_THRESHOLD ? ((r + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER) ** RGB_GAMMA_POWER : r / RGB_GAMMA_LINEAR_DIVISOR;
  g = g > RGB_GAMMA_THRESHOLD ? ((g + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER) ** RGB_GAMMA_POWER : g / RGB_GAMMA_LINEAR_DIVISOR;
  b = b > RGB_GAMMA_THRESHOLD ? ((b + RGB_GAMMA_OFFSET) / RGB_GAMMA_MULTIPLIER) ** RGB_GAMMA_POWER : b / RGB_GAMMA_LINEAR_DIVISOR;

  // Convert to XYZ
  let x = r * RGB_TO_XYZ_MATRIX.x.r + g * RGB_TO_XYZ_MATRIX.x.g + b * RGB_TO_XYZ_MATRIX.x.b;
  let y = r * RGB_TO_XYZ_MATRIX.y.r + g * RGB_TO_XYZ_MATRIX.y.g + b * RGB_TO_XYZ_MATRIX.y.b;
  let z = r * RGB_TO_XYZ_MATRIX.z.r + g * RGB_TO_XYZ_MATRIX.z.g + b * RGB_TO_XYZ_MATRIX.z.b;

  // Normalize for D65 illuminant
  x /= D65_ILLUMINANT.x;
  y /= D65_ILLUMINANT.y;
  z /= D65_ILLUMINANT.z;

  // Validate XYZ values with custom assertion
  assert(
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z),
    'Color space conversion produced invalid XYZ values',
    { 
      xyz: { x, y, z }, 
      originalRGB: { r: r * 255, g: g * 255, b: b * 255 },
      finite: { x: Number.isFinite(x), y: Number.isFinite(y), z: Number.isFinite(z) }
    }
  );

  // Convert to LAB
  x = x > LAB_EPSILON ? x ** (1/3) : (LAB_KAPPA * x + LAB_DELTA);
  y = y > LAB_EPSILON ? y ** (1/3) : (LAB_KAPPA * y + LAB_DELTA);
  z = z > LAB_EPSILON ? z ** (1/3) : (LAB_KAPPA * z + LAB_DELTA);

  const labResult = {
    l: LAB_L_MULTIPLIER * y - LAB_L_OFFSET,
    a: LAB_A_MULTIPLIER * (x - y),
    b: LAB_B_MULTIPLIER * (y - z)
  };

  // Validate LAB result with custom assertion
  assert(
    Number.isFinite(labResult.l) && Number.isFinite(labResult.a) && Number.isFinite(labResult.b),
    'Color space conversion produced invalid LAB values',
    { 
      lab: labResult, 
      originalRGB: { r: r * 255, g: g * 255, b: b * 255 },
      finite: { 
        l: Number.isFinite(labResult.l), 
        a: Number.isFinite(labResult.a), 
        b: Number.isFinite(labResult.b) 
      }
    }
  );

  return labResult;
}
