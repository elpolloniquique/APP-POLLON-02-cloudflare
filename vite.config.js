import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Si el sistema tiene NODE_ENV=production, `vite` (dev) se comporta como prod
// y la app puede quedar en blanco. El build/preview sí deben ser production.
const isViteBuild = process.argv.includes('build');
const isVitePreview = process.argv.includes('preview');
if (!isViteBuild && !isVitePreview && process.env.NODE_ENV === 'production') {
  process.env.NODE_ENV = 'development';
}

/** Evita meter el APK (~200MB) dentro del dist → Capacitor → APK (bucle de tamaño). */
function stripApkFromDist() {
  return {
    name: 'strip-apk-from-dist',
    closeBundle() {
      const apkPath = join(process.cwd(), 'dist', 'DESCARGAR-APK', 'El-Pollon-repartidor.apk');
      if (existsSync(apkPath)) {
        rmSync(apkPath, { force: true });
        console.log('[vite] Excluido APK de dist (no va al Android assets)');
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    stripApkFromDist(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'img/logo.png',
        'favicon.svg',
      ],
      manifest: false,
      workbox: {
        // Handlers push / notificationclick (bandeja del sistema)
        importScripts: ['sw-push.js'],
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,json}', 'icons/*.png'],
        globIgnores: ['**/img/**', '**/sounds/**', '**/DESCARGAR-APK/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/DESCARGAR-APK\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pollon-google-fonts-css',
              expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pollon-google-fonts-files',
              expiration: { maxEntries: 12, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/img\/.+\.(?:png|jpg|jpeg|webp|gif|svg)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pollon-static-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: { port: 5173, open: true },
  build: { outDir: 'dist', sourcemap: false },
  // MapLibre trae workers; el prebundle de Vite a veces rompe el worker en dev
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
});
