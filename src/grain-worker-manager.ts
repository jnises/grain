// Utility for managing the grain processing worker

import type {
  GrainSettings,
  GrainProcessingResult,
  GrainProcessingProgress
} from './types';

// Re-export shared types for consumers
export type {
  GrainSettings,
  GrainProcessingResult,
  GrainProcessingProgress
} from './types';

export class GrainWorkerManager {
  private worker: Worker | null = null;
  private isProcessing = false;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    try {
      // Create worker from the grain-worker.ts file
      this.worker = new Worker(
        new URL('./grain-worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (error) {
      console.error('Failed to initialize grain worker:', error);
    }
  }

  public async processImage(
    imageData: ImageData,
    settings: GrainSettings,
    onProgress?: (progress: GrainProcessingProgress) => void
  ): Promise<GrainProcessingResult> {
    if (!this.worker) {
      return {
        imageData,
        success: false,
        error: 'Worker not initialized'
      };
    }

    if (this.isProcessing) {
      return {
        imageData,
        success: false,
        error: 'Processing already in progress'
      };
    }

    this.isProcessing = true;

    return new Promise((resolve) => {
      if (!this.worker) {
        resolve({
          imageData,
          success: false,
          error: 'Worker not available'
        });
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        const { type, ...data } = e.data;

        switch (type) {
          case 'progress':
            if (onProgress) {
              onProgress({
                progress: data.progress,
                stage: data.stage
              });
            }
            break;

          case 'result':
            this.worker?.removeEventListener('message', handleMessage);
            this.isProcessing = false;
            resolve({
              imageData: data.imageData,
              success: true
            });
            break;

          case 'error':
            this.worker?.removeEventListener('message', handleMessage);
            this.isProcessing = false;
            resolve({
              imageData,
              success: false,
              error: data.error
            });
            break;
        }
      };

      this.worker.addEventListener('message', handleMessage);
      
      // Send processing request to worker
      this.worker.postMessage({
        type: 'process',
        imageData,
        settings
      });
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isProcessing = false;
  }

  public get isWorkerProcessing(): boolean {
    return this.isProcessing;
  }
}

// Predefined film stock settings
export const FILM_PRESETS: Record<string, GrainSettings> = {
  'kodak-100': {
    iso: 100,
    filmType: 'kodak',
    grainIntensity: 0.8,
    upscaleFactor: 2
  },
  'kodak-400': {
    iso: 400,
    filmType: 'kodak',
    grainIntensity: 1.2,
    upscaleFactor: 2
  },
  'kodak-800': {
    iso: 800,
    filmType: 'kodak',
    grainIntensity: 1.6,
    upscaleFactor: 3
  },
  'kodak-1600': {
    iso: 1600,
    filmType: 'kodak',
    grainIntensity: 2.0,
    upscaleFactor: 3
  },
  'fuji-100': {
    iso: 100,
    filmType: 'fuji',
    grainIntensity: 0.7,
    upscaleFactor: 2
  },
  'fuji-400': {
    iso: 400,
    filmType: 'fuji',
    grainIntensity: 1.1,
    upscaleFactor: 2
  },
  'fuji-800': {
    iso: 800,
    filmType: 'fuji',
    grainIntensity: 1.5,
    upscaleFactor: 3
  },
  'ilford-100': {
    iso: 100,
    filmType: 'ilford',
    grainIntensity: 0.9,
    upscaleFactor: 2
  },
  'ilford-400': {
    iso: 400,
    filmType: 'ilford',
    grainIntensity: 1.3,
    upscaleFactor: 2
  },
  'ilford-800': {
    iso: 800,
    filmType: 'ilford',
    grainIntensity: 1.7,
    upscaleFactor: 3
  }
};
