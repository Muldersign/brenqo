import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'src/test/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    // End-to-end tests need the local Supabase stand-in: npm run test:e2e
    include: process.env.E2E ? ['src/**/*.e2e.test.ts'] : ['src/**/*.test.ts'],
    exclude: process.env.E2E ? [] : ['src/**/*.e2e.test.ts', 'node_modules/**'],
    testTimeout: 30_000,
  },
});
