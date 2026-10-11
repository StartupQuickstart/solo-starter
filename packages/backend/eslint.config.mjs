// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `declare global { namespace Express { ... } }` is how Express request
      // types are augmented; real namespaces stay forbidden.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      // Known debt: this package predates the no-`any` rule the apps follow.
      // The uses are reported as warnings so they stay visible without
      // blocking CI. Replace them with real types before raising this to error.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Tests build partial doubles of Express and Prisma objects.
    files: ['src/**/*.test.ts', 'src/testing/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
);
