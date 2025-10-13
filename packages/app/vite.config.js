import { defineConfig } from 'vite';

const base = process.env.BASE || process.env.VITE_BASE || '/';

export default defineConfig({
  base,
});
