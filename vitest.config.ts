/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    testTimeout: 5000, // 5 second timeout per test
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.{test,spec}.performance.{js,ts}',
      '**/performance-benchmark.test.ts',
      '**/grain-worker-performance.test.ts'
    ],
  },
})
