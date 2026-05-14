import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.BASE || process.env.VITE_BASE || '/';

export const manifest = {
  name: 'call-ma',
  short_name: 'call-ma',
  start_url: base,
  display: 'standalone',
  theme_color: '#121212',
  background_color: '#ffffff',
  icons: [
    { src: '/icons/call_ma_icon.webp', sizes: 'any', type: 'image/webp' },
  ],
};

export default defineConfig({
  base,
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
