# ORB — AEM Feature Toggles Sidekick Plugin

_A portable, demo-agnostic overlay system for previewing AEM integrations on any page._

---

## What It Is

The ORB is a floating button that opens a toggles panel, letting presenters (or curious authors) layer visual previews of AEM integrations onto any live page — without those integrations actually being connected. Toggle Analytics on: engagement counts appear on every content card. Toggle Firefly on: "Generate Variation" buttons appear on every image. Toggle everything off: the page looks exactly like it does in production.

Originally built as a page-specific script for a Walmart media library demo (`wm-media-library.js` + `wm-extras.js` in `eds-agents-demo`). This document specs it as a **portable Sidekick plugin** that works on any AEM EDS site, configurable per deployment.

---

## Why Sidekick (not a Chrome Extension or Bookmarklet)

| Approach | Pros | Cons |
|---|---|---|
| **Sidekick plugin** ← recommended | Ships with the site, always available in author/preview, no install required for audience, works in screen share | Only active in Sidekick context |
| Chrome extension | Works on any URL | Requires install, doesn't show in screen share for remote audiences, App Store friction |
| Bookmarklet | Zero install | Fragile, ugly activation, lost across sessions |
| Per-page script | Works today (Walmart) | Requires code per site, not portable |

Sidekick plugins load as a toolbar button in the AEM Sidekick. When activated, they can inject arbitrary JS/CSS into the current page view. That's exactly the ORB's model. The audience just sees the page — they don't need to know about Sidekick.

---

## Architecture

```
sidekick-plugin/
├── plugin.json          # Sidekick plugin manifest
├── orb.js               # Core: ORB button + panel, feature loader
├── orb.css              # Floating button, panel, feature overlay base styles
├── features/
│   ├── analytics.js     # In-card engagement metrics overlay
│   ├── workfront.js     # Review status + approval panel
│   ├── firefly.js       # Generative fill buttons on images
│   ├── forms.js         # Asset request / intake form overlay
│   ├── ab-test.js       # Experiment variant switcher
│   ├── content-hub.js   # Asset discovery panel
│   ├── ai-search.js     # Semantic search bar + color/tag filters
│   └── smart-crop.js    # Rendition switcher overlay on images
└── orb.config.json      # Per-site feature definitions (optional override)
```

### Activation flow

1. Author opens page in AEM Sidekick (preview or live mode)
2. Clicks the ORB button in the Sidekick toolbar
3. ORB injects `orb.js` + `orb.css` into the current page
4. ORB reads `orb.config.json` from the site root (falls back to universal defaults)
5. Floating ORB button + panel appear in bottom-right corner
6. Each feature toggle dynamically imports its `features/*.js` module on activation
7. Feature modules inject overlays onto matching DOM elements using CSS selectors from config

---

## Feature Config Schema

`orb.config.json` at the site root lets each deployment customize feature labels, descriptions, target selectors, and which features are enabled. If the file is absent, the plugin falls back to universal defaults.

```json
{
  "title": "AEM Feature Toggles",
  "subtitle": "Select features to preview",
  "features": [
    {
      "key": "analytics",
      "label": "Asset Engagement Insights",
      "desc": "In-thumbnail engagement metrics",
      "enabled": true,
      "cardSelector": ".cards > ul > li, .cards-media > ul > li"
    },
    {
      "key": "workfront",
      "label": "Campaign Review & Approval",
      "desc": "Workfront review status panel",
      "enabled": true,
      "cardSelector": ".cards > ul > li"
    },
    {
      "key": "firefly",
      "label": "Generative Image Variants",
      "desc": "Firefly generative fill on images",
      "enabled": true,
      "imageSelector": "picture img"
    },
    {
      "key": "forms",
      "label": "Asset Request & Intake",
      "desc": "AEM Forms intake overlay",
      "enabled": true
    },
    {
      "key": "ab",
      "label": "Experience Experiment",
      "desc": "A/B test variant configurator",
      "enabled": true
    },
    {
      "key": "ai-search",
      "label": "AI Asset Discovery",
      "desc": "Semantic search, color & tag filters",
      "enabled": true
    },
    {
      "key": "smart-crop",
      "label": "Smart Renditions",
      "desc": "Dynamic Media rendition switcher",
      "enabled": true,
      "imageSelector": "picture img"
    },
    {
      "key": "content-hub",
      "label": "Content Hub",
      "desc": "Unified asset discovery panel",
      "enabled": false
    }
  ]
}
```

---

## How Each Feature Overlay Works

Each feature module exports a single `activate(config)` / `deactivate()` pair. The core `orb.js` calls these when toggles change. Modules never modify persistent DOM — they inject overlays into a scoped `orb-layer` div and clean up completely on deactivate.

### Analytics
Finds all matching card elements. Injects a small badge at the bottom of each card thumbnail:
- View count (randomized per card, seeded from card index so it's stable per session)
- Engagement rate (%)
- A subtle sparkline using SVG `<polyline>` — no canvas, no library
- Author-mode only styling: semi-transparent dark pill, collapses on hover

### Workfront
Injects a status badge (color-coded: `NEW`, `IN REVIEW`, `APPROVED`, `EXPIRING SOON`) on each card.  
On badge click: a slide-in panel showing a mock approval thread — reviewer name, comment, timestamp, action buttons (Approve / Request Changes). Panel is pure DOM, no iframe.

### Firefly
Adds a "Generate Variation" button overlay on every matched image on hover.  
On click: a modal showing 4 placeholder variant thumbnails with a prompt field and "Generate" button. Gives the sense of the workflow without calling any API.

### AEM Forms
Adds a "Request Asset" link to each card body.  
On click: a drawer slides in from the right with a mock intake form — Asset Name (pre-filled), Usage Type (dropdown), Campaign Name, Requested By, Due Date. Submit button shows a toast confirmation.

### A/B Test
Injects a "Variant: A" badge in the page header area with a toggle to switch to "Variant: B."  
Switching variant randomly shifts one prominent element (hero headline, hero image, or CTA color) to demonstrate the concept.

### AI Search
Replaces or augments the existing search bar with color swatch filters + smart tag pills above the results. If no search bar exists on the page, injects one below the `<h1>`.

### Smart Renditions
On each matched image: injects a small rendition switcher pill on hover — options: `Original`, `Smart Crop`, `Monochrome`, `Web Optimized`. Switching applies CSS filters locally (no API call). Smart Crop applies a `object-fit: cover` zoom simulation.

### Content Hub
Adds a "Browse in Content Hub" button to the page. On click: opens a mock Content Hub panel (sidebar) showing a grid of related assets with filter facets. Pure DOM mock.

---

## Portability Design

The ORB is designed to be customer-agnostic:

- **No hardcoded selectors** — all card/image selectors come from `orb.config.json`
- **No hardcoded copy** — all labels and descriptions come from config
- **No hardcoded colors** — the ORB UI reads `--color-brand` and `--color-accent` from the host page's CSS variables, falls back to neutral dark blue
- **No dependencies** — zero npm packages, zero CDN imports, pure browser JS + CSS
- **Non-destructive** — all overlays live in a single `<div id="orb-layer">` appended to `<body>`, removed completely on deactivation. The host page's DOM is never modified.

---

## Sidekick Plugin Registration

Add to `tools/sidekick/config.json` in the target site repo:

```json
{
  "plugins": [
    {
      "id": "orb",
      "title": "AEM Feature Toggles",
      "url": "https://<orb-host>/sidekick/orb.js",
      "isPalette": false,
      "paletteRect": null,
      "environments": ["preview", "live"],
      "excludePaths": []
    }
  ]
}
```

Or load it as a universal plugin via the Sidekick Admin UI — paste the plugin URL and it becomes available on every site that org manages without any per-repo config.

---

## Future: ORB as a Shared Demo Resource

Once built and hosted, the ORB plugin URL can be shared across the Adobe field team. Any SE, CSM, or consultant demoing an AEM EDS site can activate the ORB without touching the customer's code. The `orb.config.json` at each site root customizes which features appear and what they're called — the core plugin JS never changes.

A shared registry of customer-specific `orb.config.json` presets (Experian, Walmart, etc.) could be maintained in a central repo, making it trivial to load the right feature set before any meeting.

---

## Source Reference

The current Walmart implementation lives in the `eds-agents-demo` repo (deployed branch `aem-20260317-1803`):
- Toggle panel: `scripts/wm-media-library.js` lines 212–290 (live version, ahead of local checkout)
- Feature overlays: `scripts/wm-extras.js` (~67KB, all 8 features implemented)
- CSS: `styles/wm-media-library.css`

The Sidekick plugin build should extract and generalize this code, not rewrite from scratch.
