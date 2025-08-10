import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' && process.env.GITHUB_PAGES ? '/grain/' : '/',
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['./src/grain-worker.ts'],
  },
}));
