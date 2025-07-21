// Grain Density Calculation Module
// Contains substantial grain physics algorithms for film simulation

// --- Grain Density Calculation Constants ---
// Only truly shared constants should remain here. Function-specific and single-use constants are moved into their respective functions.

import { FILM_CHARACTERISTICS } from './constants';
import { calculateGrainFalloff } from './grain-math';
import type {
  GrainSettings,
  GrainPoint,
  GrainExposureMap,
  GrainIntrinsicDensityMap,
  GrainExposure,
  GrainIntrinsicDensity,
  PixelGrainEffect,
} from './types';
import { assert, devAssert, assertArray, devAssertInRange } from './utils';

/**
 * Handles grain density calculations and film physics simulation
 */
export class GrainDensityCalculator {
  private settings: GrainSettings;

  constructor(settings: GrainSettings) {
    assert(
      settings && typeof settings === 'object',
      'settings must be a valid settings object',
      { settings }
    );
    assert(
      ['kodak', 'fuji', 'ilford'].includes(settings.filmType),
      'settings.filmType must be one of: kodak, fuji, ilford',
      { filmType: settings.filmType, validTypes: ['kodak', 'fuji', 'ilford'] }
    );
    assert(
      typeof settings.iso === 'number' && settings.iso > 0,
      'settings.iso must be a positive number',
      { iso: settings.iso }
    );

    this.settings = settings;
  }

  /**
   * Pre-calculate intrinsic grain densities for all grains (Phase 1 optimization)
   * FILM DEVELOPMENT PHASE (Phase 1 - Grain-dependent calculations)
   *
   * This simulates the chemical development process where exposed grains become opaque.
   * Grains that received sufficient light exposure become developed (high optical density).
   * Grains below their development threshold remain undeveloped (transparent).
   *
   * See ALGORITHM_DESIGN.md: "Film Development Phase"
   *
   * This computes grain-specific properties that don't depend on pixel position
   * and caches them for efficient pixel processing
   */
  calculateIntrinsicGrainDensities(
    grains: GrainPoint[],
    grainExposureMap: GrainExposureMap
  ): GrainIntrinsicDensityMap {
    assertArray(grains, 'grains');
    // Allow empty grains array in edge cases (e.g., very small images or high ISO where no grains are generated)
    // Map type is guaranteed by TypeScript, but we validate it has the expected methods
    assert(
      typeof grainExposureMap.has === 'function' &&
        typeof grainExposureMap.get === 'function',
      'grainExposureMap must be a Map with expected methods',
      { grainExposureMap }
    );

    console.log(
      `Pre-calculating intrinsic densities for ${grains.length} grains...`
    );

    const intrinsicDensityMap: GrainIntrinsicDensityMap = new Map();

    for (const grain of grains) {
      const grainExposure = grainExposureMap.get(grain);
      devAssert(
        grainExposure !== undefined,
        'Grain exposure not found in calculated map during intrinsic density calculation',
        {
          grain: { x: grain.x, y: grain.y, size: grain.size },
          mapSize: grainExposureMap.size,
          grainsLength: grains.length,
        }
      );

      const intrinsicDensity = this.calculateIntrinsicGrainDensity(
        grainExposure,
        grain
      );
      intrinsicDensityMap.set(grain, intrinsicDensity);
    }

    console.log(
      `Completed intrinsic density calculation for ${intrinsicDensityMap.size} grains`
    );
    return intrinsicDensityMap;
  }

  /**
   * Enhanced film characteristic curve (photographic S-curve)
   * Implements proper photographic response with toe and shoulder compression
   */
  filmCurve(input: number): number {
    // Validate input - using devAssertInRange for performance in hot code path
    devAssertInRange(input, 0, 1, 'input');

    // Get film-specific curve parameters
    const filmCharacteristics = FILM_CHARACTERISTICS[this.settings.filmType];
    const curve = filmCharacteristics.filmCurve;

    // Apply photographic S-curve with toe and shoulder compression
    // This replaces the basic sigmoid with realistic film characteristic curve

    // Ensure input is in valid range
    const x = Math.max(0, Math.min(1, input));

    // Apply gamma curve as base
    let output = x ** (1.0 / curve.gamma);

    // Apply toe compression (shadow detail preservation)
    if (x < curve.toe) {
      const toeRatio = x / curve.toe;
      const compressedToe = toeRatio ** curve.toeStrength;
      output = compressedToe * curve.toe;
    }

    // Apply shoulder compression (highlight detail preservation)
    if (x > curve.shoulder) {
      const shoulderRatio = (1 - x) / (1 - curve.shoulder);
      const compressedShoulder = shoulderRatio ** curve.shoulderStrength;
      output = 1 - compressedShoulder * (1 - curve.shoulder);
    }

    devAssert(
      output >= 0 && output <= 1,
      'filmCurve output must be in [0, 1] range',
      { output }
    );
    return output;
  }

  /**
   * Calculate the intrinsic optical density of a single grain based on its exposure
   * This is a core part of the film development simulation
   */
  private calculateIntrinsicGrainDensity(
    exposure: GrainExposure,
    grain: GrainPoint
  ): GrainIntrinsicDensity {
    devAssert(Number.isFinite(exposure), 'exposure must be finite', {
      exposure,
    });
    devAssert(
      exposure >= 0 && exposure <= 1,
      'exposure must be in range [0,1]',
      { exposure }
    );
    devAssert(
      grain && typeof grain === 'object',
      'grain must be a valid grain object',
      { grain }
    );
    devAssert(Number.isFinite(grain.x), 'grain.x must be finite', {
      x: grain.x,
    });
    devAssert(Number.isFinite(grain.y), 'grain.y must be finite', {
      y: grain.y,
    });
    devAssert(
      typeof grain.size === 'number' && grain.size > 0,
      'grain.size must be a positive number',
      {
        size: grain.size,
      }
    );
    devAssert(
      grain.sensitivity >= 0 && grain.sensitivity <= 10,
      'grain.sensitivity must be in range [0,10]',
      { sensitivity: grain.sensitivity }
    );
    // Development threshold can be outside [0,1] in some film simulation cases
    devAssert(
      Number.isFinite(grain.developmentThreshold),
      'grain.developmentThreshold must be finite',
      { developmentThreshold: grain.developmentThreshold }
    );

    // Function-specific constants
    const GRAIN_RANDOM_SEED_X = 12345;
    const GRAIN_RANDOM_SEED_Y = 67890;
    const GRAIN_RANDOM_SEED_MOD = 1000000;
    const GRAIN_RANDOM_SENSITIVITY_RANGE = 0.3;
    const GRAIN_RANDOM_SENSITIVITY_OFFSET = 0.15;
    const GRAIN_SIGMOID_STEEPNESS = 8.0;
    const FILM_RESPONSE_VISIBILITY_MULTIPLIER = 1.2;
    // Validate exposure input
    if (!Number.isFinite(exposure)) {
      console.warn(`Invalid exposure value: ${exposure}, defaulting to 0`);
      exposure = 0;
    }

    // Implementation of development threshold system as designed
    // Formula: grain_activation = (local_exposure + random_sensitivity) > development_threshold

    // Calculate random sensitivity variation for this grain
    // Use grain-based randomness for consistent grain behavior (position-independent)
    const randomSeed =
      (grain.x * GRAIN_RANDOM_SEED_X + grain.y * GRAIN_RANDOM_SEED_Y) %
      GRAIN_RANDOM_SEED_MOD;
    const randomSensitivity =
      (randomSeed / GRAIN_RANDOM_SEED_MOD) * GRAIN_RANDOM_SENSITIVITY_RANGE -
      GRAIN_RANDOM_SENSITIVITY_OFFSET;

    // Calculate activation strength
    const activationStrength = exposure + randomSensitivity;

    // Check if grain is activated (above development threshold)
    if (activationStrength <= grain.developmentThreshold) {
      return 0; // Grain not developed - no visible effect
    }

    // Calculate how much above threshold the grain is
    const thresholdExcess = activationStrength - grain.developmentThreshold;

    // Apply sigmoid function for smooth grain density response
    // sigmoid_function(activation_strength - threshold)
    const normalizedExcess = thresholdExcess * GRAIN_SIGMOID_STEEPNESS;
    const sigmoidResponse = 1.0 / (1.0 + Math.exp(-normalizedExcess));

    // Base grain density from sigmoid response
    let grainDensity = sigmoidResponse;

    // Apply grain sensitivity for individual grain variation
    grainDensity *= grain.sensitivity;

    // Ensure grainDensity is within [0,1] range before applying film curve
    grainDensity = Math.max(0, Math.min(1, grainDensity));

    // Additional validation to prevent NaN
    if (!Number.isFinite(grainDensity)) {
      console.warn(`Invalid grainDensity: ${grainDensity}, defaulting to 0`);
      grainDensity = 0;
    }

    // Apply film characteristic curve for density response
    const filmResponse = this.filmCurve(grainDensity);
    return filmResponse * FILM_RESPONSE_VISIBILITY_MULTIPLIER;
  }

  /**
   * Calculate pixel-level grain effects (Phase 2)
   * DARKROOM PRINTING PHASE - Position-dependent spatial effects
   *
   * This simulates light passing through the developed film negative to create the final photograph.
   * The spatial effect of each grain varies by distance from the grain center.
   * Uses pre-calculated intrinsic grain density from the development phase.
   *
   * See ALGORITHM_DESIGN.md: "Darkroom Printing Phase"
   *
   * This method computes position-dependent visual effects that vary by pixel location
   */
  calculatePixelGrainEffect(
    intrinsicDensity: GrainIntrinsicDensity,
    grain: GrainPoint,
    pixelX: number,
    pixelY: number
  ): PixelGrainEffect {
    // Function-specific constants
    const GRAIN_FALLOFF_RADIUS_MULTIPLIER = 2;

    // If grain not activated, return 0
    if (intrinsicDensity === 0) {
      return 0;
    }

    // Calculate offset from grain center
    const offsetX = pixelX - grain.x;
    const offsetY = pixelY - grain.y;

    // Calculate distance from grain center
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    // Add distance falloff calculation based on grain position and radius
    const falloffRadius = grain.size * GRAIN_FALLOFF_RADIUS_MULTIPLIER; // Grain influence extends to 2x grain size
    if (distance >= falloffRadius) {
      return 0; // No effect beyond falloff radius
    }

    // Apply distance-based falloff using shared Gaussian function for consistency with exposure sampling
    const falloffFactor = calculateGrainFalloff(distance, grain.size);

    // Apply the intrinsic density with consistent falloff
    const pixelEffect = intrinsicDensity * falloffFactor;
    return pixelEffect;
  }
}
