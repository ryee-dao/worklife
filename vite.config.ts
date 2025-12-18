import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Don't need vite for main process, only renderer
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, './dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: path.resolve(__dirname, 'src/renderer/dashboard/index.html'),
        break: path.resolve(__dirname, 'src/renderer/break/index.html'),
      }
    }
  },

});