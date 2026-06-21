import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'cloud-src',
  base: '/cloud-browser/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../cloud-browser',
    emptyOutDir: true,
  },
});
