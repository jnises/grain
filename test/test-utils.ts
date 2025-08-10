/**
 * Shared test utilities for the grain processing test suite
 */

import { GrainProcessor } from '../src/grain-processor';
import { SeededRandomNumberGenerator } from '../src/grain-generator';
import type { GrainSettings } from '../src/types';

/**
 * Create mock ImageData for testing (Node.js compatible)
 */
export function createMockImageData(
  width: number,
  height: number,
  fillValue = 128
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue; // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255; // A (alpha)
  }
  // Mock ImageData object for Node.js environment
  return {
    data,
    width,
    height,
  } as ImageData;
}

/**
 * Create test ImageData with custom pixel generator function
 */
export function createTestImageData(
  width: number,
  height: number,
  pixelGenerator: (
    x: number,
    y: number
  ) => { r: number; g: number; b: number; a: number }
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = pixelGenerator(x, y);
      const index = (y * width + x) * 4;

      data[index] = pixel.r; // R
      data[index + 1] = pixel.g; // G
      data[index + 2] = pixel.b; // B
      data[index + 3] = pixel.a; // A
    }
  }

  return {
    data,
    width,
    height,
  } as ImageData;
}

/**
 * Create mock ImageData for testing with custom data length (for testing edge cases)
 */
export function createMockImageDataWithCustomLength(
  width: number,
  height: number,
  dataLength?: number
): { width: number; height: number; data: Uint8ClampedArray } {
  return {
    width,
    height,
    data: new Uint8ClampedArray(dataLength ?? width * height * 4),
  };
}

/**
 * Create a GrainProcessor with deterministic RNG for testing
 */
export function createTestGrainProcessor(
  width: number,
  height: number,
  settings: GrainSettings,
  seed = 12345
): GrainProcessor {
  const rng = new SeededRandomNumberGenerator(seed);
  return new GrainProcessor(width, height, settings, rng);
}

/**
 * Calculates the average pixel difference between two ImageData objects.
 * @param originalImage The original image.
 * @param processedImage The processed image.
 * @returns The average difference per pixel.
 */
export function calculateImageDifference(
  originalImage: ImageData,
  processedImage: ImageData
): number {
  let totalDifference = 0;
  let pixelCount = 0;

  for (let i = 0; i < originalImage.data.length; i += 4) {
    // Compare RGB channels (skip alpha)
    const originalR = originalImage.data[i];
    const originalG = originalImage.data[i + 1];
    const originalB = originalImage.data[i + 2];

    const processedR = processedImage.data[i];
    const processedG = processedImage.data[i + 1];
    const processedB = processedImage.data[i + 2];

    // Calculate per-pixel difference (using Euclidean distance)
    const pixelDifference = Math.sqrt(
      (processedR - originalR) ** 2 +
        (processedG - originalG) ** 2 +
        (processedB - originalB) ** 2
    );

    totalDifference += pixelDifference;
    pixelCount++;
  }

  return totalDifference / pixelCount;
}
