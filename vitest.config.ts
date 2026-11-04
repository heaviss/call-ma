import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/__tests__/**', 'src/__mocks__/**', 'src/**/*.d.ts', 'src/main.ts'],
      thresholds: {
        lines:      100,
        branches:    88,
        functions:   98,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      'virtual:pwa-register': path.resolve(__dirname, 'src/__mocks__/virtual-pwa-register.ts'),
    },
  },
});
