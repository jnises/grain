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
    }
  }
} as const;

// Common image processing constants that could be shared
export const ALPHA_CHANNEL_INDEX = 3;
export const RGBA_CHANNELS = 4;
