// Test to verify Beer-Lambert law compositing produces different results than linear compositing

import { describe, it, expect, beforeEach } from 'vitest';
import { GrainProcessor } from '../src/grain-worker';
import type { GrainSettings, GrainDensity } from '../src/types';

// Create a test class that extends GrainProcessor to access protected methods
class TestableGrainProcessor extends GrainProcessor {
  public testApplyBeerLambertCompositing(originalColor: [number, number, number], grainDensity: GrainDensity): [number, number, number] {
    return this.applyBeerLambertCompositing(originalColor, grainDensity);
  }
}

describe('Beer-Lambert Law Compositing', () => {
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

  // Simulate the old linear compositing function for comparison
  function applyLinearCompositing(originalColor: [number, number, number], grainDensity: GrainDensity): [number, number, number] {
    const [r, g, b] = originalColor;
    
    // Old simplified model: final = original * (1 - density)
    return [
      r * (1 - Math.min(0.8, grainDensity.r)),
      g * (1 - Math.min(0.8, grainDensity.g)),
      b * (1 - Math.min(0.8, grainDensity.b))
    ];
  }

  it('should produce different results than linear compositing for moderate grain density', () => {
    const originalColor: [number, number, number] = [128, 128, 128]; // Mid-gray
    const grainDensity: GrainDensity = { r: 0.3, g: 0.3, b: 0.3 }; // Moderate grain density

    const beerLambertResult = processor.testApplyBeerLambertCompositing(originalColor, grainDensity);
    const linearResult = applyLinearCompositing(originalColor, grainDensity);

    // The results should be different
    expect(beerLambertResult[0]).not.toBeCloseTo(linearResult[0], 1);
    expect(beerLambertResult[1]).not.toBeCloseTo(linearResult[1], 1);
    expect(beerLambertResult[2]).not.toBeCloseTo(linearResult[2], 1);

    console.log('Original:', originalColor);
    console.log('Beer-Lambert result:', beerLambertResult.map(v => Math.round(v)));
    console.log('Linear result:', linearResult.map(v => Math.round(v)));
  });

  it('should provide more physically accurate light transmission behavior', () => {
    const originalColor: [number, number, number] = [200, 150, 100]; // Bright warm color
    const lightGrainDensity: GrainDensity = { r: 0.1, g: 0.1, b: 0.1 };
    const heavyGrainDensity: GrainDensity = { r: 0.5, g: 0.5, b: 0.5 };

    const lightBeerLambert = processor.testApplyBeerLambertCompositing(originalColor, lightGrainDensity);
    const heavyBeerLambert = processor.testApplyBeerLambertCompositing(originalColor, heavyGrainDensity);

    // Beer-Lambert should show exponential decay behavior
    // Light grain should preserve more of the original brightness
    expect(lightBeerLambert[0]).toBeGreaterThan(heavyBeerLambert[0]);
    expect(lightBeerLambert[1]).toBeGreaterThan(heavyBeerLambert[1]);
    expect(lightBeerLambert[2]).toBeGreaterThan(heavyBeerLambert[2]);

    // All channels should be reduced from original but preserve color relationships
    expect(lightBeerLambert[0]).toBeLessThan(originalColor[0]);
    expect(lightBeerLambert[1]).toBeLessThan(originalColor[1]);
    expect(lightBeerLambert[2]).toBeLessThan(originalColor[2]);

    console.log('Light grain Beer-Lambert:', lightBeerLambert.map(v => Math.round(v)));
    console.log('Heavy grain Beer-Lambert:', heavyBeerLambert.map(v => Math.round(v)));
  });

  it('should handle zero density correctly (no grain effect)', () => {
    const originalColor: [number, number, number] = [255, 128, 64];
    const noDensity: GrainDensity = { r: 0, g: 0, b: 0 };

    const result = processor.testApplyBeerLambertCompositing(originalColor, noDensity);

    // With zero density, exp(-0) = 1, so result should equal original
    expect(result[0]).toBeCloseTo(originalColor[0], 6);
    expect(result[1]).toBeCloseTo(originalColor[1], 6);
    expect(result[2]).toBeCloseTo(originalColor[2], 6);
  });

  it('should demonstrate natural light transmission falloff with high density', () => {
    const originalColor: [number, number, number] = [255, 255, 255]; // Pure white
    const highDensity: GrainDensity = { r: 2.0, g: 2.0, b: 2.0 }; // Very high density

    const beerLambertResult = processor.testApplyBeerLambertCompositing(originalColor, highDensity);
    const linearResult = applyLinearCompositing(originalColor, highDensity);

    // Beer-Lambert should allow some light through even with high density
    // Linear model would clamp to near-black (due to 0.8 clamp)
    expect(beerLambertResult[0]).toBeGreaterThan(0);
    expect(beerLambertResult[0]).toBeLessThan(50); // But still quite dark

    // Linear is clamped and darker
    expect(linearResult[0]).toBeCloseTo(255 * 0.2, 5); // Clamped to 1-0.8 = 0.2

    console.log('High density Beer-Lambert:', beerLambertResult.map(v => Math.round(v)));
    console.log('High density Linear (clamped):', linearResult.map(v => Math.round(v)));
  });
});
