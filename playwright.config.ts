import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  projects: [
    { name: 'react', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' } },
  ],
  webServer: {
    command: 'npm run dev --workspace examples/vite-react -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
