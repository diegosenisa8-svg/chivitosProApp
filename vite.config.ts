import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.CHIVITOS_API_PROXY || 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Evita 500 del back cuando CORS_ORIGIN no incluye localhost
            proxyReq.removeHeader('origin')
          })
        },
      },
      '/health': {
        target: process.env.CHIVITOS_API_PROXY || 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: true,
      },
      '/uploads': {
        target: process.env.CHIVITOS_API_PROXY || 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'hero.png', 'favicon.svg'],
      manifest: {
        name: 'ChivitosPro',
        short_name: 'ChivitosPro',
        description: 'Pedí online en ChivitosPro - Salto',
        theme_color: '#E85D04',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/nucleocheckprod\.blob\.core\.windows\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
