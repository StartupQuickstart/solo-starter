/**
 * Vitest configuration for @app/api: unit tests only.
 *
 *   pnpm test        → unit tests (this config)
 *   pnpm test:int    → integration tests (vitest.int.config.ts, needs
 *                      DATABASE_URL_TEST + docker compose up)
 *   pnpm test:all    → both, sequentially
 *
 * @see vitest.int.config.ts (the integration-only config)
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app/backend': path.resolve(__dirname, '../../packages/backend/dist/cjs/index.js'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    // Default run: unit tests only (src/**/*.test.ts, excluding integration)
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts', 'tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.int.test.ts',
        'src/**/*.schemas.ts',
        'src/index.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
