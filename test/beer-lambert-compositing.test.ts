// Test to verify Beer-Lambert law compositing uses white light for physically accurate film viewing

import { describe, it, expect } from 'vitest';
import { applyBeerLambertCompositingFloat } from '../src/grain-math';
import type { GrainDensity } from '../src/types';

describe('Beer-Lambert Law Compositing with White Light', () => {

  it('should produce physically correct results using white light for viewing', () => {
    const grainDensity: GrainDensity = { r: 0.3, g: 0.3, b: 0.3 }; // Moderate grain density

    const beerLambertResult = applyBeerLambertCompositingFloat(grainDensity);
    
    // With white light (1.0) and density 0.3: final = 1.0 * exp(-0.3) ≈ 0.7408
    const expectedValue = 1.0 * Math.exp(-0.3);
    expect(beerLambertResult[0]).toBeCloseTo(expectedValue, 4);
    expect(beerLambertResult[1]).toBeCloseTo(expectedValue, 4);
    expect(beerLambertResult[2]).toBeCloseTo(expectedValue, 4);

    console.log('Beer-Lambert result with white light:', beerLambertResult.map(v => v.toFixed(4)));
    console.log('Expected value:', Math.round(expectedValue));
  });

  it('should provide exponential light transmission behavior with different grain densities', () => {
    const lightGrainDensity: GrainDensity = { r: 0.1, g: 0.1, b: 0.1 };
    const heavyGrainDensity: GrainDensity = { r: 0.5, g: 0.5, b: 0.5 };

    const lightBeerLambert = applyBeerLambertCompositingFloat(lightGrainDensity);
    const heavyBeerLambert = applyBeerLambertCompositingFloat(heavyGrainDensity);

    // Beer-Lambert should show exponential decay behavior
    // Light grain should allow more light through than heavy grain
    expect(lightBeerLambert[0]).toBeGreaterThan(heavyBeerLambert[0]);
    expect(lightBeerLambert[1]).toBeGreaterThan(heavyBeerLambert[1]);
    expect(lightBeerLambert[2]).toBeGreaterThan(heavyBeerLambert[2]);

    // Light grain: 1.0 * exp(-0.1) ≈ 1.0 * 0.905 ≈ 0.905
    // Heavy grain: 1.0 * exp(-0.5) ≈ 1.0 * 0.607 ≈ 0.607
    expect(lightBeerLambert[0]).toBeCloseTo(1.0 * Math.exp(-0.1), 4);
    expect(heavyBeerLambert[0]).toBeCloseTo(1.0 * Math.exp(-0.5), 4);

    console.log('Light grain Beer-Lambert:', lightBeerLambert.map(v => v.toFixed(4)));
    console.log('Heavy grain Beer-Lambert:', heavyBeerLambert.map(v => v.toFixed(4)));
  });

  it('should handle zero density correctly (no grain effect)', () => {
    const noDensity: GrainDensity = { r: 0, g: 0, b: 0 };

    const result = applyBeerLambertCompositingFloat(noDensity);

    // With zero density, white_light * exp(-0) = 1.0 * 1 = 1.0
    expect(result[0]).toBeCloseTo(1.0, 6);
    expect(result[1]).toBeCloseTo(1.0, 6);
    expect(result[2]).toBeCloseTo(1.0, 6);
  });

  it('should demonstrate natural light transmission falloff with high density', () => {
    const highDensity: GrainDensity = { r: 2.0, g: 2.0, b: 2.0 }; // Very high density

    const beerLambertResult = applyBeerLambertCompositingFloat(highDensity);

    // Beer-Lambert should allow some light through even with very high density
    // white_light * exp(-2.0) = 1.0 * exp(-2.0) ≈ 1.0 * 0.135 ≈ 0.135
    const expectedValue = 1.0 * Math.exp(-2.0);
    expect(beerLambertResult[0]).toBeCloseTo(expectedValue, 4);
    expect(beerLambertResult[0]).toBeGreaterThan(0);
    expect(beerLambertResult[0]).toBeLessThan(0.2); // But still quite dark

    console.log('High density Beer-Lambert:', beerLambertResult.map(v => v.toFixed(4)));
    console.log('Expected value:', expectedValue.toFixed(4));
  });
});
