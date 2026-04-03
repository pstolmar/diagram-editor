# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm i                  # Install dependencies
npm run lint           # Run JS + CSS linting
npm run lint:fix       # Auto-fix linting issues
npm run lint:js        # ESLint only
npm run lint:css       # Stylelint only
npm run build:json     # Merge component model JSON files
aem up                 # Start local dev proxy at http://localhost:3000 (requires AEM CLI)
```

There are no unit tests or a runtime build step — this is a static site served by Adobe Edge Delivery Services.

## Architecture

This is an **Adobe AEM Edge Delivery Services (EDS)** site with WYSIWYG/XWalk authoring support. The delivery model is serverless edge rendering of HTML pages authored in AEM Cloud Service.

### Block-based structure

All UI components live in `blocks/<name>/`. Each block exports a `default async function decorate(block)` that receives a DOM element and transforms its content. Blocks auto-load their CSS sibling. This is the primary extension point — new features are almost always new blocks.

### Scripts

- `scripts/aem.js` — AEM Edge Delivery core utilities (decorateBlocks, loadSection, loadCSS, createOptimizedPicture, etc.)
- `scripts/scripts.js` — Main entry: decorateMain → loadEager → loadLazy. Also implements moveAttributes/moveInstrumentation helpers.
- `scripts/editor-support.js` — AEM Universal Editor live-editing integration (DOMPurify-sanitized DOM patching)
- `scripts/editor-support-rte.js` — Rich text editor decoration

### AEM component models

The `models/` directory holds XWalk/WYSIWYG component definitions split by block. `build:json` merges them into three root-level aggregated files (`component-models.json`, `component-definition.json`, `component-filters.json`) that AEM reads for the authoring UI.

### Diagram editor block

`blocks/diagram-editor/` is the active development area. It loads Mermaid v10 from CDN and renders `<pre class="diagram-source">` (or bare `<pre>`) content as SVG. It dispatches `diagram:render` and `diagram:error` custom events. Export functionality (PNG/JPEG/SVG) is planned.

### Linting

ESLint uses airbnb-base + json + xwalk plugins. Import paths require explicit `.js` extensions. CSS uses stylelint-config-standard. Pre-commit hooks enforce both via Husky.
