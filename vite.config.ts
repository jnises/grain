import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];

  return {
    plugins: [react()],
    base:
      mode === 'production' && process.env.GITHUB_PAGES && repoName
        ? `/${repoName}/`
        : '/',
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      exclude: ['./src/grain-worker.ts'],
    },
  };
});
