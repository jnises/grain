// Shared types for film grain processing

// Random number generator interface for dependency injection
export interface RandomNumberGenerator {
  random(): number;
}

export interface GrainSettings {
  iso: number;
  filmType: 'kodak' | 'fuji' | 'ilford';
  grainIntensity: number;
  upscaleFactor: number;
  debugGrainCenters?: boolean; // Optional debug option to draw grain center points
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
  x: number;
  y: number;
}

/**
 * @deprecated RGB-based LAB color representation from the color processing era.
 * The system now processes grayscale images exclusively. Consider removing in future cleanup.
 */
export interface LabColor {
  l: number;
  a: number;
  b: number;
}

/**
 * @deprecated RGB-based effect representation from the color processing era.
 * The system now processes grayscale images exclusively. Consider removing in future cleanup.
 */
export interface RgbEffect {
  r: number;
  g: number;
  b: number;
}

export interface GrainPoint {
  x: number;
  y: number;
  size: number;
  sensitivity: number;
  shape: number;
  developmentThreshold: number; // Per-grain development threshold for activation
}

/**
 * @deprecated RGB-based grain density from the color processing era.
 * The system now processes grayscale images exclusively. Consider removing in future cleanup.
 */
export interface GrainDensity {
  r: number;
  g: number;
  b: number;
}

export interface GrayscaleGrainDensity {
  density: number;
}

export interface FilmCharacteristics {
  contrast: number;
  grainClumping: number;
  colorVariation: number;
}
