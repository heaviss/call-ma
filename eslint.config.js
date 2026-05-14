import js from '@eslint/js';
import vitest from 'eslint-plugin-vitest';
import globals from 'globals';

export default [
  { ignores: ['node_modules', 'coverage', 'dist'] },
  js.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/**/*.{test,spec}.js'],
    plugins: { vitest },
    rules: { ...vitest.configs.recommended.rules },
    languageOptions: {
      globals: { ...vitest.environments.env.globals },
    },
  },
];
