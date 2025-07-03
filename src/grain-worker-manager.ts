// Utility for managing the grain processing worker

import type {
  GrainSettings,
  GrainProcessingResult,
  GrainProcessingProgress
} from './types';
import { assertImageData, assertObject, assertPositiveNumber, assert } from './utils';

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
      console.log('Grain worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize grain worker:', error);
      // Log detailed error context for debugging
      if (error instanceof Error) {
        console.error('Worker initialization error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
    }
  }

  public async processImage(
    imageData: ImageData,
    settings: GrainSettings,
    onProgress?: (progress: GrainProcessingProgress) => void
  ): Promise<GrainProcessingResult> {
    // Validate input parameters with custom assertions that provide type narrowing
    assertImageData(imageData, 'imageData');
    assertObject(settings, 'settings');
    
    // Validate settings properties
    assertPositiveNumber(settings.iso, 'settings.iso');
    assert(
      ['kodak', 'fuji', 'ilford'].includes(settings.filmType),
      'settings.filmType must be one of: kodak, fuji, ilford',
      { filmType: settings.filmType, validTypes: ['kodak', 'fuji', 'ilford'] }
    );

    // Log processing parameters for debugging
    console.log(`Processing image: ${imageData.width}x${imageData.height}, ISO: ${settings.iso}, filmType: ${settings.filmType}`);

    if (!this.worker) {
      console.error('Worker not initialized - cannot process image');
      return {
        imageData,
        success: false,
        error: 'Worker not initialized'
      };
    }

    if (this.isProcessing) {
      console.warn('Processing already in progress - rejecting new request');
      return {
        imageData,
        success: false,
        error: 'Processing already in progress'
      };
    }

    this.isProcessing = true;

    return new Promise((resolve) => {
      if (!this.worker) {
        console.error('Worker became unavailable during processing setup');
        resolve({
          imageData,
          success: false,
          error: 'Worker not available'
        });
        return;
      }

      const handleMessage = (e: MessageEvent) => {
        const { type, ...data } = e.data;

        // Validate message structure with custom assertion
        assert(
          type && typeof type === 'string',
          'Worker message must have a valid type property',
          { receivedMessage: e.data, type, typeOf: typeof type }
        );

        switch (type) {
          case 'progress':
            if (onProgress) {
              // Validate progress data structure
              if (typeof data.progress === 'number' && typeof data.stage === 'string') {
                onProgress({
                  progress: data.progress,
                  stage: data.stage
                });
              } else {
                console.warn('Invalid progress data received from worker', { data });
              }
            }
            break;

          case 'result':
            this.worker?.removeEventListener('message', handleMessage);
            this.isProcessing = false;
            
            // Validate result data with custom assertion
            assertImageData(data.imageData, 'worker result imageData');
            
            console.log('Image processing completed successfully');
            resolve({
              imageData: data.imageData,
              success: true
            });
            break;

          case 'error':
            this.worker?.removeEventListener('message', handleMessage);
            this.isProcessing = false;
            
            const errorMessage = typeof data.error === 'string' ? data.error : 'Unknown worker error';
            console.error('Worker processing error:', errorMessage);
            resolve({
              imageData,
              success: false,
              error: errorMessage
            });
            break;

          default:
            console.warn('Unknown message type from worker:', type);
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
