import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production build configuration for profiling
// This ensures devAssert calls are eliminated completely
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['./src/grain-worker.ts'],
  },
  mode: 'production',
  build: {
    minify: false, // Keep code readable for profiling
    sourcemap: true, // Enable sourcemaps for better profiling
    rollupOptions: {
      output: {
        manualChunks: undefined, // Keep everything in one bundle for easier profiling
      },
    },
  },
  define: {
    'import.meta.env.DEV': false, // Explicitly set to false
    'import.meta.env.PROD': true,
  },
});
