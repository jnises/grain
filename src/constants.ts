// Shared constants used across multiple files
// File-specific constants are defined in their respective files

// Random number generation - shared between GrainGenerator and potentially other modules
export const SEEDED_RANDOM_MULTIPLIER = 10000;

// Film type grain characteristics - could be shared across different grain processing modules
// Based on real film characteristics research:
// - Kodak films traditionally have higher red sensitivity, balanced color response
// - Fuji films are known for green-leaning response and fine grain structure
// - Ilford films (B&W heritage) have strong blue sensitivity, coarser grain structure
export const FILM_CHARACTERISTICS = {
  kodak: {
    contrast: 1.2,
    grainClumping: 0.8,
    colorVariation: 0.15,
    // Channel sensitivity based on traditional Kodak color negative films
    channelSensitivity: {
      red: 0.85,    // Kodak traditionally strong in reds
      green: 0.90,  // Balanced green response
      blue: 0.75    // Slightly less blue sensitive
    },
    // Color temperature shifts within grains
    colorShift: {
      red: 0.02,    // Slight warm shift in grain
      green: 0.00,  // Neutral green
      blue: -0.01   // Slight cool reduction
    },
    // Film characteristic curve parameters (photographic S-curve)
    filmCurve: {
      gamma: 2.2,           // Overall contrast curve
      toe: 0.05,            // Shadow compression point
      shoulder: 0.95,       // Highlight compression point
      toeStrength: 0.7,     // Shadow compression strength
      shoulderStrength: 0.8 // Highlight compression strength
    }
  },
  fuji: {
    contrast: 1.1,
    grainClumping: 0.6,
    colorVariation: 0.12,
    // Channel sensitivity based on Fuji's green-leaning characteristics
    channelSensitivity: {
      red: 0.75,    // Less red sensitive than Kodak
      green: 0.95,  // Fuji's signature green response
      blue: 0.80    // Moderate blue sensitivity
    },
    // Fuji's characteristic color shifts
    colorShift: {
      red: -0.01,   // Slight cool shift
      green: 0.03,  // Enhanced green luminosity
      blue: 0.01    // Slight blue enhancement
    },
    // Film characteristic curve parameters (softer, lower contrast)
    filmCurve: {
      gamma: 1.8,           // Lower contrast than Kodak
      toe: 0.08,            // Slightly higher shadow point
      shoulder: 0.92,       // Earlier highlight rolloff
      toeStrength: 0.6,     // Gentler shadow compression
      shoulderStrength: 0.9 // Stronger highlight protection
    }
  },
  ilford: {
    contrast: 1.3,
    grainClumping: 0.9,
    colorVariation: 0.18,
    // Channel sensitivity based on Ilford's B&W heritage and blue sensitivity
    channelSensitivity: {
      red: 0.70,    // Traditional B&W films less red sensitive
      green: 0.85,  // Moderate green response
      blue: 0.95    // Strong blue sensitivity (B&W tradition)
    },
    // Ilford's more neutral but contrasty color response
    colorShift: {
      red: 0.00,    // Neutral red
      green: 0.01,  // Slight green enhancement
      blue: 0.02    // Enhanced blue contrast
    },
    // Film characteristic curve parameters (high contrast, B&W heritage)
    filmCurve: {
      gamma: 2.6,           // Higher contrast than others
      toe: 0.03,            // Lower shadow point (deeper blacks)
      shoulder: 0.97,       // Later highlight rolloff
      toeStrength: 0.8,     // Strong shadow contrast
      shoulderStrength: 0.7 // Moderate highlight protection
    }
  }
} as const;

// Common image processing constants that could be shared
export const ALPHA_CHANNEL_INDEX = 3;
export const RGBA_CHANNELS = 4;

// Exposure simulation constants for photographic modeling
export const EXPOSURE_CONVERSION = {
  // Logarithmic scaling factors for RGB to exposure conversion
  // Based on photographic principles where exposure follows log scale
  LOG_BASE: Math.E,                    // Natural logarithm base
  EXPOSURE_SCALE: 5.0,                 // Scale factor for exposure range
  LUMINANCE_OFFSET: 0.001,             // Prevent log(0) issues in shadows
  
  // Photographic luminance weights (ITU-R BT.709)
  // These differ from simple average as they account for human eye sensitivity
  LUMINANCE_WEIGHTS: {
    red: 0.2126,
    green: 0.7152,
    blue: 0.0722
  },
  
  // Exposure zone mapping (Ansel Adams zone system inspired)
  // Maps 10 zones from pure black (Zone 0) to pure white (Zone IX)
  ZONE_RANGE: 10,
  MIDDLE_GRAY_ZONE: 5,                 // Zone V = 18% middle gray
  MIDDLE_GRAY_LUMINANCE: 0.18,         // 18% reflectance standard
  
  // Film sensitivity scaling
  // Maps ISO values to exposure sensitivity
  ISO_BASE: 100,                       // Base ISO for calculations
  ISO_LOG_FACTOR: Math.log(2) / Math.log(10) // ISO doubles = 1 stop = log base conversion
} as const;
