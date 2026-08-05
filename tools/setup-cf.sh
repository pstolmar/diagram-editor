#!/usr/bin/env bash
# setup-cf.sh — Creates the home-hero Content Fragment in AEM for the Angular + UE demo.
# Useful when the vault package fails due to a different cq:model path on your instance.
#
# Usage:  ./tools/setup-cf.sh <author-url> [bearer-token]
# If no token is passed, tries `aio auth:token`.
#
# Example:
#   ./tools/setup-cf.sh https://author-p138879-e1741192.adobeaemcloud.com
#   ./tools/setup-cf.sh https://author-p138879-e1741192.adobeaemcloud.com "eyJ..."

set -euo pipefail

AUTHOR="${1%/}"
TOKEN="${2:-$(aio auth:token 2>/dev/null || true)}"

if [ -z "$TOKEN" ]; then
  echo "Error: no bearer token. Pass as 2nd arg or run 'aio login' first." >&2
  exit 1
fi

H="Authorization: Bearer $TOKEN"
CF_PATH="/content/dam/ue-demo/fragments/home-hero"
PARENT="/content/dam/ue-demo/fragments"

echo "Author : $AUTHOR"
echo "CF path: $CF_PATH"

# Auto-detect model path from any existing sibling fragment
MODEL=""
for candidate in offers-home-hero angular-hero home-hero-orig; do
  RESP=$(curl -sf -H "$H" "$AUTHOR/api/assets/ue-demo/fragments/${candidate}.json" 2>/dev/null || true)
  if [ -n "$RESP" ]; then
    MODEL=$(echo "$RESP" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('cq:model',''))" \
      2>/dev/null || true)
    if [ -n "$MODEL" ]; then
      echo "Model  : $MODEL  (detected from $candidate)"
      break
    fi
  fi
done

if [ -z "$MODEL" ]; then
  MODEL="/conf/glass-facades/settings/dam/cfm/models/home-hero"
  echo "Model  : $MODEL  (default — edit if your conf path differs)"
fi

# Ensure parent folder exists (ignore errors if it already does)
curl -sf -H "$H" -X POST "$AUTHOR$PARENT" \
  -F "jcr:primaryType=sling:Folder" \
  -F "_charset_=utf-8" > /dev/null 2>&1 || true

# dam:Asset root node
curl -sf -H "$H" -X POST "$AUTHOR$CF_PATH" \
  -F "jcr:primaryType=dam:Asset" \
  -F "_charset_=utf-8" > /dev/null

# jcr:content — marks this as a Content Fragment
curl -sf -H "$H" -X POST "$AUTHOR$CF_PATH/jcr:content" \
  -F "jcr:primaryType=dam:AssetContent" \
  -F "contentFragment={Boolean}true" \
  -F "cq:model=$MODEL" \
  -F "jcr:title=Home Hero" \
  -F "_charset_=utf-8" > /dev/null

# metadata
curl -sf -H "$H" -X POST "$AUTHOR$CF_PATH/jcr:content/metadata" \
  -F "jcr:primaryType=nt:unstructured" \
  -F "dc:title=Home Hero" \
  -F "_charset_=utf-8" > /dev/null

# data container
curl -sf -H "$H" -X POST "$AUTHOR$CF_PATH/jcr:content/data" \
  -F "jcr:primaryType=nt:unstructured" \
  -F "_charset_=utf-8" > /dev/null

# master variation — field values
curl -f -H "$H" -X POST "$AUTHOR$CF_PATH/jcr:content/data/master" \
  -F "jcr:primaryType=nt:unstructured" \
  -F "_charset_=utf-8" \
  -F "eyebrow=Universal Editor SPA Demo" \
  -F "title=Editable content from a remote app" \
  -F "description=<p>This static SPA renders Universal Editor annotations so authors can select and edit fields in context.</p>" \
  -F "ctaLabel=Launch Fast" \
  -F "contentReference=/content/dam/Archive/ccwcustomersuccessarchitects/add-metadata-sample/rocket10.jpeg"

echo ""
echo "Done. Open in AEM Author:"
echo "  $AUTHOR/assets.html$PARENT"
echo "Right-click 'Home Hero' → Quick Publish to replicate to Publish."
