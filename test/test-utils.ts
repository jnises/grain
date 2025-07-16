/**
 * Shared test utilities for the grain processing test suite
 */

/**
 * Create mock ImageData for testing (Node.js compatible)
 */
export function createMockImageData(width: number, height: number, fillValue = 128): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue;     // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255;       // A (alpha)
  }
  // Mock ImageData object for Node.js environment
  return {
    data,
    width,
    height
  } as ImageData;
}

/**
 * Create mock ImageData for testing with custom data length (for testing edge cases)
 */
export function createMockImageDataWithCustomLength(width: number, height: number, dataLength?: number): { width: number; height: number; data: Uint8ClampedArray } {
  return {
    width,
    height,
    data: new Uint8ClampedArray(dataLength ?? width * height * 4)
  };
}
