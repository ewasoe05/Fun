import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Two build targets from the same source:
// - default: GitHub Pages at https://ewasoe05.github.io/Fun/ (absolute /Fun/ base)
// - CAP_BUILD=1 (npm run build:cap): relative base for native wrappers like
//   Capacitor, whose webview serves dist/ from its own root
const capBuild = !!process.env.CAP_BUILD
const base = capBuild ? './' : '/Fun/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-180.png'],
      manifest: {
        name: 'Lift Log',
        short_name: 'LiftLog',
        description: 'Track your weight lifting workouts',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: capBuild ? 'index.html' : '/Fun/index.html',
        runtimeCaching: [
          {
            // wger exercise images: cache-first so the library works offline
            urlPattern: /^https:\/\/wger\.de\/media\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wger-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
    }),
  ],
})
