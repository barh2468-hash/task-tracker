import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.js',
      injectRegister: null,
      injectManifest: {
        injectionPoint: undefined,
        rollupFormat: 'iife',
      },
      manifest: {
        id: '/',
        name: 'MAYA – מערכת איתור תשתיות',
        short_name: 'MAYA',
        description: 'ניהול פרויקטים, משימות, יומני עבודה ועדכוני שטח',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#eef5fb',
        theme_color: '#0b2348',
        lang: 'he',
        dir: 'rtl',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
