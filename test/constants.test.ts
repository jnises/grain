import { describe, it, expect } from 'vitest';
import { 
  SEEDED_RANDOM_MULTIPLIER,
  FILM_CHARACTERISTICS,
  ALPHA_CHANNEL_INDEX,
  RGBA_CHANNELS,
  EXPOSURE_CONVERSION
} from '../src/constants';

describe('Constants Validation', () => {
  describe('SEEDED_RANDOM_MULTIPLIER', () => {
    it('should be a positive number', () => {
      expect(typeof SEEDED_RANDOM_MULTIPLIER).toBe('number');
      expect(SEEDED_RANDOM_MULTIPLIER).toBeGreaterThan(0);
      expect(Number.isFinite(SEEDED_RANDOM_MULTIPLIER)).toBe(true);
    });

    it('should be large enough for random number generation', () => {
      // Should be at least 1000 to provide sufficient range for seeded RNG
      expect(SEEDED_RANDOM_MULTIPLIER).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('RGBA channel constants', () => {
    it('should have correct ALPHA_CHANNEL_INDEX', () => {
      expect(ALPHA_CHANNEL_INDEX).toBe(3);
      expect(typeof ALPHA_CHANNEL_INDEX).toBe('number');
    });

    it('should have correct RGBA_CHANNELS count', () => {
      expect(RGBA_CHANNELS).toBe(4);
      expect(typeof RGBA_CHANNELS).toBe('number');
    });
  });

  describe('FILM_CHARACTERISTICS', () => {
    const filmTypes = ['kodak', 'fuji', 'ilford'] as const;

    filmTypes.forEach(filmType => {
      describe(`${filmType} film characteristics`, () => {
        const characteristics = FILM_CHARACTERISTICS[filmType];

        it('should have valid contrast value', () => {
          expect(typeof characteristics.contrast).toBe('number');
          expect(characteristics.contrast).toBeGreaterThan(0);
          expect(characteristics.contrast).toBeLessThanOrEqual(3); // Reasonable upper bound
          expect(Number.isFinite(characteristics.contrast)).toBe(true);
        });

        it('should have valid grainClumping value', () => {
          expect(typeof characteristics.grainClumping).toBe('number');
          expect(characteristics.grainClumping).toBeGreaterThanOrEqual(0);
          expect(characteristics.grainClumping).toBeLessThanOrEqual(1);
          expect(Number.isFinite(characteristics.grainClumping)).toBe(true);
        });

        it('should have valid colorVariation value', () => {
          expect(typeof characteristics.colorVariation).toBe('number');
          expect(characteristics.colorVariation).toBeGreaterThanOrEqual(0);
          expect(characteristics.colorVariation).toBeLessThanOrEqual(1); // Should be a factor
          expect(Number.isFinite(characteristics.colorVariation)).toBe(true);
        });

        it('should have valid channelSensitivity values', () => {
          const { channelSensitivity } = characteristics;
          
          expect(typeof channelSensitivity.red).toBe('number');
          expect(typeof channelSensitivity.green).toBe('number');
          expect(typeof channelSensitivity.blue).toBe('number');
          
          // Sensitivities should be positive and reasonable (usually 0.5-1.0 range)
          expect(channelSensitivity.red).toBeGreaterThan(0);
          expect(channelSensitivity.red).toBeLessThanOrEqual(1);
          expect(channelSensitivity.green).toBeGreaterThan(0);
          expect(channelSensitivity.green).toBeLessThanOrEqual(1);
          expect(channelSensitivity.blue).toBeGreaterThan(0);
          expect(channelSensitivity.blue).toBeLessThanOrEqual(1);
          
          expect(Number.isFinite(channelSensitivity.red)).toBe(true);
          expect(Number.isFinite(channelSensitivity.green)).toBe(true);
          expect(Number.isFinite(channelSensitivity.blue)).toBe(true);
        });

        it('should have valid colorShift values', () => {
          const { colorShift } = characteristics;
          
          expect(typeof colorShift.red).toBe('number');
          expect(typeof colorShift.green).toBe('number');
          expect(typeof colorShift.blue).toBe('number');
          
          // Color shifts should be small values (typically -0.1 to 0.1)
          expect(colorShift.red).toBeGreaterThanOrEqual(-0.5);
          expect(colorShift.red).toBeLessThanOrEqual(0.5);
          expect(colorShift.green).toBeGreaterThanOrEqual(-0.5);
          expect(colorShift.green).toBeLessThanOrEqual(0.5);
          expect(colorShift.blue).toBeGreaterThanOrEqual(-0.5);
          expect(colorShift.blue).toBeLessThanOrEqual(0.5);
          
          expect(Number.isFinite(colorShift.red)).toBe(true);
          expect(Number.isFinite(colorShift.green)).toBe(true);
          expect(Number.isFinite(colorShift.blue)).toBe(true);
        });

        it('should have valid filmCurve parameters', () => {
          const { filmCurve } = characteristics;
          
          // Gamma should be positive, typically 1.5-3.0 for photography
          expect(typeof filmCurve.gamma).toBe('number');
          expect(filmCurve.gamma).toBeGreaterThan(1);
          expect(filmCurve.gamma).toBeLessThanOrEqual(5);
          expect(Number.isFinite(filmCurve.gamma)).toBe(true);
          
          // Toe should be in valid range (0-1, typically small values)
          expect(typeof filmCurve.toe).toBe('number');
          expect(filmCurve.toe).toBeGreaterThanOrEqual(0);
          expect(filmCurve.toe).toBeLessThan(filmCurve.shoulder); // Toe should be less than shoulder
          expect(Number.isFinite(filmCurve.toe)).toBe(true);
          
          // Shoulder should be in valid range (0-1, typically high values)
          expect(typeof filmCurve.shoulder).toBe('number');
          expect(filmCurve.shoulder).toBeGreaterThan(filmCurve.toe); // Shoulder should be greater than toe
          expect(filmCurve.shoulder).toBeLessThanOrEqual(1);
          expect(Number.isFinite(filmCurve.shoulder)).toBe(true);
          
          // Strength values should be between 0 and 1
          expect(typeof filmCurve.toeStrength).toBe('number');
          expect(filmCurve.toeStrength).toBeGreaterThanOrEqual(0);
          expect(filmCurve.toeStrength).toBeLessThanOrEqual(1);
          expect(Number.isFinite(filmCurve.toeStrength)).toBe(true);
          
          expect(typeof filmCurve.shoulderStrength).toBe('number');
          expect(filmCurve.shoulderStrength).toBeGreaterThanOrEqual(0);
          expect(filmCurve.shoulderStrength).toBeLessThanOrEqual(1);
          expect(Number.isFinite(filmCurve.shoulderStrength)).toBe(true);
        });
      });
    });

    it('should have different characteristics for each film type', () => {
      // Verify that film types actually have different values (not just copies)
      const kodak = FILM_CHARACTERISTICS.kodak;
      const fuji = FILM_CHARACTERISTICS.fuji;
      const ilford = FILM_CHARACTERISTICS.ilford;
      
      // At least some values should be different between film types
      const kodakValues = [kodak.contrast, kodak.grainClumping, kodak.colorVariation];
      const fujiValues = [fuji.contrast, fuji.grainClumping, fuji.colorVariation];
      const ilfordValues = [ilford.contrast, ilford.grainClumping, ilford.colorVariation];
      
      expect(kodakValues).not.toEqual(fujiValues);
      expect(fujiValues).not.toEqual(ilfordValues);
      expect(kodakValues).not.toEqual(ilfordValues);
    });
  });

  describe('EXPOSURE_CONVERSION', () => {
    it('should have valid logarithmic constants', () => {
      expect(EXPOSURE_CONVERSION.LOG_BASE).toBe(Math.E);
      expect(typeof EXPOSURE_CONVERSION.EXPOSURE_SCALE).toBe('number');
      expect(EXPOSURE_CONVERSION.EXPOSURE_SCALE).toBeGreaterThan(0);
      
      expect(typeof EXPOSURE_CONVERSION.LUMINANCE_OFFSET).toBe('number');
      expect(EXPOSURE_CONVERSION.LUMINANCE_OFFSET).toBeGreaterThan(0);
      expect(EXPOSURE_CONVERSION.LUMINANCE_OFFSET).toBeLessThan(0.1); // Should be small
    });

    it('should have valid luminance weights that sum to 1', () => {
      const { LUMINANCE_WEIGHTS } = EXPOSURE_CONVERSION;
      
      expect(typeof LUMINANCE_WEIGHTS.red).toBe('number');
      expect(typeof LUMINANCE_WEIGHTS.green).toBe('number');
      expect(typeof LUMINANCE_WEIGHTS.blue).toBe('number');
      
      // ITU-R BT.709 weights should be positive
      expect(LUMINANCE_WEIGHTS.red).toBeGreaterThan(0);
      expect(LUMINANCE_WEIGHTS.green).toBeGreaterThan(0);
      expect(LUMINANCE_WEIGHTS.blue).toBeGreaterThan(0);
      
      // Should sum to approximately 1.0
      const sum = LUMINANCE_WEIGHTS.red + LUMINANCE_WEIGHTS.green + LUMINANCE_WEIGHTS.blue;
      expect(sum).toBeCloseTo(1.0, 5);
      
      // Green should be the highest weight (human eye sensitivity)
      expect(LUMINANCE_WEIGHTS.green).toBeGreaterThan(LUMINANCE_WEIGHTS.red);
      expect(LUMINANCE_WEIGHTS.green).toBeGreaterThan(LUMINANCE_WEIGHTS.blue);
    });

    it('should have valid zone system parameters', () => {
      expect(typeof EXPOSURE_CONVERSION.ZONE_RANGE).toBe('number');
      expect(EXPOSURE_CONVERSION.ZONE_RANGE).toBe(10); // Ansel Adams zone system
      
      expect(typeof EXPOSURE_CONVERSION.MIDDLE_GRAY_ZONE).toBe('number');
      expect(EXPOSURE_CONVERSION.MIDDLE_GRAY_ZONE).toBe(5); // Zone V
      
      expect(typeof EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE).toBe('number');
      expect(EXPOSURE_CONVERSION.MIDDLE_GRAY_LUMINANCE).toBe(0.18); // 18% gray standard
    });

    it('should have valid ISO parameters', () => {
      expect(typeof EXPOSURE_CONVERSION.ISO_BASE).toBe('number');
      expect(EXPOSURE_CONVERSION.ISO_BASE).toBe(100); // Standard base ISO
      
      expect(typeof EXPOSURE_CONVERSION.ISO_LOG_FACTOR).toBe('number');
      expect(EXPOSURE_CONVERSION.ISO_LOG_FACTOR).toBeGreaterThan(0);
      expect(Number.isFinite(EXPOSURE_CONVERSION.ISO_LOG_FACTOR)).toBe(true);
      
      // Should be approximately log(2)/log(10) ≈ 0.301
      const expectedLogFactor = Math.log(2) / Math.log(10);
      expect(EXPOSURE_CONVERSION.ISO_LOG_FACTOR).toBeCloseTo(expectedLogFactor, 5);
    });

    it('should be properly typed as const (compile-time immutability)', () => {
      // This test verifies that the constants are properly typed
      // The 'as const' assertion provides compile-time immutability
      expect(typeof EXPOSURE_CONVERSION).toBe('object');
      expect(EXPOSURE_CONVERSION).toBeDefined();
      
      // Runtime test: verify that direct property access works but assignment would fail at compile time
      // We can't test runtime immutability without Object.freeze(), but TypeScript prevents mutations
      expect(EXPOSURE_CONVERSION.EXPOSURE_SCALE).toBe(5.0);
      expect(EXPOSURE_CONVERSION.ISO_BASE).toBe(100);
    });
  });
});
