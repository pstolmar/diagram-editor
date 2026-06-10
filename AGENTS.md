# AGENTS.md — Project Instructions

This file is the primary reference for all AI coding tools (Claude Code, Gemini CLI, Codex, Copilot CLI, etc.).
Claude Code users: see also `CLAUDE.md` for Claude-specific additions.

## Commands

```bash
npm i                  # Install dependencies
npm test               # Run Playwright tests (requires aem up)
npm run lint           # Run JS + CSS linting
npm run lint:fix       # Auto-fix linting issues
npm run lint:js        # ESLint only
npm run lint:css       # Stylelint only
npm run build:json     # Merge component model JSON files
aem up                 # Start local dev proxy at http://localhost:3000
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

The pre-commit hook auto-runs critical-path tests when `blocks/` files change (if `aem up` is running).
Never claim a fix is done without running the test. Never skip step 2.

## Architecture

Adobe AEM Edge Delivery Services (EDS) site with WYSIWYG/XWalk authoring support.
Serverless edge rendering of HTML pages authored in AEM Cloud Service.

### Block-based structure

All UI components live in `blocks/<name>/`. Each block exports:

```js
export default async function decorate(block) { /* transform DOM */ }
```

Blocks auto-load their CSS sibling (`blocks/<name>/<name>.css`).

### Key blocks

- `blocks/live-configurator/` — step-based configurator with stored state
- `blocks/poll-widget/` — voting widget
- `blocks/threejs-scene/` — Three.js scene host
- `blocks/diagram-editor/` — Mermaid v10 renderer (active dev area)

### Scripts

- `scripts/aem.js` — AEM EDS core utilities (decorateBlocks, loadCSS, createOptimizedPicture)
- `scripts/scripts.js` — Main entry: decorateMain → loadEager → loadLazy
- `scripts/editor-support.js` — Universal Editor live-editing integration

### AEM component models

`models/` holds XWalk component definitions per block.
`npm run build:json` merges them into three root-level aggregated files AEM reads for authoring UI.

### Diagram editor block

`blocks/diagram-editor/` loads Mermaid v10 from CDN. Renders `<pre class="diagram-source">` as SVG.
Dispatches `diagram:render` and `diagram:error` custom events.

### AI Pit Crew Challenge

Live team activity — 5-20 people per team, 5-10+ teams, ~15 minutes.
Teams vote on robot build choices, watch an animated 3D arena mission, and compete for the highest score.

Key files:
- `tools/ai-club-scavengers.html/js/css` — main bay app (voting, 3D arena, form submit)
- `tools/ai-club-bays/*.html` — per-team bay pages (one per team slug)
- `tools/ai-club-config.json` — runtime event config (endpoints, team list, copy)
- `tools/ai-club-main-event.html/js/css` — main event arena (Spec B, not yet built)
- `docs/superpowers/specs/` — design specs for both phases

Specs:
- [Spec A: Bay Polish & EDS Voting](docs/superpowers/specs/2026-06-08-ai-pit-crew-polish-spec.md)
- [Spec B: Main Event Arena](docs/superpowers/specs/2026-06-08-ai-pit-crew-main-event-spec.md)
- [EDS Site Spec](docs/superpowers/specs/2026-06-08-ai-pit-crew-eds-site-spec.md)
- [Facilitation Plan](docs/superpowers/specs/2026-06-08-ai-pit-crew-facilitation-plan.md)

## Linting

ESLint: airbnb-base + json + xwalk plugins. Import paths require explicit `.js` extensions.
CSS: stylelint-config-standard.
Pre-commit hooks enforce both via Husky.

## Task description flags

- `[PATCH]` — prefer local, non-LLM tools; targeted patch-style changes; avoid full file rewrites.
- `[MISER=N]` (0–10) — cost-avoidance level. N=8–10: local tools first, avoid Opus, compact plans.
