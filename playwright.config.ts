import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: { command: 'npx next start -p 3100', url: 'http://localhost:3100/es', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
