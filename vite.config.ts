import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline-first app shell: the service worker precaches the built
    // assets so the app itself loads with no connection; Firestore's own
    // persistent cache (src/lib/firebase.ts) handles the data. Firebase
    // API traffic is never intercepted — the SDK manages its own offline
    // queue and letting a service worker cache it would corrupt sync.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'COOU Digital Student ID',
        short_name: 'COOU ID',
        description:
          'Digital student identity cards for Chukwuemeka Odumegwu Ojukwu University',
        theme_color: '#006837',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          {src: '/icons/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any'},
          {src: '/icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any'},
          {src: '/icons/icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable'},
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      // The emulator-based dev workflow runs without the service worker;
      // offline behavior in dev comes from Firestore persistence alone.
      devOptions: {enabled: false},
    }),
  ],
  // Keep the terminal history visible (the dev menu in scripts/dev-menu.mjs
  // owns the terminal UX; Vite must not wipe it on start/restart).
  clearScreen: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
