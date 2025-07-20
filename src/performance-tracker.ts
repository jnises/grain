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

  /**
   * Log a summary of iterative development benchmarks
   * Groups iteration-specific benchmarks for easier analysis
   */
  logIterationSummary(): void {
    const allBenchmarks = this.getAllBenchmarks();
    const iterationBenchmarks = allBenchmarks.filter(b => b.operation.includes('Iteration'));
    const totalDevelopment = allBenchmarks.find(b => b.operation === 'Iterative Development');
    
    if (iterationBenchmarks.length === 0) {
      return;
    }
    
    console.log('\n=== Iterative Development Performance ===');
    
    if (totalDevelopment?.duration) {
      console.log(`Total Development Time: ${totalDevelopment.duration.toFixed(2)}ms`);
    }
    
    // Group by iteration number
    const iterationGroups = new Map<number, PerformanceBenchmark[]>();
    
    for (const benchmark of iterationBenchmarks) {
      const match = benchmark.operation.match(/Iteration (\d+)/);
      if (match) {
        const iterNum = parseInt(match[1]);
        if (!iterationGroups.has(iterNum)) {
          iterationGroups.set(iterNum, []);
        }
        iterationGroups.get(iterNum)!.push(benchmark);
      }
    }
    
    // Log each iteration's breakdown
    for (const [iterNum, benchmarks] of Array.from(iterationGroups.entries()).sort(([a], [b]) => a - b)) {
      const iterationTotal = benchmarks.find(b => b.operation === `Development Iteration ${iterNum}`);
      console.log(`\nIteration ${iterNum}:`);
      
      if (iterationTotal?.duration) {
        console.log(`  Total: ${iterationTotal.duration.toFixed(2)}ms`);
      }
      
      for (const benchmark of benchmarks) {
        if (benchmark === iterationTotal) continue;
        console.log(`  ${benchmark.operation.replace(`Iteration ${iterNum} - `, '')}: ${benchmark.duration?.toFixed(2)}ms`);
        if (benchmark.pixelsPerSecond) {
          console.log(`    - ${(benchmark.pixelsPerSecond / 1000000).toFixed(2)}M pixels/sec`);
        }
      }
    }
  }
}
