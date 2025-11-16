import { defineConfig } from 'vite';
import path from 'path';

// Don't need vite for main process, only renderer
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, './dist/renderer'),
    emptyOutDir: true,
  },
});