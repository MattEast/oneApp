import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  webServer: {
    command: 'npm --workspace @oneapp/web run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000
  },
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry'
  }
});
