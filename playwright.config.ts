import { defineConfig, devices } from '@playwright/test'

// T19 smoke test config. Chromium only, headless. Drives a PRODUCTION build via
// `vite preview` (no dev-server HMR reload mid-flow). `webServer` builds first so
// `npm run test:e2e` is self-contained locally and in CI. Kept out of the vitest
// run (see vite.config.ts `test.include`); wired as a non-blocking CI job.

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
