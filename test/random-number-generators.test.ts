import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DefaultRandomNumberGenerator, 
  SeededRandomNumberGenerator 
} from '../src/grain-generator';
import { SEEDED_RANDOM_MULTIPLIER } from '../src/constants';

describe('Random Number Generators', () => {
  describe('DefaultRandomNumberGenerator', () => {
    let rng: DefaultRandomNumberGenerator;

    beforeEach(() => {
      rng = new DefaultRandomNumberGenerator();
    });

    it('should return numbers between 0 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should return different values on successive calls', () => {
      const values: number[] = [];
      for (let i = 0; i < 10; i++) {
        values.push(rng.random());
      }
      
      // Check that not all values are the same (very unlikely with Math.random)
      const allSame = values.every(val => val === values[0]);
      expect(allSame).toBe(false);
    });

    it('should return finite numbers', () => {
      for (let i = 0; i < 50; i++) {
        const value = rng.random();
        expect(Number.isFinite(value)).toBe(true);
        expect(Number.isNaN(value)).toBe(false);
      }
    });
  });

  describe('SeededRandomNumberGenerator', () => {
    describe('constructor', () => {
      it('should use default seed when none provided', () => {
        const rng = new SeededRandomNumberGenerator();
        const value1 = rng.random();
        
        const rng2 = new SeededRandomNumberGenerator();
        const value2 = rng2.random();
        
        expect(value1).toBe(value2);
      });

      it('should use provided seed', () => {
        const rng1 = new SeededRandomNumberGenerator(12345);
        const rng2 = new SeededRandomNumberGenerator(12345);
        
        expect(rng1.random()).toBe(rng2.random());
      });

      it('should produce different sequences for different seeds', () => {
        const rng1 = new SeededRandomNumberGenerator(12345);
        const rng2 = new SeededRandomNumberGenerator(54321);
        
        const sequence1 = [rng1.random(), rng1.random(), rng1.random()];
        const sequence2 = [rng2.random(), rng2.random(), rng2.random()];
        
        expect(sequence1).not.toEqual(sequence2);
      });
    });

    describe('random', () => {
      let rng: SeededRandomNumberGenerator;

      beforeEach(() => {
        rng = new SeededRandomNumberGenerator(42);
      });

      it('should return numbers between 0 and 1', () => {
        for (let i = 0; i < 100; i++) {
          const value = rng.random();
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      });

      it('should return finite numbers', () => {
        for (let i = 0; i < 50; i++) {
          const value = rng.random();
          expect(Number.isFinite(value)).toBe(true);
          expect(Number.isNaN(value)).toBe(false);
        }
      });

      it('should produce deterministic sequence', () => {
        const rng1 = new SeededRandomNumberGenerator(123);
        const rng2 = new SeededRandomNumberGenerator(123);
        
        const sequence1: number[] = [];
        const sequence2: number[] = [];
        
        for (let i = 0; i < 10; i++) {
          sequence1.push(rng1.random());
          sequence2.push(rng2.random());
        }
        
        expect(sequence1).toEqual(sequence2);
      });

      it('should use SEEDED_RANDOM_MULTIPLIER constant correctly', () => {
        // Test that the algorithm matches the expected implementation
        const seed = 100;
        const rng = new SeededRandomNumberGenerator(seed);
        
        // Calculate first value manually to verify algorithm
        const x = Math.sin(seed) * SEEDED_RANDOM_MULTIPLIER;
        const expectedFirst = x - Math.floor(x);
        
        expect(rng.random()).toBeCloseTo(expectedFirst, 10);
      });

      it('should advance internal state with each call', () => {
        const values: number[] = [];
        
        for (let i = 0; i < 5; i++) {
          values.push(rng.random());
        }
        
        // All values should be different (implementation advances state)
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).toBe(values.length);
      });
    });

    describe('reset', () => {
      it('should reset to original seed sequence', () => {
        const rng = new SeededRandomNumberGenerator(999);
        
        // Generate initial sequence
        const initialSequence = [
          rng.random(),
          rng.random(),
          rng.random()
        ];
        
        // Generate more numbers to advance state
        rng.random();
        rng.random();
        
        // Reset and generate sequence again
        rng.reset();
        const resetSequence = [
          rng.random(),
          rng.random(),
          rng.random()
        ];
        
        expect(resetSequence).toEqual(initialSequence);
      });

      it('should work multiple times', () => {
        const rng = new SeededRandomNumberGenerator(777);
        
        const firstValue = rng.random();
        
        // Advance and reset multiple times
        rng.random(); rng.random();
        rng.reset();
        expect(rng.random()).toBe(firstValue);
        
        rng.random(); rng.random(); rng.random();
        rng.reset();
        expect(rng.random()).toBe(firstValue);
      });
    });

    describe('deterministic behavior', () => {
      it('should produce same output for same seed across different instances', () => {
        const seed = 2024;
        const count = 20;
        
        const rng1 = new SeededRandomNumberGenerator(seed);
        const rng2 = new SeededRandomNumberGenerator(seed);
        
        for (let i = 0; i < count; i++) {
          expect(rng1.random()).toBe(rng2.random());
        }
      });

      it('should handle edge case seeds', () => {
        const edgeSeeds = [0, 1, -1, 0.5, -0.5, 1000000, -1000000];
        
        edgeSeeds.forEach(seed => {
          const rng = new SeededRandomNumberGenerator(seed);
          
          // Should not crash and should produce valid output
          for (let i = 0; i < 5; i++) {
            const value = rng.random();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
            expect(Number.isFinite(value)).toBe(true);
          }
        });
      });

      it('should be reproducible for testing purposes', () => {
        // This test demonstrates the key feature - deterministic output for testing
        const testSeed = 314159;
        const rng = new SeededRandomNumberGenerator(testSeed);
        
        // These exact values should always be produced for this seed
        // This allows for deterministic testing of algorithms that use random numbers
        const expectedFirstFive = [
          rng.random(),
          rng.random(), 
          rng.random(),
          rng.random(),
          rng.random()
        ];
        
        // Reset and verify same sequence
        rng.reset();
        const actualFirstFive = [
          rng.random(),
          rng.random(), 
          rng.random(),
          rng.random(),
          rng.random()
        ];
        
        expect(actualFirstFive).toEqual(expectedFirstFive);
      });
    });
  });
});
