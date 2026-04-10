#!/usr/bin/env bash
set -euo pipefail

# demo.sh: run the harness for current PLAN / job.json,
# start dev server if needed, and open the demo page in a browser.

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

DEMO_URL="${DEMO_URL:-http://localhost:3000/demo/experiandemo}"

echo "🛠 Running harness (npm run code)..."
npm run code

echo "🔎 Checking dev server at http://localhost:3000/..."
if ! curl -sf "http://localhost:3000/" >/dev/null 2>&1; then
  echo "🚀 Starting dev server with 'aem up'..."
  aem up >/tmp/aem-up.log 2>&1 &
  SERVER_PID=$!
  echo "   dev server pid: $SERVER_PID"
  echo "⏳ Waiting for dev server to be ready..."
  # Give it up to ~20s to be ready
  for i in {1..20}; do
    if curl -sf "$DEMO_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "✅ Dev server already running."
fi

echo "🌐 Opening demo page: $DEMO_URL"
# macOS 'open', adjust if you use something else
open "$DEMO_URL" || true

echo "✅ demo.sh done. You should see the page in your browser."
echo "   You can now author the components on that page via UE/AEM as usual."

