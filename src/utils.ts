// Utility functions for the grain processing application

/**
 * Custom assertion function that provides type narrowing and better error handling
 * than console.assert. This function will throw an error in all environments,
 * ensuring assertions are never ignored.
 * 
 * @param condition The condition to assert
 * @param message Error message to display if assertion fails
 * @param context Optional context object to include in error logging
 */
export function assert(
  condition: unknown,
  message: string,
  context?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    // Log error with context for debugging
    console.error('Assertion failed:', message);
    if (context) {
      console.error('Context:', context);
    }
    
    // Throw error to fail fast
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert that a value is a positive integer
 */
export function assertPositiveInteger(
  value: unknown,
  name: string
): asserts value is number {
  assert(
    typeof value === 'number' && value > 0 && Number.isInteger(value),
    `${name} must be a positive integer`,
    { [name]: value, type: typeof value, isInteger: Number.isInteger(value) }
  );
}

/**
 * Assert that a value is a positive number
 */
export function assertPositiveNumber(
  value: unknown,
  name: string
): asserts value is number {
  assert(
    typeof value === 'number' && value > 0 && Number.isFinite(value),
    `${name} must be a positive finite number`,
    { [name]: value, type: typeof value, isFinite: Number.isFinite(value) }
  );
}

/**
 * Assert that a value is a non-negative number
 */
export function assertNonNegativeNumber(
  value: unknown,
  name: string
): asserts value is number {
  assert(
    typeof value === 'number' && value >= 0 && Number.isFinite(value),
    `${name} must be a non-negative finite number`,
    { [name]: value, type: typeof value, isFinite: Number.isFinite(value) }
  );
}

/**
 * Assert that a value is within a specific range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  name: string
): asserts value is number {
  assert(
    value >= min && value <= max,
    `${name} must be between ${min} and ${max}`,
    { [name]: value, min, max, inRange: value >= min && value <= max }
  );
}

/**
 * Assert that a value is an array
 */
export function assertArray<T>(
  value: unknown,
  name: string
): asserts value is T[] {
  assert(
    Array.isArray(value),
    `${name} must be an array`,
    { [name]: value, type: typeof value, isArray: Array.isArray(value) }
  );
}

/**
 * Assert that a value is a non-null object
 */
export function assertObject(
  value: unknown,
  name: string
): asserts value is Record<string, unknown> {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    `${name} must be a non-null object`,
    { [name]: value, type: typeof value, isNull: value === null, isArray: Array.isArray(value) }
  );
}

/**
 * Type guard and assertion for Point2D objects
 */
export function assertPoint2D(
  point: unknown,
  name: string
): asserts point is { x: number; y: number } {
  assertObject(point, name);
  assert(
    typeof point.x === 'number' && typeof point.y === 'number',
    `${name} must have numeric x and y properties`,
    { [name]: point, hasX: 'x' in point, hasY: 'y' in point, xType: typeof point.x, yType: typeof point.y }
  );
  assert(
    Number.isFinite(point.x) && Number.isFinite(point.y),
    `${name} x and y must be finite numbers`,
    { [name]: point, xFinite: Number.isFinite(point.x), yFinite: Number.isFinite(point.y) }
  );
}

/**
 * Type guard and assertion for ImageData objects
 */
export function assertImageData(
  imageData: unknown,
  name: string
): asserts imageData is ImageData {
  assertObject(imageData, name);
  const obj = imageData as Record<string, unknown>;
  assert(
    typeof obj.width === 'number' && 
    typeof obj.height === 'number' && 
    obj.data && 
    typeof (obj.data as ArrayLike<number>).length === 'number',
    `${name} must be a valid ImageData object`,
    { 
      [name]: imageData,
      hasWidth: 'width' in obj,
      hasHeight: 'height' in obj,
      hasData: 'data' in obj,
      widthType: typeof obj.width,
      heightType: typeof obj.height,
      dataLength: (obj.data as ArrayLike<number>)?.length
    }
  );
  assertPositiveInteger(obj.width, `${name}.width`);
  assertPositiveInteger(obj.height, `${name}.height`);
  assert(
    (obj.data as ArrayLike<number>).length > 0,
    `${name}.data must not be empty`,
    { dataLength: (obj.data as ArrayLike<number>).length }
  );
}

/**
 * Assert that grid coordinates are valid
 */
export function assertValidGridCoordinates(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
  context: string
): void {
  assert(
    x >= 0 && x < gridWidth,
    `Grid X coordinate out of bounds in ${context}`,
    { x, gridWidth, validRange: `[0, ${gridWidth})` }
  );
  assert(
    y >= 0 && y < gridHeight,
    `Grid Y coordinate out of bounds in ${context}`,
    { y, gridHeight, validRange: `[0, ${gridHeight})` }
  );
}

/**
 * Assert that a number is finite and not NaN
 */
export function assertFiniteNumber(
  value: unknown,
  name: string
): asserts value is number {
  assert(
    typeof value === 'number' && Number.isFinite(value),
    `${name} must be a finite number`,
    { [name]: value, type: typeof value, isFinite: Number.isFinite(value), isNaN: Number.isNaN(value) }
  );
}
