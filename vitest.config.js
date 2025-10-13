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
  },
  resolve: {
    alias: {
      'virtual:pwa-register': path.resolve(__dirname, 'src/__mocks__/virtual-pwa-register.js'),
    },
  },
});
