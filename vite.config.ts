import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Installable and offline. Without skipWaiting, a new version takes over once every window
    // of the app is closed: never a reload mid-game. Icons come from scripts/icons.mjs.
    VitePWA({
      injectRegister: 'script-defer',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'nona',
        short_name: 'nona',
        description: 'Sudoku with hints that show you how to solve it, not just the answer.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#121413',
        background_color: '#121413',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,wasm}'] },
    }),
  ],
  // Declared up front so the browser tests don't reload mid-run when Vite finds them.
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react', 'idb', 'zod'] },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.test.ts'], exclude: ['src/**/*.browser.test.*'], environment: 'node' } },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: 'firefox' }] },
        },
      },
    ],
  },
})
