// Web Worker for Film Grain Processing
// Handles message passing and worker-specific functionality

import { GrainProcessor } from './grain-processor';
import type {
  ProcessMessage,
  ProgressMessage,
  ResultMessage,
  ErrorMessage
} from './types';
import { 
  assertObject, 
  assertImageData, 
  assert
} from './utils';

// Export GrainProcessor for compatibility with existing imports
export { GrainProcessor } from './grain-processor';

// Helper function to handle postMessage in both browser and Node.js environments
function safePostMessage(message: ProgressMessage | ResultMessage | ErrorMessage): void {
  if (typeof postMessage !== 'undefined' && typeof postMessage === 'function') {
    try {
      postMessage(message);
    } catch {
      // Silently ignore postMessage errors in test environment
      console.debug('PostMessage skipped in test environment:', message);
    }
  }
}

// Custom GrainProcessor class that overrides reportProgress for worker communication
class WorkerGrainProcessor extends GrainProcessor {
  protected reportProgress(progress: number, stage: string): void {
    safePostMessage({
      type: 'progress',
      progress,
      stage
    } as ProgressMessage);
  }
}

// Worker message handler
self.onmessage = async function(e: MessageEvent<ProcessMessage>) {
  try {
    // Validate message structure with custom assertion
    assertObject(e.data, 'worker message data');

    const { type, imageData, settings } = e.data;
    
    // Validate message type
    assert(
      type === 'process',
      'Invalid message type received by worker',
      { receivedType: type, expectedType: 'process' }
    );

    // Validate imageData using custom assertion that provides type narrowing
    assertImageData(imageData, 'imageData');

    console.log(`Worker processing ${imageData.width}x${imageData.height} image with settings:`, settings);

    // Create processor with worker progress reporting
    const processor = new WorkerGrainProcessor(imageData.width, imageData.height, settings);
    
    // Process image - the processor will call reportProgress internally
    const result = await processor.processImage(imageData);

    // Send result back to main thread
    safePostMessage({
      type: 'result',
      imageData: result
    } as ResultMessage);

  } catch (error: unknown) {
    // Handle errors and send error message back to main thread
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Worker error:', errorMessage, errorStack);
    
    safePostMessage({
      type: 'error',
      error: errorMessage
    } as ErrorMessage);
  }
};
