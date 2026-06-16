import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/* When building for GitHub Pages we serve from
   `<user>.github.io/<repo>/`. Override at build time with
   `VITE_BASE=/something/` if your repo path is different. */
const base = process.env.VITE_BASE || '/project-website-/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'kai-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            /* Open-Meteo, CoinGecko, Aladhan, HN: stale-while-revalidate so
               the HUD shows last-known values while offline. */
            urlPattern: /^https:\/\/(api\.open-meteo\.com|api\.coingecko\.com|api\.aladhan\.com|hacker-news\.firebaseio\.com)\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'kai-data', expiration: { maxAgeSeconds: 60 * 30 } },
          },
        ],
      },
      manifest: {
        id: '/project-website-/',
        name: 'KAI · Command Core',
        short_name: 'KAI',
        description: 'A dark, voice-enabled personal command core.',
        theme_color: '#0A0E14',
        background_color: '#0A0E14',
        display: 'standalone',
        orientation: 'any',
        scope: base,
        start_url: base,
        icons: [
          { src: 'icon.svg',          sizes: 'any',    type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any',    type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
});
