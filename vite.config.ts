/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Default to node for domain tests. Component tests opt into jsdom with
    // `// @vitest-environment jsdom` at the top of the file.
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Unit tests live under src/. `e2e/` is Playwright (`@playwright/test`) —
    // its `.spec.ts` files must NOT be collected by vitest (T19).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
