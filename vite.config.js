import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  // Keep compatibility with the public Supabase variables already configured
  // in Vercel by the previous Next.js version. Only explicitly public prefixes
  // are exposed to browser code.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.js',
      injectRegister: null,
      injectManifest: {
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
