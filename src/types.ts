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

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

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
}

export interface GrainDensity {
  r: number;
  g: number;
  b: number;
}
