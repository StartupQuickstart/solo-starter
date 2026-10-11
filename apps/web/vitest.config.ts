import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// Resolve the single React installation used by this workspace app.
// Without this alias, @app/ui and the test runner can end up with two
// separate React instances, which causes "Invalid hook call / Cannot read properties of null (reading
// 'useContext')" errors in any test that renders components from @app/ui.
const reactPath = resolve(__dirname, 'node_modules/react');
const reactDomPath = resolve(__dirname, 'node_modules/react-dom');

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Force a single React instance across all packages in tests
      react: reactPath,
      'react-dom': reactDomPath,
      'react/jsx-runtime': resolve(reactPath, 'jsx-runtime'),
      'react/jsx-dev-runtime': resolve(reactPath, 'jsx-dev-runtime'),
    },
  },
});
