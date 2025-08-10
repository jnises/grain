// Simple performance test runner
// Run this file to benchmark the grain processing optimization

import { runPerformanceBenchmarks } from './performance-benchmark.test';

console.log('🧪 Running Grain Processing Performance Tests...\n');

runPerformanceBenchmarks()
  .then(() => {
    console.log('\n✅ Performance benchmarks completed successfully!');
  })
  .catch((error: Error) => {
    console.error('\n❌ Error running performance benchmarks:', error);
    throw error;
  });
