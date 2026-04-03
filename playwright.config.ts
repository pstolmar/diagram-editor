import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    // Base URL for page.goto('/') style calls
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    // Start the AEM dev proxy if it's not running
    command: 'aem up',
    // Use your working demo page as the readiness probe
    url: 'http://localhost:3000/demo/experiandemo',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
