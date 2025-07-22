// Shared constants used across multiple files
// File-specific constants are defined in their respective files

// Random number generation - shared between GrainGenerator and potentially other modules
export const SEEDED_RANDOM_MULTIPLIER = 10000;

// Color space and RGB conversion constants
export const RGB_COLOR_CONSTANTS = {
  // sRGB conversion values (normalized 0-1 range)
  BYTE_TO_NORMALIZED: 1.0 / 255.0, // Convert byte (0-255) to normalized (0-1)
  NORMALIZED_TO_BYTE: 255.0, // Convert normalized (0-1) to byte (0-255)

  // Color channel limits
  MIN_COLOR_VALUE: 0,
  MAX_COLOR_VALUE: 255,

  // Floating-point color limits
  MIN_NORMALIZED_COLOR: 0.0,
  MAX_NORMALIZED_COLOR: 1.0,
} as const;

// Film type grain characteristics - could be shared across different grain processing modules
// Based on real film characteristics research for monochrome grain processing:
// - Kodak films traditionally have smooth tonal gradation and moderate grain structure
// - Fuji films are known for fine grain structure and softer contrast
// - Ilford films (B&W heritage) have coarser grain structure and higher contrast
export const FILM_CHARACTERISTICS = {
  kodak: {
    contrast: 1.2,
    grainClumping: 0.8,
    colorVariation: 0.15,
    // Film characteristic curve parameters (photographic S-curve)
    filmCurve: {
      gamma: 2.2, // Overall contrast curve
      toe: 0.05, // Shadow compression point
      shoulder: 0.95, // Highlight compression point
      toeStrength: 0.7, // Shadow compression strength
      shoulderStrength: 0.8, // Highlight compression strength
    },
    // Development threshold characteristics for grain activation (binary on/off gate)
    // This determines the minimum exposure needed to activate grains (make them visible)
    // Separate from sensitivity which multiplies density of already-activated grains
    developmentThreshold: {
      baseSensitivity: 0.35, // Base threshold for grain activation (lower = more sensitive)
      sizeModifier: 0.12, // How grain size affects threshold (larger grains = lower threshold)
      exposureWeight: 0.35, // How local exposure affects activation
      randomVariation: 0.2, // Random variation in threshold between grains
    },
  },
  fuji: {
    contrast: 1.1,
    grainClumping: 0.6,
    colorVariation: 0.12,
    // Film characteristic curve parameters (softer, lower contrast)
    filmCurve: {
      gamma: 1.8, // Lower contrast than Kodak
      toe: 0.08, // Slightly higher shadow point
      shoulder: 0.92, // Earlier highlight rolloff
      toeStrength: 0.6, // Gentler shadow compression
      shoulderStrength: 0.9, // Stronger highlight protection
    },
    // Development threshold characteristics for grain activation (binary on/off gate)
    // This determines the minimum exposure needed to activate grains (make them visible)
    // Separate from sensitivity which multiplies density of already-activated grains
    developmentThreshold: {
      baseSensitivity: 0.4, // Base threshold for grain activation (lower = more sensitive)
      sizeModifier: 0.1, // How grain size affects threshold (larger grains = lower threshold)
      exposureWeight: 0.3, // How local exposure affects activation
      randomVariation: 0.18, // Random variation in threshold between grains
    },
  },
  ilford: {
    contrast: 1.3,
    grainClumping: 0.9,
    colorVariation: 0.18,
    // Film characteristic curve parameters (high contrast, B&W heritage)
    filmCurve: {
      gamma: 2.6, // Higher contrast than others
      toe: 0.03, // Lower shadow point (deeper blacks)
      shoulder: 0.97, // Later highlight rolloff
      toeStrength: 0.8, // Strong shadow contrast
      shoulderStrength: 0.7, // Moderate highlight protection
    },
    // Development threshold characteristics for grain activation (binary on/off gate)
    // This determines the minimum exposure needed to activate grains (make them visible)
    // Separate from sensitivity which multiplies density of already-activated grains
    developmentThreshold: {
      baseSensitivity: 0.85, // Base threshold for grain activation (lower = more sensitive)
      sizeModifier: 0.15, // How grain size affects threshold (larger grains = lower threshold)
      exposureWeight: 0.4, // How local exposure affects activation
      randomVariation: 0.25, // Random variation in threshold between grains
    },
  },
} as const;

// Exposure simulation constants for photographic modeling
export const EXPOSURE_CONVERSION = {
  // Logarithmic scaling factors for RGB to exposure conversion
  // Based on photographic principles where exposure follows log scale
  LOG_BASE: Math.E, // Natural logarithm base
  EXPOSURE_SCALE: 5.0, // Scale factor for exposure range
  LUMINANCE_OFFSET: 0.001, // Prevent log(0) issues in shadows

  // Photographic luminance weights (ITU-R BT.709)
  // These differ from simple average as they account for human eye sensitivity
  LUMINANCE_WEIGHTS: {
    red: 0.2126,
    green: 0.7152,
    blue: 0.0722,
  },

  // Exposure zone mapping (Ansel Adams zone system inspired)
  // Maps 10 zones from pure black (Zone 0) to pure white (Zone IX)
  ZONE_RANGE: 10,
  MIDDLE_GRAY_ZONE: 5, // Zone V = 18% middle gray
  MIDDLE_GRAY_LUMINANCE: 0.18, // 18% reflectance standard

  // Film sensitivity scaling
  // Maps ISO values to exposure sensitivity
  ISO_BASE: 100, // Base ISO for calculations
  ISO_LOG_FACTOR: Math.log(2) / Math.log(10), // ISO doubles = 1 stop = log base conversion
} as const;
