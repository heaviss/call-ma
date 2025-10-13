module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vitest/recommended',
  ],
  plugins: ['vitest'],
  overrides: [
    {
      files: ['**/*.{test,spec}.js'],
      env: { 'vitest-globals/env': true },
    },
  ],
  rules: {
    // Prefer clarity; allow unused variables prefixed with _ (often placeholders for interface compliance)
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
  },
};
