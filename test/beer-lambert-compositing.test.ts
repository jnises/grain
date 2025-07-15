// Test to verify Beer-Lambert law compositing uses white light for physically accurate film viewing

import { describe, it, expect, beforeEach } from 'vitest';
import { GrainProcessor } from '../src/grain-worker';
import type { GrainSettings, GrainDensity } from '../src/types';

// Create a test class that extends GrainProcessor to access protected methods
class TestableGrainProcessor extends GrainProcessor {
  public testApplyBeerLambertCompositing(grainDensity: GrainDensity): [number, number, number] {
    return this.applyBeerLambertCompositing(grainDensity);
  }
}

describe('Beer-Lambert Law Compositing with White Light', () => {
  let processor: TestableGrainProcessor;
  let settings: GrainSettings;

  beforeEach(() => {
    settings = {
      iso: 400,
      filmType: 'kodak',
      grainIntensity: 1.0,
      upscaleFactor: 1.0
    };
    processor = new TestableGrainProcessor(100, 100, settings);
  });

  it('should produce physically correct results using white light for viewing', () => {
    const grainDensity: GrainDensity = { r: 0.3, g: 0.3, b: 0.3 }; // Moderate grain density

    const beerLambertResult = processor.testApplyBeerLambertCompositing(grainDensity);
    
    // With white light (255) and density 0.3: final = 255 * exp(-0.3) ≈ 255 * 0.7408 ≈ 189
    const expectedValue = 255 * Math.exp(-0.3);
    expect(beerLambertResult[0]).toBeCloseTo(expectedValue, 1);
    expect(beerLambertResult[1]).toBeCloseTo(expectedValue, 1);
    expect(beerLambertResult[2]).toBeCloseTo(expectedValue, 1);

    console.log('Beer-Lambert result with white light:', beerLambertResult.map(v => Math.round(v)));
    console.log('Expected value:', Math.round(expectedValue));
  });

  it('should provide exponential light transmission behavior with different grain densities', () => {
    const lightGrainDensity: GrainDensity = { r: 0.1, g: 0.1, b: 0.1 };
    const heavyGrainDensity: GrainDensity = { r: 0.5, g: 0.5, b: 0.5 };

    const lightBeerLambert = processor.testApplyBeerLambertCompositing(lightGrainDensity);
    const heavyBeerLambert = processor.testApplyBeerLambertCompositing(heavyGrainDensity);

    // Beer-Lambert should show exponential decay behavior
    // Light grain should allow more light through than heavy grain
    expect(lightBeerLambert[0]).toBeGreaterThan(heavyBeerLambert[0]);
    expect(lightBeerLambert[1]).toBeGreaterThan(heavyBeerLambert[1]);
    expect(lightBeerLambert[2]).toBeGreaterThan(heavyBeerLambert[2]);

    // Light grain: 255 * exp(-0.1) ≈ 255 * 0.905 ≈ 231
    // Heavy grain: 255 * exp(-0.5) ≈ 255 * 0.607 ≈ 155
    expect(lightBeerLambert[0]).toBeCloseTo(255 * Math.exp(-0.1), 1);
    expect(heavyBeerLambert[0]).toBeCloseTo(255 * Math.exp(-0.5), 1);

    console.log('Light grain Beer-Lambert:', lightBeerLambert.map(v => Math.round(v)));
    console.log('Heavy grain Beer-Lambert:', heavyBeerLambert.map(v => Math.round(v)));
  });

  it('should handle zero density correctly (no grain effect)', () => {
    const noDensity: GrainDensity = { r: 0, g: 0, b: 0 };

    const result = processor.testApplyBeerLambertCompositing(noDensity);

    // With zero density, white_light * exp(-0) = 255 * 1 = 255
    expect(result[0]).toBeCloseTo(255, 6);
    expect(result[1]).toBeCloseTo(255, 6);
    expect(result[2]).toBeCloseTo(255, 6);
  });

  it('should demonstrate natural light transmission falloff with high density', () => {
    const highDensity: GrainDensity = { r: 2.0, g: 2.0, b: 2.0 }; // Very high density

    const beerLambertResult = processor.testApplyBeerLambertCompositing(highDensity);

    // Beer-Lambert should allow some light through even with very high density
    // white_light * exp(-2.0) = 255 * exp(-2.0) ≈ 255 * 0.135 ≈ 34.5
    const expectedValue = 255 * Math.exp(-2.0);
    expect(beerLambertResult[0]).toBeCloseTo(expectedValue, 1);
    expect(beerLambertResult[0]).toBeGreaterThan(0);
    expect(beerLambertResult[0]).toBeLessThan(50); // But still quite dark

    console.log('High density Beer-Lambert:', beerLambertResult.map(v => Math.round(v)));
    console.log('Expected value:', Math.round(expectedValue));
  });
});
