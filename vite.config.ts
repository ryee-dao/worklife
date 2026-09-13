import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Only need Vite for renderer process
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
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, 'src/assets'),
    }
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});