#!/usr/bin/env bash
# convert.sh — Convert an AEM Content Fragment to DA Live Structured Content
# and optionally Franklin-preview + publish it to the EDS site.
#
# Usage:
#   ./tools/cf-to-sc/convert.sh <cf-path> [author-url] [da-live-org] [da-live-repo]
#
# Example:
#   ./tools/cf-to-sc/convert.sh /content/dam/ue-demo/fragments/home-hero \
#     https://author-p138879-e1741192.adobeaemcloud.com \
#     pstolmar diagram-editor
#
# Environment:
#   DA_LIVE_TOKEN  — DA Live API token (if unset, falls back to `aio auth:token`)
#
# Steps:
#   1. Fetch CF JSON from AEM Assets REST API
#   2. Parse fields from properties.elements.{field}.value
#   3. Render EDS block-table HTML
#   4. POST HTML to DA Live source API
#   5. Trigger Franklin preview then publish
#   6. Print the live EDS URL

set -euo pipefail

# ── Arguments ────────────────────────────────────────────────────────────────

CF_PATH="${1:-}"
AUTHOR="${2:-https://author-p138879-e1741192.adobeaemcloud.com}"
DA_ORG="${3:-pstolmar}"
DA_REPO="${4:-diagram-editor}"

if [ -z "$CF_PATH" ]; then
  echo "Usage: $0 <cf-path> [author-url] [da-live-org] [da-live-repo]" >&2
  echo "  cf-path  e.g. /content/dam/ue-demo/fragments/home-hero" >&2
  exit 1
fi

AUTHOR="${AUTHOR%/}"

# ── Tokens ───────────────────────────────────────────────────────────────────

# DA Live token: check env var first, then fall back to aio auth token
if [ -n "${DA_LIVE_TOKEN:-}" ]; then
  DA_TOKEN="$DA_LIVE_TOKEN"
  echo "[auth] DA Live token: from \$DA_LIVE_TOKEN env var"
else
  DA_TOKEN="$(aio auth:token 2>/dev/null || true)"
  if [ -z "$DA_TOKEN" ]; then
    echo "Error: no DA Live token. Set DA_LIVE_TOKEN env var or run 'aio login'." >&2
    exit 1
  fi
  echo "[auth] DA Live token: from 'aio auth:token' (fallback)"
fi

# AEM Author token always comes from aio (separate from DA Live in general)
AEM_TOKEN="$(aio auth:token 2>/dev/null || true)"
if [ -z "$AEM_TOKEN" ]; then
  echo "Error: no AEM token. Run 'aio login' first." >&2
  exit 1
fi
echo "[auth] AEM Author token: from 'aio auth:token'"

# ── Step 1: Fetch CF data ─────────────────────────────────────────────────────

echo ""
echo "[1/5] Fetching CF from AEM Assets API …"
echo "      GET $AUTHOR/api/assets$CF_PATH.json"

CF_JSON="$(curl -sf \
  -H "Authorization: Bearer $AEM_TOKEN" \
  "$AUTHOR/api/assets$CF_PATH.json")"

if [ -z "$CF_JSON" ]; then
  echo "Error: empty response — check cf-path and author URL." >&2
  exit 1
fi

# ── Step 2: Parse CF fields ───────────────────────────────────────────────────

echo "[2/5] Parsing CF fields …"

read_field() {
  local field="$1"
  # Fields live at properties.elements.{field}.value
  # description may contain HTML — preserve as-is
  python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
elements = d.get('properties', {}).get('elements', {})
val = elements.get('$field', {}).get('value', '')
if isinstance(val, list):
    val = ' '.join(str(v) for v in val)
print(val if val is not None else '')
" <<< "$CF_JSON"
}

EYEBROW="$(read_field eyebrow)"
TITLE="$(read_field title)"
DESCRIPTION="$(read_field description)"
CTA_LABEL="$(read_field ctaLabel)"
CONTENT_REF="$(read_field contentReference)"

echo "      eyebrow          : ${EYEBROW:-(empty)}"
echo "      title            : ${TITLE:-(empty)}"
_desc_preview="${DESCRIPTION:0:60}"; [ "${#DESCRIPTION}" -gt 60 ] && _desc_preview="${_desc_preview}..."
echo "      description      : ${_desc_preview}"
echo "      ctaLabel         : ${CTA_LABEL:-(empty)}"
echo "      contentReference : ${CONTENT_REF:-(empty)}"

# ── Step 3: Build EDS block-table HTML ───────────────────────────────────────

echo "[3/5] Rendering EDS block-table HTML …"

# Derive DA Live path from CF path:
#   /content/dam/ue-demo/fragments/home-hero  →  ue-demo/fragments/home-hero
DA_PATH="${CF_PATH#/content/dam/}"
echo "      DA Live path: $DA_PATH"

# Build image cell — only if contentReference is set
if [ -n "$CONTENT_REF" ]; then
  IMG_CELL="<img src=\"${CONTENT_REF}\">"
else
  IMG_CELL=""
fi

# Build CTA cell — only if ctaLabel is set
if [ -n "$CTA_LABEL" ]; then
  CTA_HTML="<a href=\"#\">${CTA_LABEL}</a>"
else
  CTA_HTML=""
fi

HTML_DOC="<!DOCTYPE html>
<html lang=\"en\">
<head><meta charset=\"utf-8\"><title>$(basename "$CF_PATH")</title></head>
<body>
<main>
  <div>
    <div>
      <table>
        <tr><th colspan=\"2\">Hero</th></tr>
        <tr>
          <td>${IMG_CELL}</td>
          <td>
            <h2>${TITLE}</h2>
            <p>${EYEBROW}</p>
            ${DESCRIPTION}
            ${CTA_HTML}
          </td>
        </tr>
      </table>
    </div>
  </div>
</main>
</body>
</html>"

echo "      Generated HTML (preview):"
echo "----------------------------------------------------------------------"
echo "$HTML_DOC" | head -30
echo "----------------------------------------------------------------------"

# ── Step 4: POST to DA Live ───────────────────────────────────────────────────

DA_SOURCE_URL="https://admin.da.live/source/${DA_ORG}/${DA_REPO}/${DA_PATH}.html"
echo "[4/5] Posting to DA Live …"
echo "      PUT $DA_SOURCE_URL"

DA_RESPONSE="$(curl -sf -w "\n%{http_code}" \
  -X PUT \
  -H "Authorization: Bearer $DA_TOKEN" \
  -H "Content-Type: text/html; charset=utf-8" \
  --data-binary "$HTML_DOC" \
  "$DA_SOURCE_URL" 2>&1 || true)"

DA_HTTP_CODE="$(echo "$DA_RESPONSE" | tail -1)"
DA_BODY="$(echo "$DA_RESPONSE" | head -n -1)"

if [[ "$DA_HTTP_CODE" =~ ^2 ]]; then
  echo "      DA Live upload: HTTP $DA_HTTP_CODE — OK"
else
  echo "      DA Live upload: HTTP $DA_HTTP_CODE"
  echo "      Response: $DA_BODY"
  echo "Warning: DA Live upload may have failed. Continuing with Franklin steps." >&2
fi

# ── Step 5: Franklin preview + publish ───────────────────────────────────────

HLX_PREVIEW_URL="https://admin.hlx.page/preview/${DA_ORG}/${DA_REPO}/main/${DA_PATH}"
HLX_LIVE_URL="https://admin.hlx.page/live/${DA_ORG}/${DA_REPO}/main/${DA_PATH}"

echo "[5/5] Triggering Franklin preview …"
echo "      POST $HLX_PREVIEW_URL"

PREVIEW_RESP="$(curl -sf -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $AEM_TOKEN" \
  "$HLX_PREVIEW_URL" 2>&1 || true)"

PREVIEW_CODE="$(echo "$PREVIEW_RESP" | tail -1)"
if [[ "$PREVIEW_CODE" =~ ^2 ]]; then
  echo "      Preview: HTTP $PREVIEW_CODE — OK"
else
  echo "      Preview: HTTP $PREVIEW_CODE — check auth / path"
fi

echo "      Triggering Franklin publish (live) …"
echo "      POST $HLX_LIVE_URL"

LIVE_RESP="$(curl -sf -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $AEM_TOKEN" \
  "$HLX_LIVE_URL" 2>&1 || true)"

LIVE_CODE="$(echo "$LIVE_RESP" | tail -1)"
if [[ "$LIVE_CODE" =~ ^2 ]]; then
  echo "      Publish:  HTTP $LIVE_CODE — OK"
else
  echo "      Publish:  HTTP $LIVE_CODE — check auth / path"
fi

# ── Output ────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo " Conversion complete"
echo "───────────────────────────────────────────────────────────────────────"
echo " DA Live source : $DA_SOURCE_URL"
echo " EDS preview    : https://main--${DA_REPO}--${DA_ORG}.hlx.page/${DA_PATH}"
echo " EDS live       : https://main--${DA_REPO}--${DA_ORG}.hlx.live/${DA_PATH}"
echo "═══════════════════════════════════════════════════════════════════════"
