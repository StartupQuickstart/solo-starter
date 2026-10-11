// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    // Plain Node scripts: no TypeScript types to tell ESLint about Node's globals.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    rules: {
      // Leading-underscore args/vars mark intentionally unused parameters
      // (e.g. Express error handlers that must keep a 4-arg signature).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
