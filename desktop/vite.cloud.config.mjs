import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'cloud-src',
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../cloud-browser',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'cloud-src/index.html'),
        'plan-b': resolve(import.meta.dirname, 'cloud-src/plan-b.html'),
      },
    },
  },
});
