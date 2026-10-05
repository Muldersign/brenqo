import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

/** Standalone demo: the whole app as one HTML file (npm run build:demo → demo/dist/index.html). */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: [
      { find: 'next/link', replacement: path.resolve(import.meta.dirname, 'shims/next-link.tsx') },
      { find: 'next/navigation', replacement: path.resolve(import.meta.dirname, 'shims/next-navigation.ts') },
      { find: '@', replacement: path.resolve(import.meta.dirname, '../src') },
    ],
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('demo') },
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 },
});
