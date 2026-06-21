import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: 'assistant-dist',
    cssCodeSplit: false,
    rollupOptions: { output: { assetFileNames: (asset) => asset.name?.endsWith('.css') ? 'assistant.css' : 'assets/[name]-[hash][extname]' } },
    lib: { entry: resolve(import.meta.dirname, 'assistant-src/main.jsx'), name: 'LunixAssistantBundle', formats: ['iife'], fileName: () => 'assistant.js' },
  },
});
