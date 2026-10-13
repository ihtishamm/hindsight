import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react()],
  // The opening book is lazy-loaded on first review.
  build: { chunkSizeWarningLimit: 800 },
});
