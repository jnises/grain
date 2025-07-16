// Noise generation utilities
// Pure functions for generating various types of noise

import { seededRandom } from './grain-math';

// Noise generation constants
const NOISE_GRID_MASK = 255;
const PERLIN_FADE_COEFFICIENT_A = 3;
const PERLIN_FADE_COEFFICIENT_B = 2;

/**
 * Generate 2D Perlin-style noise value
 * @param x X coordinate
 * @param y Y coordinate
 * @returns Noise value between 0 and 1
 */
export function noise(x: number, y: number): number {
  const X = Math.floor(x) & NOISE_GRID_MASK;
  const Y = Math.floor(y) & NOISE_GRID_MASK;
  x -= Math.floor(x);
  y -= Math.floor(y);
  
  const a = seededRandom(X + Y * 256);
  const b = seededRandom(X + 1 + Y * 256);
  const c = seededRandom(X + (Y + 1) * 256);
  const d = seededRandom(X + 1 + (Y + 1) * 256);
  
  const u = x * x * (PERLIN_FADE_COEFFICIENT_A - PERLIN_FADE_COEFFICIENT_B * x);
  const v = y * y * (PERLIN_FADE_COEFFICIENT_A - PERLIN_FADE_COEFFICIENT_B * y);
  
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
