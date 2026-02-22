import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
