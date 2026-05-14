import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const base = process.env.BASE || process.env.VITE_BASE || '/';

export const manifest = {
  name: 'call-ma',
  short_name: 'call-ma',
  start_url: '/',
  display: 'standalone',
  theme_color: '#121212',
  background_color: '#ffffff',
  icons: [
    { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
    { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
  ],
};

export default defineConfig({
  base,
  resolve: {
    alias: {
      events: require.resolve('events'),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest,
      workbox: {
        navigateFallback: '/offline.html',
      },
      includeAssets: ['offline.html'],
    }),
  ],
});
