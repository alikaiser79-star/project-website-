import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/* Default base is "/" — the Vercel deployment serves at the root.
   Override with `VITE_BASE=/foo/` at build time for other hosts. */
const base = process.env.VITE_BASE || '/';

/* Build identity — short SHA on Vercel, "dev" locally. Used as
   BOTH the footer version string (so the user can tell builds
   apart) AND as the Workbox `cacheId`, which becomes part of every
   precache name. New deploy → new id → old caches drop. */
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7);

export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg'],
      workbox: {
        /* cacheId is prefixed onto every Workbox cache name. Bumping
           it per build means the old precache is no longer owned by
           the new SW and gets cleaned up on activation. */
        cacheId: 'kai-' + BUILD_ID,
        /* Take over from any previously-installed SW IMMEDIATELY.
           The client-side reload-on-activation in main.tsx swaps
           the page once the new SW is in control. */
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        /* §14.2 — the SW imports the Web Push handler (push +
           notificationclick). Kept as a separate plain-JS script so the
           generated SW's precache/offline/update behaviour is untouched. */
        importScripts: ['push-sw.js'],
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
        id: '/',
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
        /* OS share-sheet target (§8.3) — iOS / Android can throw a URL
           or text into KAI. GET to '/' with the payload as query params:
           no serverless endpoint needed (staying within the function
           cap), the app reads location.search on launch and opens the
           Share Capture sheet (Brain Dump · deadline · MARKET EYE). */
        share_target: {
          action: base,
          method: 'GET',
          params: {
            title: 'title',
            text:  'text',
            url:   'url',
          },
        },
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/three|@react-three|postprocessing|meshline/.test(id)) return 'three';
          if (/recharts|d3-/.test(id)) return 'charts';
          if (/framer-motion/.test(id)) return 'motion';
          if (/gsap/.test(id)) return 'gsap';
          if (/howler/.test(id)) return 'audio';
          if (/lucide-react/.test(id)) return 'icons';
          if (/react-dom|^react$|react\//.test(id)) return 'react';
        },
      },
    },
  },
  server: { port: 5173, host: true },
});
