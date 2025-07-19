// Performance tracking utilities for grain processing operations
// Provides benchmarking and timing capabilities for optimization analysis

import { assert, assertPositiveNumber } from './utils';

export interface PerformanceBenchmark {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pixelsProcessed?: number;
  pixelsPerSecond?: number;
}

/**
 * Performance tracking utility for measuring operation timing and throughput
 * Used to identify bottlenecks and optimize grain processing performance
 */
export class PerformanceTracker {
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();
  
  /**
   * Start timing a named operation
   * @param operation - Name of the operation being benchmarked
   * @param pixelsProcessed - Optional number of pixels processed for throughput calculation
   */
  startBenchmark(operation: string, pixelsProcessed?: number): void {
    assert(typeof operation === 'string' && operation.length > 0, 'operation must be a non-empty string', { operation });
    if (pixelsProcessed !== undefined) {
      assertPositiveNumber(pixelsProcessed, 'pixelsProcessed');
    }
    
    this.benchmarks.set(operation, {
      operation,
      startTime: performance.now(),
      pixelsProcessed
    });
  }
  
  /**
   * End timing an operation and calculate metrics
   * @param operation - Name of the operation to end
   * @returns The completed benchmark or null if operation wasn't started
   */
  endBenchmark(operation: string): PerformanceBenchmark | null {
    assert(typeof operation === 'string' && operation.length > 0, 'operation must be a non-empty string', { operation });
    
    const benchmark = this.benchmarks.get(operation);
    if (!benchmark) return null;
    
    benchmark.endTime = performance.now();
    benchmark.duration = benchmark.endTime - benchmark.startTime;
    
    if (benchmark.pixelsProcessed) {
      benchmark.pixelsPerSecond = benchmark.pixelsProcessed / (benchmark.duration / 1000);
    }
    
    return benchmark;
  }
  
  /**
   * Get benchmark results for a specific operation
   * @param operation - Name of the operation
   * @returns The benchmark data or null if not found
   */
  getBenchmark(operation: string): PerformanceBenchmark | null {
    return this.benchmarks.get(operation) || null;
  }
  
  /**
   * Get all completed benchmarks
   * @returns Array of all completed benchmark results
   */
  getAllBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values()).filter(b => b.duration !== undefined);
  }
  
  /**
   * Log a summary of all benchmark results to console
   * Useful for development and optimization analysis
   */
  logSummary(): void {
    console.log('\n=== Performance Benchmarks ===');
    for (const benchmark of this.getAllBenchmarks()) {
      console.log(`${benchmark.operation}: ${benchmark.duration?.toFixed(2)}ms`);
      if (benchmark.pixelsPerSecond) {
        console.log(`  - ${(benchmark.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec`);
      }
    }
  }
}
