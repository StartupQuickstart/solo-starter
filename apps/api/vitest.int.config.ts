/**
 * Vitest configuration for integration tests only.
 *
 * Used by `pnpm test:int` and `pnpm test:all`.
 *
 * Requires:
 *   - Postgres running: `pnpm db:up` (apps/api/docker-compose.yml)
 *   - DATABASE_URL_TEST pointing at the test database, with migrations applied
 *
 * Tests that need the database use `describe.skipIf(!DATABASE_URL_TEST)`, so
 * without the variable they are skipped, not failed. CI sets it
 * (.github/workflows/ci.yml); check the skipped count when running locally.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app/backend': path.resolve(__dirname, '../../packages/backend/dist/cjs/index.js'),
      // The integration tests import the generated Prisma client via a relative path.
      // The generated client lives at apps/api/generated/prisma: add an explicit alias
      // so Vite/Vitest can find it regardless of the test file's location.
      '../../src/generated/prisma': path.resolve(__dirname, './generated/prisma'),
      '../../../src/generated/prisma': path.resolve(__dirname, './generated/prisma'),
      '../../../generated/prisma': path.resolve(__dirname, './generated/prisma'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // One file at a time, in one worker: the suites share a database.
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      // Billing stays disabled in tests no matter what the shell exports.
      STRIPE_SECRET_KEY: '',
    },
  },
});
