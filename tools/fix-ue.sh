#!/usr/bin/env bash
# Redeploys both UE OSGi configs that enable "Edit in Universal Editor" for CFs.
# Run this any time you see "Failed to fetch details" in UE.
# Safe to run repeatedly — file-level filters, never wipes anything.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMBINED="${SCRIPT_DIR}/cors/ui.config-ue-combined-2.0.zip"
CORS="${SCRIPT_DIR}/cors/ui.config-ue-cors-1.0.zip"
BEARER="${SCRIPT_DIR}/cors/ui.config-ue-bearer-1.0.zip"

echo "🔧 Fixing Universal Editor CORS + Bearer auth on RDE Author..."
echo ""

# Prefer combined package, fall back to the two separate ones
if [[ -f "$COMBINED" ]]; then
  echo "  → Deploying combined package (CORS + Bearer)..."
  aio aem:rde:install "$COMBINED" --target author
else
  echo "  → Deploying CORS policy..."
  aio aem:rde:install "$CORS" --target author
  echo "  → Deploying Bearer auth handler..."
  aio aem:rde:install "$BEARER" --target author
fi

echo ""
echo "✅ Done. Hard-refresh your UE page and try editing again."
echo ""
echo "   If 'Failed to fetch details' persists:"
echo "   1. Confirm the CF exists: open AEM Author Assets, find the fragment, check it's published"
echo "   2. Check data-aue-resource ends in /jcr:content/data/master"
echo "   3. Verify your IMS session: try opening experience.adobe.com in the same browser"
