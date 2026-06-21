import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: import.meta.dirname,
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    lib: { entry: path.resolve(import.meta.dirname, 'renderer.js'), formats: ['es'], fileName: () => 'terminal.js' },
    minify: true,
  },
});
