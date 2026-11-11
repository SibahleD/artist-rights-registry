import { defineConfig, devices } from '@playwright/test'

// Start the API first (see pw_tests/README.md); this config starts the web app itself.
export default defineConfig({
  testDir: './pw_tests',
  fullyParallel: false,          // the journey tests share state, so they run in order
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'on',            // a screenshot after every test, usable as chapter evidence
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173/app/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
