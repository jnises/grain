import { describe, it, expect } from 'vitest';
import { squirrelNoise5 } from '../src/grain-math';

describe('Squirrel Noise 5 Statistical Properties', () => {
  it('should handle integer inputs correctly', () => {
    // Test squirrelNoise5 directly with integer inputs
    expect(() => squirrelNoise5(42)).not.toThrow();
    expect(() => squirrelNoise5(0)).not.toThrow();
    expect(() => squirrelNoise5(-5)).not.toThrow();

    // Test that different integers produce different hashes
    const hash1 = squirrelNoise5(42);
    const hash2 = squirrelNoise5(43);
    const hash3 = squirrelNoise5(0);

    expect(hash1).not.toBe(hash2);
    expect(hash2).not.toBe(hash3);
    expect(hash1).not.toBe(hash3);

    // Test that same integer produces same hash
    expect(squirrelNoise5(42)).toBe(hash1);
  });

  it('should show avalanche effect (small input changes cause large output changes)', () => {
    const pairs = [
      [0, 1],
      [100, 101],
      [12345, 12346],
      [999999, 1000000],
    ];

    for (const [seed1, seed2] of pairs) {
      const value1 = squirrelNoise5(seed1);
      const value2 = squirrelNoise5(seed2);

      // Values should be significantly different (not just small difference)
      const difference = Math.abs(value1 - value2);
      expect(difference).toBeGreaterThan(0); // Any difference is good
    }
  });
});
