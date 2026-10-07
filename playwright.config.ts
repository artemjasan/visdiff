import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  projects: [
    { name: 'react', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' } },
    { name: 'vue', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4174' } },
    { name: 'svelte', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' } },
  ],
  webServer: [
    {
      command: 'npm run dev --workspace examples/vite-react -- --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace examples/vite-vue -- --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace examples/vite-svelte -- --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
