#!/usr/bin/env npx tsx
/**
 * Simple profiler using Node.js --prof flag
 * 
 * This script runs grain processing with V8 profiling enabled to identify hotspots.
 * The --prof flag generates a v8.log file that can be processed to show function-level performance.
 * 
 * Usage:
 *   node --prof -r tsx/esm scripts/profiling/simple_profiler.ts
 */

// Set production mode to ensure devAssert calls are eliminated
process.env.NODE_ENV = 'production';

// Import using TypeScript
import { GrainProcessor } from '../../src/grain-processor';
import { createMockImageData } from '../../test/test-utils';

// Test configuration that should reveal hotspots
const TEST_CONFIG = {
  width: 400,
  height: 300,
  settings: { iso: 800, filmType: 'kodak' as const }
};

async function runProfilingTest() {
  console.log('🔍 Running grain processing performance test...');
  console.log(`Configuration: ${TEST_CONFIG.width}x${TEST_CONFIG.height}, ISO ${TEST_CONFIG.settings.iso}`);
  
  const testImage = createMockImageData(TEST_CONFIG.width, TEST_CONFIG.height, 128);
  const processor = new GrainProcessor(TEST_CONFIG.width, TEST_CONFIG.height, TEST_CONFIG.settings);
  
  const startTime = performance.now();
  
  // Run multiple iterations to get better profiling data
  const iterations = 5;
  console.log(`Running ${iterations} iterations for better profiling data...`);
  
  for (let i = 0; i < iterations; i++) {
    console.log(`Iteration ${i + 1}/${iterations}...`);
    await processor.processImage(testImage);
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;
  
  console.log(`✅ Completed ${iterations} iterations in ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per iteration: ${avgTime.toFixed(2)}ms`);
  console.log('');
  console.log('🔥 To analyze the profiling results:');
  console.log('1. Find the generated isolate-*.log file in the current directory');
  console.log('2. Process it with: node --prof-process isolate-*.log > profile.txt');
  console.log('3. Look for the "Bottom up (heavy) profile" section in profile.txt');
  console.log('4. Functions with high "self" percentages are the hotspots to optimize');
}

async function main() {
  console.log('🔍 Running grain processing performance test (PRODUCTION MODE)...');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  
  if (!process.execArgv.some(arg => arg.includes('--prof'))) {
    console.log('ℹ️  Note: For V8 profiling, run with --prof flag:');
    console.log('  node --prof --loader tsx/esm scripts/profiling/simple_profiler.ts');
    console.log('Continuing with timing-only profiling...\n');
  }
  
  try {
    await runProfilingTest();
  } catch (error) {
    console.error('❌ Error during profiling test:', error);
    throw error;
  }
}

main().catch(console.error);
