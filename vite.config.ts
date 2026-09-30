import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  base: './',
  plugins: [react()],
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
