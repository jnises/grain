/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Explicitly enable DEV mode in tests to ensure devAssert works
    'import.meta.env.DEV': true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    testTimeout: 10000, // 10 second timeout per test (increased for kernel-based sampling overhead)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.{test,spec}.performance.{js,ts}',
      '**/performance-benchmark.test.ts',
      '**/grain-worker-performance.test.ts',
    ],
  },
});
