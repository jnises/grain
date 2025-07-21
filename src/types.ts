// Shared types for film grain processing

// Random number generator interface for dependency injection
export interface RandomNumberGenerator {
  random(): number;
}

/** Film emulsion type affecting grain characteristics and development behavior */
export type FilmType = 'kodak' | 'fuji' | 'ilford';

export interface GrainSettings {
  /** ISO sensitivity value (e.g., 100, 400, 800) */
  iso: number;
  filmType: FilmType;
  debugGrainCenters?: boolean; // Optional debug option to draw grain center points
  // Iterative lightness compensation parameters
  maxIterations?: number; // Maximum iterations for lightness convergence (default: 5)
  convergenceThreshold?: number; // Lightness convergence tolerance as ratio (default: 0.05 for 5%)
  /** Sampling density for lightness estimation during iterations (0.0 to 1.0, default: 0.1) */
  lightnessEstimationSamplingDensity?: number;
}

export interface GrainProcessingResult {
  imageData: ImageData;
  success: boolean;
  error?: string;
}

export interface GrainProcessingProgress {
  progress: number;
  stage: string;
}

// Worker message types
export interface ProcessMessage {
  type: 'process';
  imageData: ImageData;
  settings: GrainSettings;
}

export interface ProgressMessage {
  type: 'progress';
  progress: number;
  stage: string;
}

export interface ResultMessage {
  type: 'result';
  imageData: ImageData;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
}

// Grain processing internal types
export interface Point2D {
  /** X coordinate in pixel space */
  x: number;
  /** Y coordinate in pixel space */
  y: number;
}

export interface GrainPoint {
  /** X coordinate in pixel space */
  x: number;
  /** Y coordinate in pixel space */
  y: number;
  /** Grain size in pixels */
  size: number;
  /** Grain sensitivity coefficient affecting light response */
  sensitivity: number;
  /** Development threshold for activation (0-1 range) */
  developmentThreshold: number;
}

export interface GrayscaleGrainDensity {
  /** Grain density value (unitless optical density) */
  density: number;
}

export interface FilmCharacteristics {
  /** Film contrast factor affecting tone curve steepness */
  contrast: number;
  /** Grain clumping factor affecting spatial distribution */
  grainClumping: number;
  /** Color variation coefficient for grain appearance */
  colorVariation: number;
}

/**
 * Represents the light exposure received by a single grain.
 * This is a linear float value, typically in the range [0, 1].
 */
export type GrainExposure = number & { __brand: 'GrainExposure' };

/**
 * A map from each grain point to its calculated light exposure.
 */
export type GrainExposureMap = Map<GrainPoint, GrainExposure>;

/**
 * Represents the intrinsic optical density of a single developed grain.
 * This is a unitless value representing light absorption, typically in the range [0, 1].
 */
export type GrainIntrinsicDensity = number & { __brand: 'GrainIntrinsicDensity' };

/**
 * A map from each grain point to its intrinsic density after the development phase.
 */
export type GrainIntrinsicDensityMap = Map<GrainPoint, GrainIntrinsicDensity>;

/**
 * Represents the contribution of a single grain to a pixel's total density.
 * This is a unitless value.
 */
export type PixelGrainEffect = number & { __brand: 'PixelGrainEffect' };

// Helper functions to create branded types
export function createGrainExposure(value: number): GrainExposure {
  return value as GrainExposure;
}

export function createGrainIntrinsicDensity(value: number): GrainIntrinsicDensity {
  return value as GrainIntrinsicDensity;
}

export function createPixelGrainEffect(value: number): PixelGrainEffect {
  return value as PixelGrainEffect;
}
