import { describe, it, expect } from 'vitest';
import {
  createTestGrainProcessor,
  createMockImageData,
  countWhitePixels,
  whitePixelPercentage,
} from './test-utils.js';
import type { GrainSettings } from '../src/types.js';

// Named constants replacing prior magic numbers (per PR review feedback)
const TOLERANCE = 30; // ± range around middle gray allowed due to grain variation
const WHITE_PIXEL_CHANNEL_THRESHOLD = 240; // Per-channel threshold for "white" detection
const MAX_WHITE_PIXEL_PERCENTAGE_MIDDLE_GRAY = 50; // Middle-gray test must not exceed this
const MAX_WHITE_PIXEL_PERCENTAGE_ANY_INPUT = 80; // Any input should stay below this

describe('GrainProcessor White Output Fix', () => {
  const defaultSettings: GrainSettings = {
    iso: 800,
    filmType: 'kodak',
  };

  it('should preserve middle gray on average when processing middle gray input', async () => {
    // Test parameters
    const width = 100;
    const height = 100;
    const middleGray = 128; // Middle gray value (0-255)

    // Create test processor and middle gray image
    const processor = createTestGrainProcessor(width, height, defaultSettings);
    const inputImage = createMockImageData(width, height, middleGray);

    // Process the image
    const result = await processor.processImage(inputImage);

    // Calculate average output values
    let totalR = 0,
      totalG = 0,
      totalB = 0;
    const pixelCount = width * height;

    for (let i = 0; i < result.data.length; i += 4) {
      totalR += result.data[i];
      totalG += result.data[i + 1];
      totalB += result.data[i + 2];
    }

    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;

    // The output should be close to the input on average
    // Allow some tolerance for grain effects, but not massive deviation
    expect(avgR).toBeGreaterThan(middleGray - TOLERANCE);
    expect(avgR).toBeLessThan(middleGray + TOLERANCE);
    expect(avgG).toBeGreaterThan(middleGray - TOLERANCE);
    expect(avgG).toBeLessThan(middleGray + TOLERANCE);
    expect(avgB).toBeGreaterThan(middleGray - TOLERANCE);
    expect(avgB).toBeLessThan(middleGray + TOLERANCE);

    // Also check that we're not getting mostly white output (> WHITE_PIXEL_CHANNEL_THRESHOLD)
    const whitePixels = countWhitePixels(result, WHITE_PIXEL_CHANNEL_THRESHOLD);
    const whitePct = (whitePixels / pixelCount) * 100;

    // Should not have mostly white output (this was the bug)
    expect(whitePct).toBeLessThan(MAX_WHITE_PIXEL_PERCENTAGE_MIDDLE_GRAY);
  });

  it('should not produce completely white output for any reasonable input', async () => {
    // Test with different gray levels to ensure we don't get white output anywhere
    const width = 50;
    const height = 50;
    const testGrayLevels = [64, 128, 192]; // Dark gray, middle gray, light gray

    for (const grayLevel of testGrayLevels) {
      const processor = createTestGrainProcessor(
        width,
        height,
        defaultSettings
      );
      const inputImage = createMockImageData(width, height, grayLevel);

      const result = await processor.processImage(inputImage);

      const whitePct = whitePixelPercentage(
        result,
        WHITE_PIXEL_CHANNEL_THRESHOLD
      );

      // For any input, we shouldn't get more than MAX_WHITE_PIXEL_PERCENTAGE_ANY_INPUT white pixels
      // (even light gray input should show some grain variation)
      expect(whitePct).toBeLessThan(MAX_WHITE_PIXEL_PERCENTAGE_ANY_INPUT);
    }
  });
});
