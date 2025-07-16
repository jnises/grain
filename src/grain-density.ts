// Grain Density Calculation Module
// Contains substantial grain physics algorithms for film simulation


// --- Grain Density Calculation Constants ---
// Only truly shared constants should remain here. Function-specific and single-use constants are moved into their respective functions.

import { FILM_CHARACTERISTICS } from './constants';
import { noise } from './noise';
import type { GrainSettings, GrainPoint } from './types';
import { assertInRange, assert } from './utils';

/**
 * Handles grain density calculations and film physics simulation
 */
export class GrainDensityCalculator {
  private settings: GrainSettings;

  constructor(settings: GrainSettings) {
    this.settings = settings;
  }

  /**
   * Pre-calculate intrinsic grain densities for all grains (Phase 1 optimization)
   * This computes grain-specific properties that don't depend on pixel position
   * and caches them for efficient pixel processing
   */
  calculateIntrinsicGrainDensities(grains: GrainPoint[], grainExposureMap: Map<GrainPoint, number>): Map<GrainPoint, number> {
    console.log(`Pre-calculating intrinsic densities for ${grains.length} grains...`);
    
    const intrinsicDensityMap = new Map<GrainPoint, number>();
    
    for (const grain of grains) {
      const grainExposure = grainExposureMap.get(grain);
      assert(
        grainExposure !== undefined,
        'Grain exposure not found in calculated map during intrinsic density calculation',
        { 
          grain: { x: grain.x, y: grain.y, size: grain.size },
          mapSize: grainExposureMap.size,
          grainsLength: grains.length
        }
      );
      
      const intrinsicDensity = this.calculateIntrinsicGrainDensity(grainExposure, grain);
      intrinsicDensityMap.set(grain, intrinsicDensity);
    }
    
    console.log(`Completed intrinsic density calculation for ${intrinsicDensityMap.size} grains`);
    return intrinsicDensityMap;
  }

  /**
   * Enhanced film characteristic curve (photographic S-curve)
   * Implements proper photographic response with toe and shoulder compression
   */
  filmCurve(input: number): number {
    // Validate input
    assertInRange(input, 0, 1, 'input');
    
    // Get film-specific curve parameters
    const filmCharacteristics = FILM_CHARACTERISTICS[this.settings.filmType];
    const curve = filmCharacteristics.filmCurve;
    
    // Apply photographic S-curve with toe and shoulder compression
    // This replaces the basic sigmoid with realistic film characteristic curve
    
    // Ensure input is in valid range
    const x = Math.max(0, Math.min(1, input));
    
    // Apply gamma curve as base
    let output = Math.pow(x, 1.0 / curve.gamma);
    
    // Apply toe compression (shadow detail preservation)
    if (x < curve.toe) {
      const toeRatio = x / curve.toe;
      const compressedToe = Math.pow(toeRatio, curve.toeStrength);
      output = compressedToe * curve.toe;
    }
    
    // Apply shoulder compression (highlight detail preservation)
    if (x > curve.shoulder) {
      const shoulderRange = 1.0 - curve.shoulder;
      const shoulderRatio = (x - curve.shoulder) / shoulderRange;
      const compressedShoulder = 1.0 - Math.pow(1.0 - shoulderRatio, curve.shoulderStrength);
      output = curve.shoulder + compressedShoulder * shoulderRange;
    }
    
    // Ensure output stays in valid range
    return Math.max(0, Math.min(1, output));
  }

  /**
   * Calculate intrinsic grain density based on exposure and grain properties (Phase 1)
   * This method computes grain-specific properties that don't depend on pixel position
   */
  private calculateIntrinsicGrainDensity(exposure: number, grain: GrainPoint): number {
    // Function-specific constants
    const GRAIN_RANDOM_SEED_X = 12345;
    const GRAIN_RANDOM_SEED_Y = 67890;
    const GRAIN_RANDOM_SEED_MOD = 1000000;
    const GRAIN_RANDOM_SENSITIVITY_RANGE = 0.3;
    const GRAIN_RANDOM_SENSITIVITY_OFFSET = 0.15;
    const GRAIN_SIGMOID_STEEPNESS = 8.0;
    const GRAIN_SHAPE_MODIFIER_BASE = 0.8;
    const GRAIN_SHAPE_MODIFIER_SCALE = 0.4;
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
    const randomSeed = (grain.x * GRAIN_RANDOM_SEED_X + grain.y * GRAIN_RANDOM_SEED_Y) % GRAIN_RANDOM_SEED_MOD;
    const randomSensitivity = (randomSeed / GRAIN_RANDOM_SEED_MOD) * GRAIN_RANDOM_SENSITIVITY_RANGE - GRAIN_RANDOM_SENSITIVITY_OFFSET;
    
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
    
    // Apply grain shape variation (intrinsic property)
    const shapeModifier = GRAIN_SHAPE_MODIFIER_BASE + grain.shape * GRAIN_SHAPE_MODIFIER_SCALE;
    grainDensity *= shapeModifier;
    
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
   * This method computes position-dependent visual effects that vary by pixel location
   */
  calculatePixelGrainEffect(intrinsicDensity: number, grain: GrainPoint, pixelX: number, pixelY: number): number {
    // Function-specific constants
    const GRAIN_FALLOFF_RADIUS_MULTIPLIER = 2;
    const NOISE_SCALE_FINE = 0.15;
    const NOISE_SCALE_MEDIUM = 0.08;
    const NOISE_SCALE_COARSE = 0.03;
    const NOISE_WEIGHT_FINE = 0.3;
    const NOISE_WEIGHT_MEDIUM = 0.2;
    const NOISE_WEIGHT_COARSE = 0.1;
    const NOISE_MODULATION_BASE = 0.7;
    const NOISE_MODULATION_SCALE = 0.3;
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
    
    // Apply distance-based falloff (exponential decay)
    const falloffFactor = Math.exp(-distance / grain.size);
    
    // Add grain shape effects (elliptical distortion) based on pixel offset from grain center
    const angle = Math.atan2(offsetY, offsetX);
    const ellipticalDistortion = this.calculateEllipticalDistortion(grain, angle);
    
    // Add pixel-level noise texture using x,y coordinates
    const noiseValue = noise(pixelX * NOISE_SCALE_FINE, pixelY * NOISE_SCALE_FINE) * NOISE_WEIGHT_FINE + 
                      noise(pixelX * NOISE_SCALE_MEDIUM, pixelY * NOISE_SCALE_MEDIUM) * NOISE_WEIGHT_MEDIUM + 
                      noise(pixelX * NOISE_SCALE_COARSE, pixelY * NOISE_SCALE_COARSE) * NOISE_WEIGHT_COARSE;
    // Combine all effects: intrinsic density × distance falloff × shape distortion × noise modulation
    const noiseModulation = NOISE_MODULATION_BASE + Math.abs(noiseValue) * NOISE_MODULATION_SCALE;
    const pixelEffect = intrinsicDensity * falloffFactor * ellipticalDistortion * noiseModulation;
    return pixelEffect;
  }

  /**
   * Calculate elliptical distortion for grain shape effects
   */
  private calculateEllipticalDistortion(grain: GrainPoint, angle: number): number {
    // Function-specific constants
    const ELLIPTICAL_RATIO_BASE = 0.7;
    const ELLIPTICAL_RATIO_SCALE = 0.3;
    const ORIENTATION_ANGLE_SCALE = 0.1;
    // Elliptical grain shape with angle-dependent distortion
    const ellipticalRatio = ELLIPTICAL_RATIO_BASE + grain.shape * ELLIPTICAL_RATIO_SCALE; // Varies from 0.7 to 1.0 based on grain shape
    const orientationAngle = (grain.x + grain.y) * ORIENTATION_ANGLE_SCALE; // Grain orientation based on position
    
    // Calculate elliptical distance modifier
    const relativeAngle = angle - orientationAngle;
    const ellipticalFactor = Math.sqrt(
      Math.pow(Math.cos(relativeAngle), 2) + 
      Math.pow(Math.sin(relativeAngle) * ellipticalRatio, 2)
    );
    
    return ellipticalFactor;
  }
}
