// Shared constants used across multiple files
// File-specific constants are defined in their respective files

// Random number generation - shared between GrainGenerator and potentially other modules
export const SEEDED_RANDOM_MULTIPLIER = 10000;

// Film type grain characteristics - could be shared across different grain processing modules
export const FILM_CHARACTERISTICS = {
  kodak: {
    contrast: 1.2,
    grainClumping: 0.8,
    colorVariation: 0.15
  },
  fuji: {
    contrast: 1.1,
    grainClumping: 0.6,
    colorVariation: 0.12
  },
  ilford: {
    contrast: 1.3,
    grainClumping: 0.9,
    colorVariation: 0.18
  }
} as const;

// Common image processing constants that could be shared
export const ALPHA_CHANNEL_INDEX = 3;
export const RGBA_CHANNELS = 4;
