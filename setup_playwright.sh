#!/usr/bin/env bash
set -euo pipefail

echo "📦 Ensuring Playwright devDependencies..."
npm install -D @playwright/test playwright >/dev/null 2>&1 || true

# Create minimal playwright.config.ts if missing
if [ ! -f "playwright.config.ts" ]; then
  cat > playwright.config.ts << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  // If your repo has a dev server script (e.g. "aem up" or "npm run start"),
  // you can uncomment and customize this:
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  // },
});
EOF
  echo "✅ Created playwright.config.ts"
else
  echo "ℹ️ playwright.config.ts already exists, leaving it alone."
fi

# Create a very simple smoke test if none exist
mkdir -p tests
if ! ls tests/*.spec.* >/dev/null 2>&1; then
  cat > tests/smoke.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/diagram|editor|edge|aem/i);
});
EOF
  echo "✅ Created tests/smoke.spec.ts"
else
  echo "ℹ️ tests/*.spec.* already exist, not creating smoke test."
fi

echo "✅ Playwright setup complete. Try: npx playwright test"
