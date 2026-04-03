#!/usr/bin/env bash
set -euo pipefail

# Fix Playwright tests to hit /demo/experiandemo instead of /
# and set up a sane playwright.config.ts with aem up.

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo "🔧 Ensuring playwright.config.ts points at localhost:3000 and starts aem up..."

cat > playwright.config.ts << 'EOF'
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
EOF

echo "🔧 Patching Playwright specs to use /demo/experiandemo..."

node << 'EOF'
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, 'tests');

if (!fs.existsSync(TESTS_DIR)) {
  console.log('No tests/ directory; nothing to patch.');
  process.exit(0);
}

function listSpecs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const specs = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      specs.push(...listSpecs(full));
    } else if (e.isFile() && e.name.endsWith('.spec.ts')) {
      specs.push(full);
    }
  }
  return specs;
}

const specs = listSpecs(TESTS_DIR);
if (!specs.length) {
  console.log('No *.spec.ts files found under tests/.');
  process.exit(0);
}

for (const file of specs) {
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  // Replace page.goto('/') and page.goto("/") with the demo page
  src = src.replace(/page\.goto\(['"]\/['"]\)/g, "page.goto('/demo/experiandemo')");
  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8');
    console.log(`Patched page.goto('/') in ${path.relative(ROOT, file)}`);
  }
}

console.log('Done patching Playwright specs.');
EOF

echo "✅ Playwright config and specs updated. Next steps:"
echo "   1) npx playwright install"
echo "   2) npx playwright test"

