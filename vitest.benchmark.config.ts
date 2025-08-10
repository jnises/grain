/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: [
      '**/performance-benchmark.test.ts',
      '**/grain-worker-performance.test.ts',
      '**/benchmarks/lightness-sampling-performance.benchmark.ts',
    ],
  },
});
