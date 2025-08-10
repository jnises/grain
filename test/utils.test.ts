import { describe, it, expect, vi } from 'vitest';
import {
  assert,
  assertPositiveInteger,
  assertPositiveNumber,
  assertNonNegativeNumber,
  assertInRange,
  assertArray,
  assertObject,
  assertPoint2D,
  assertImageData,
  assertValidGridCoordinates,
  assertFiniteNumber,
} from '../src/utils';
import {
  createMockImageData,
  createMockImageDataWithCustomLength,
} from './test-utils';

describe('Utils - Assertion Functions', () => {
  describe('assert', () => {
    it('should pass when condition is truthy', () => {
      expect(() => assert(true, 'Test message')).not.toThrow();
      expect(() => assert(1, 'Test message')).not.toThrow();
      expect(() => assert('non-empty', 'Test message')).not.toThrow();
      expect(() => assert([], 'Test message')).not.toThrow();
      expect(() => assert({}, 'Test message')).not.toThrow();
    });

    it('should throw when condition is falsy', () => {
      expect(() => assert(false, 'Test message')).toThrow(
        'Assertion failed: Test message'
      );
      expect(() => assert(0, 'Zero is falsy')).toThrow(
        'Assertion failed: Zero is falsy'
      );
      expect(() => assert('', 'Empty string')).toThrow(
        'Assertion failed: Empty string'
      );
      expect(() => assert(null, 'Null value')).toThrow(
        'Assertion failed: Null value'
      );
      expect(() => assert(undefined, 'Undefined value')).toThrow(
        'Assertion failed: Undefined value'
      );
    });

    it('should include context in error logging when provided', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        assert(false, 'Test message', { testKey: 'testValue', number: 42 });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Error should be thrown
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Assertion failed:',
        'Test message'
      );
      expect(consoleSpy).toHaveBeenCalledWith('Context:', {
        testKey: 'testValue',
        number: 42,
      });

      consoleSpy.mockRestore();
    });
  });

  describe('assertPositiveInteger', () => {
    it('should pass for positive integers', () => {
      expect(() => assertPositiveInteger(1, 'test')).not.toThrow();
      expect(() => assertPositiveInteger(42, 'test')).not.toThrow();
      expect(() => assertPositiveInteger(1000, 'test')).not.toThrow();
    });

    it('should throw for non-positive numbers', () => {
      expect(() => assertPositiveInteger(0, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(-1, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(-42, 'test')).toThrow(
        'test must be a positive integer'
      );
    });

    it('should throw for non-integers', () => {
      expect(() => assertPositiveInteger(1.5, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(3.14, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(0.1, 'test')).toThrow(
        'test must be a positive integer'
      );
    });

    it('should throw for non-numbers', () => {
      expect(() => assertPositiveInteger('1', 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(true, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger([], 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger({}, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(null, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(undefined, 'test')).toThrow(
        'test must be a positive integer'
      );
    });

    it('should throw for special number values', () => {
      expect(() => assertPositiveInteger(NaN, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(Infinity, 'test')).toThrow(
        'test must be a positive integer'
      );
      expect(() => assertPositiveInteger(-Infinity, 'test')).toThrow(
        'test must be a positive integer'
      );
    });
  });

  describe('assertPositiveNumber', () => {
    it('should pass for positive numbers', () => {
      expect(() => assertPositiveNumber(1, 'test')).not.toThrow();
      expect(() => assertPositiveNumber(1.5, 'test')).not.toThrow();
      expect(() => assertPositiveNumber(0.1, 'test')).not.toThrow();
      expect(() => assertPositiveNumber(42.7, 'test')).not.toThrow();
    });

    it('should throw for non-positive numbers', () => {
      expect(() => assertPositiveNumber(0, 'test')).toThrow(
        'test must be a positive finite number'
      );
      expect(() => assertPositiveNumber(-1, 'test')).toThrow(
        'test must be a positive finite number'
      );
      expect(() => assertPositiveNumber(-0.5, 'test')).toThrow(
        'test must be a positive finite number'
      );
    });

    it('should throw for non-finite numbers', () => {
      expect(() => assertPositiveNumber(NaN, 'test')).toThrow(
        'test must be a positive finite number'
      );
      expect(() => assertPositiveNumber(Infinity, 'test')).toThrow(
        'test must be a positive finite number'
      );
      expect(() => assertPositiveNumber(-Infinity, 'test')).toThrow(
        'test must be a positive finite number'
      );
    });

    it('should throw for non-numbers', () => {
      expect(() => assertPositiveNumber('1', 'test')).toThrow(
        'test must be a positive finite number'
      );
      expect(() => assertPositiveNumber(true, 'test')).toThrow(
        'test must be a positive finite number'
      );
      expect(() => assertPositiveNumber([], 'test')).toThrow(
        'test must be a positive finite number'
      );
    });
  });

  describe('assertNonNegativeNumber', () => {
    it('should pass for non-negative numbers', () => {
      expect(() => assertNonNegativeNumber(0, 'test')).not.toThrow();
      expect(() => assertNonNegativeNumber(1, 'test')).not.toThrow();
      expect(() => assertNonNegativeNumber(1.5, 'test')).not.toThrow();
      expect(() => assertNonNegativeNumber(0.0, 'test')).not.toThrow();
    });

    it('should throw for negative numbers', () => {
      expect(() => assertNonNegativeNumber(-1, 'test')).toThrow(
        'test must be a non-negative finite number'
      );
      expect(() => assertNonNegativeNumber(-0.1, 'test')).toThrow(
        'test must be a non-negative finite number'
      );
      expect(() => assertNonNegativeNumber(-42, 'test')).toThrow(
        'test must be a non-negative finite number'
      );
    });

    it('should throw for non-finite numbers', () => {
      expect(() => assertNonNegativeNumber(NaN, 'test')).toThrow(
        'test must be a non-negative finite number'
      );
      expect(() => assertNonNegativeNumber(Infinity, 'test')).toThrow(
        'test must be a non-negative finite number'
      );
      expect(() => assertNonNegativeNumber(-Infinity, 'test')).toThrow(
        'test must be a non-negative finite number'
      );
    });
  });

  describe('assertInRange', () => {
    it('should pass for values within range', () => {
      expect(() => assertInRange(5, 0, 10, 'test')).not.toThrow();
      expect(() => assertInRange(0, 0, 10, 'test')).not.toThrow();
      expect(() => assertInRange(10, 0, 10, 'test')).not.toThrow();
      expect(() => assertInRange(0.5, 0, 1, 'test')).not.toThrow();
    });

    it('should throw for values outside range', () => {
      expect(() => assertInRange(-1, 0, 10, 'test')).toThrow(
        'test must be between 0 and 10'
      );
      expect(() => assertInRange(11, 0, 10, 'test')).toThrow(
        'test must be between 0 and 10'
      );
      expect(() => assertInRange(1.1, 0, 1, 'test')).toThrow(
        'test must be between 0 and 1'
      );
    });
  });

  describe('assertArray', () => {
    it('should pass for arrays', () => {
      expect(() => assertArray([], 'test')).not.toThrow();
      expect(() => assertArray([1, 2, 3], 'test')).not.toThrow();
      expect(() => assertArray(['a', 'b'], 'test')).not.toThrow();
      expect(() => assertArray([{}, {}], 'test')).not.toThrow();
    });

    it('should throw for non-arrays', () => {
      expect(() => assertArray({}, 'test')).toThrow('test must be an array');
      expect(() => assertArray('string', 'test')).toThrow(
        'test must be an array'
      );
      expect(() => assertArray(42, 'test')).toThrow('test must be an array');
      expect(() => assertArray(null, 'test')).toThrow('test must be an array');
      expect(() => assertArray(undefined, 'test')).toThrow(
        'test must be an array'
      );
    });
  });

  describe('assertObject', () => {
    it('should pass for valid objects', () => {
      expect(() => assertObject({}, 'test')).not.toThrow();
      expect(() => assertObject({ key: 'value' }, 'test')).not.toThrow();
      expect(() => assertObject({ a: 1, b: 2 }, 'test')).not.toThrow();
    });

    it('should throw for null', () => {
      expect(() => assertObject(null, 'test')).toThrow(
        'test must be a non-null object'
      );
    });

    it('should throw for arrays', () => {
      expect(() => assertObject([], 'test')).toThrow(
        'test must be a non-null object'
      );
      expect(() => assertObject([1, 2, 3], 'test')).toThrow(
        'test must be a non-null object'
      );
    });

    it('should throw for non-objects', () => {
      expect(() => assertObject('string', 'test')).toThrow(
        'test must be a non-null object'
      );
      expect(() => assertObject(42, 'test')).toThrow(
        'test must be a non-null object'
      );
      expect(() => assertObject(true, 'test')).toThrow(
        'test must be a non-null object'
      );
      expect(() => assertObject(undefined, 'test')).toThrow(
        'test must be a non-null object'
      );
    });
  });

  describe('assertPoint2D', () => {
    it('should pass for valid Point2D objects', () => {
      expect(() => assertPoint2D({ x: 0, y: 0 }, 'test')).not.toThrow();
      expect(() => assertPoint2D({ x: 1.5, y: 2.7 }, 'test')).not.toThrow();
      expect(() => assertPoint2D({ x: -10, y: 10 }, 'test')).not.toThrow();
    });

    it('should throw for objects missing x or y', () => {
      expect(() => assertPoint2D({ x: 1 }, 'test')).toThrow(
        'test must have numeric x and y properties'
      );
      expect(() => assertPoint2D({ y: 1 }, 'test')).toThrow(
        'test must have numeric x and y properties'
      );
      expect(() => assertPoint2D({}, 'test')).toThrow(
        'test must have numeric x and y properties'
      );
    });

    it('should throw for objects with non-numeric x or y', () => {
      expect(() => assertPoint2D({ x: '1', y: 2 }, 'test')).toThrow(
        'test must have numeric x and y properties'
      );
      expect(() => assertPoint2D({ x: 1, y: '2' }, 'test')).toThrow(
        'test must have numeric x and y properties'
      );
      expect(() => assertPoint2D({ x: null, y: 2 }, 'test')).toThrow(
        'test must have numeric x and y properties'
      );
    });

    it('should throw for objects with non-finite x or y', () => {
      expect(() => assertPoint2D({ x: NaN, y: 2 }, 'test')).toThrow(
        'test x and y must be finite numbers'
      );
      expect(() => assertPoint2D({ x: 1, y: Infinity }, 'test')).toThrow(
        'test x and y must be finite numbers'
      );
      expect(() => assertPoint2D({ x: -Infinity, y: 2 }, 'test')).toThrow(
        'test x and y must be finite numbers'
      );
    });

    it('should throw for non-objects', () => {
      expect(() => assertPoint2D(null, 'test')).toThrow(
        'test must be a non-null object'
      );
      expect(() => assertPoint2D('string', 'test')).toThrow(
        'test must be a non-null object'
      );
      expect(() => assertPoint2D([], 'test')).toThrow(
        'test must be a non-null object'
      );
    });
  });

  describe('assertImageData', () => {
    it('should pass for valid ImageData objects', () => {
      expect(() =>
        assertImageData(createMockImageData(100, 50), 'test')
      ).not.toThrow();
      expect(() =>
        assertImageData(createMockImageData(1, 1), 'test')
      ).not.toThrow();
      expect(() =>
        assertImageData(createMockImageData(800, 600), 'test')
      ).not.toThrow();
    });

    it('should throw for objects missing required properties', () => {
      expect(() => assertImageData({ width: 100, height: 50 }, 'test')).toThrow(
        'test must be a valid ImageData object'
      );
      expect(() =>
        assertImageData(
          { width: 100, data: new Uint8ClampedArray(100) },
          'test'
        )
      ).toThrow('test must be a valid ImageData object');
      expect(() =>
        assertImageData(
          { height: 50, data: new Uint8ClampedArray(100) },
          'test'
        )
      ).toThrow('test must be a valid ImageData object');
    });

    it('should throw for non-positive dimensions', () => {
      expect(() =>
        assertImageData(createMockImageDataWithCustomLength(0, 50), 'test')
      ).toThrow('test.width must be a positive integer');
      expect(() =>
        assertImageData(createMockImageDataWithCustomLength(100, 0), 'test')
      ).toThrow('test.height must be a positive integer');

      // For negative dimensions, create the object manually to avoid Uint8ClampedArray constructor error
      const negativeWidthImageData = {
        width: -1,
        height: 50,
        data: new Uint8ClampedArray(100), // Use positive length to avoid constructor error
      };
      expect(() => assertImageData(negativeWidthImageData, 'test')).toThrow(
        'test.width must be a positive integer'
      );
    });

    it('should throw for empty data array', () => {
      expect(() =>
        assertImageData(createMockImageDataWithCustomLength(100, 50, 0), 'test')
      ).toThrow('test.data must not be empty');
    });

    it('should throw for non-objects', () => {
      expect(() => assertImageData(null, 'test')).toThrow(
        'test must be a non-null object'
      );
      expect(() => assertImageData('string', 'test')).toThrow(
        'test must be a non-null object'
      );
    });
  });

  describe('assertValidGridCoordinates', () => {
    it('should pass for valid coordinates', () => {
      expect(() =>
        assertValidGridCoordinates(0, 0, 10, 10, 'test context')
      ).not.toThrow();
      expect(() =>
        assertValidGridCoordinates(5, 5, 10, 10, 'test context')
      ).not.toThrow();
      expect(() =>
        assertValidGridCoordinates(9, 9, 10, 10, 'test context')
      ).not.toThrow();
    });

    it('should throw for out-of-bounds x coordinates', () => {
      expect(() =>
        assertValidGridCoordinates(-1, 5, 10, 10, 'test context')
      ).toThrow('Grid X coordinate out of bounds in test context');
      expect(() =>
        assertValidGridCoordinates(10, 5, 10, 10, 'test context')
      ).toThrow('Grid X coordinate out of bounds in test context');
      expect(() =>
        assertValidGridCoordinates(15, 5, 10, 10, 'test context')
      ).toThrow('Grid X coordinate out of bounds in test context');
    });

    it('should throw for out-of-bounds y coordinates', () => {
      expect(() =>
        assertValidGridCoordinates(5, -1, 10, 10, 'test context')
      ).toThrow('Grid Y coordinate out of bounds in test context');
      expect(() =>
        assertValidGridCoordinates(5, 10, 10, 10, 'test context')
      ).toThrow('Grid Y coordinate out of bounds in test context');
      expect(() =>
        assertValidGridCoordinates(5, 15, 10, 10, 'test context')
      ).toThrow('Grid Y coordinate out of bounds in test context');
    });
  });

  describe('assertFiniteNumber', () => {
    it('should pass for finite numbers', () => {
      expect(() => assertFiniteNumber(0, 'test')).not.toThrow();
      expect(() => assertFiniteNumber(1, 'test')).not.toThrow();
      expect(() => assertFiniteNumber(-1, 'test')).not.toThrow();
      expect(() => assertFiniteNumber(1.5, 'test')).not.toThrow();
      expect(() => assertFiniteNumber(-3.14, 'test')).not.toThrow();
    });

    it('should throw for non-finite numbers', () => {
      expect(() => assertFiniteNumber(NaN, 'test')).toThrow(
        'test must be a finite number'
      );
      expect(() => assertFiniteNumber(Infinity, 'test')).toThrow(
        'test must be a finite number'
      );
      expect(() => assertFiniteNumber(-Infinity, 'test')).toThrow(
        'test must be a finite number'
      );
    });

    it('should throw for non-numbers', () => {
      expect(() => assertFiniteNumber('1', 'test')).toThrow(
        'test must be a finite number'
      );
      expect(() => assertFiniteNumber(true, 'test')).toThrow(
        'test must be a finite number'
      );
      expect(() => assertFiniteNumber([], 'test')).toThrow(
        'test must be a finite number'
      );
      expect(() => assertFiniteNumber({}, 'test')).toThrow(
        'test must be a finite number'
      );
      expect(() => assertFiniteNumber(null, 'test')).toThrow(
        'test must be a finite number'
      );
      expect(() => assertFiniteNumber(undefined, 'test')).toThrow(
        'test must be a finite number'
      );
    });
  });
});
