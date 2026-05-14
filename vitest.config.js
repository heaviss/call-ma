import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.js'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.{test,spec}.js', 'src/__mocks__/**', 'src/main.js'],
      thresholds: {
        lines:      70,
        branches:   60,
        functions:  60,
        statements: 73,
      },
    },
  },
  resolve: {
    alias: {
      'virtual:pwa-register': path.resolve(__dirname, 'src/__mocks__/virtual-pwa-register.js'),
    },
  },
});
