# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm i                  # Install dependencies
npm test               # Run Playwright tests (requires aem up)
npm run lint           # Run JS + CSS linting
npm run lint:fix       # Auto-fix linting issues
npm run lint:js        # ESLint only
npm run lint:css       # Stylelint only
npm run build:json     # Merge component model JSON files
aem up                 # Start local dev proxy at http://localhost:3000 (requires AEM CLI)
```

There is no build step — this is a static site served by Adobe Edge Delivery Services.

## TDD — mandatory for all changes

**Write the test first. Watch it fail. Then fix the code. No exceptions.**

This project uses **Playwright** for all block-level tests (`tests/*.spec.ts`). Before touching any block:

1. Write a failing Playwright test that demonstrates the bug or desired behavior
2. Run `npm test tests/your-spec.spec.ts` and confirm it fails for the right reason
3. Write the minimal code to make it pass
4. Run again and confirm green
5. Add the spec to `tests/critical-path.json` so the pre-commit hook runs it

The pre-commit hook auto-runs critical-path tests when `blocks/` files change (if `aem up` is running). Never claim a fix is done without running the test. Never skip step 2.

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

## Token budget (interactive sessions only)

Use Opus only for planning. Target ≤50k context per phase. If cost exceeds $5/phase, pause.
Prefer specific file reads over repo scans. See `.claude/planning-notes.md` for full rules.


When the task description begins with markers like `[PATCH]` or `[MISER=N]`, interpret them as follows:

- `[PATCH]` (Patch / diff mode):
  - Prefer **local, non-LLM tools** first:
    - `npx eslint . --ext .json,.js,.mjs --fix`
    - `npx stylelint "blocks/**/*.css" "styles/*.css" --fix`
    - Prettier or other formatters, if available
  - For code edits:
    - Use targeted, patch-style changes (e.g., `node -e` scripts that update specific patterns)
    - Avoid full file rewrites (`fs.writeFileSync` of entire JS/CSS/JSON) unless I explicitly say "rewrite from scratch"
  - Never delete demo HTML files; treat them as read-only reference.

- `[MISER=N]` (Cost-avoidance level, 0–10):
  - `N=0`: minimal cost-avoidance; you may use Sonnet/Opus more freely.
  - `N=5`: balanced; prefer local tools and cheaper models whenever possible.
  - `N=8–10`: **maximum** avoidance:
    - Use local tools and existing helpers first.
    - Avoid Opus unless necessary for complex reasoning.
    - Keep plans compact and avoid scanning entire repos or long conversational loops.

You can assume that:
- This repo has a TypeScript job executor (`tools/code-executor.ts`) that understands JobSpec JSON.
- The outer `t`/`claudium` wrapper will execute whatever JobSpec you emit, so focus on **describing jobs**, not running commands interactively.
