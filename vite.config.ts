import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

// Don't need vite for main process, only renderer
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, './dist/renderer'),
    emptyOutDir: true,
  },
});