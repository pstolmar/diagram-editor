# PLAN.md

## Task

Implement **Tokenmiser v2 — Phase 3**: the live dashboard EDS block and terminal status commands.
Then re-implement the three demo components (image-compare, metrics-grid, callout-panel) via
tokenmiser so we can compare the tokenmiser-built output against the manually-built originals.

Full spec: `docs/superpowers/specs/2026-04-06-tokenmiser-v2-design.md`

## Part A — Dashboard EDS block

### Create `blocks/tokenmiser-dashboard/tokenmiser-dashboard.js`

A standard EDS block. The `decorate(block)` function:
1. Ignores block DOM content (the block is the UI container).
2. Fetches `/.tokenmiser/runs.json` (relative to site root) as text, splits on newlines,
   parses each non-empty line as JSON. Gracefully handles fetch errors (show empty state).
3. Renders a dashboard UI with:

   **Header row:**
   - Title: "Tokenmiser Runs"
   - Total runs count badge
   - Total cost: sum of `approxCostUsd` across all records
   - Estimated savings vs Opus 4 Extended baseline:
     Opus 4 input=$15/MTok output=$75/MTok; for each run use tokenUsage if present,
     else estimate Opus cost as 5× the approxCostUsd. Show as "$X.XX saved (NN%)".

   **Runs table** (newest first):
   | # | Time | Job | Model | Steps | Cost | Savings | Status |
   - Time: relative ("2 min ago", "3 hr ago", "yesterday")
   - Job: jobId truncated to 24 chars
   - Model: routing tier (haiku/sonnet, from first step's model or infer from miserLevel)
   - Steps: "12 ok / 0 fail / 1 skip"
   - Cost: approxCostUsd formatted as "$0.0042"
   - Savings: vs Opus baseline
   - Status: green ✓ / red ✗ / yellow ⚡ (escalation)

   **Footer:** "Powered by Tokenmiser v2 · MISER routing active"

4. Auto-refreshes every 30s by re-fetching runs.json.

### Create `blocks/tokenmiser-dashboard/tokenmiser-dashboard.css`

Dark-themed dashboard card. Use CSS custom properties for colors.
Key styles: dark bg (#0f172a), monospace values, colored badges for status,
accent colors matching the metrics-grid palette (#0070f3 blue, #059669 green, #dc2626 red).
Responsive: table collapses to cards on mobile.

### Create `blocks/tokenmiser-dashboard/_tokenmiser-dashboard.json`

UE model: no editable fields (block is self-contained). Minimal definition + empty filters.

### Add block to `models/_section.json` section filter

Add "tokenmiser-dashboard" to the section filter components array.
Then run: npm run build:json

### Create `demo/tokenmiser-dash.html`

A demo page at `/demo/tokenmiser-dash` with the dashboard block.
Follow the same HTML structure as `demo/tokenmiser.html`.

## Part B — Terminal status commands in `tokenmiser` script

Add these to the `tokenmiser` script (detect via first argument pattern):

- `--status`: read last line of `.tokenmiser/runs.json`, print:
  ```
  Last run: <jobId> · <time ago> · <N> steps · cost: ~$<N> · savings: ~$<N> vs Opus4
  Model: <tier>   MISER: <N>   Status: ok/failed
  ```
- `--cost`: read all lines, print cost table (last 10 runs, newest first):
  ```
  Run                    Model   Tokens       Cost     Opus4 est  Saved
  cleanup_filmstrip...   sonnet  2k/341       $0.005   $0.025     80%
  ```
- `--history`: same as --cost but show all runs, more columns
- `--export`: generate `dashboard.html` at repo root as a self-contained HTML file
  that embeds the runs data inline (no server needed). Open it with `open dashboard.html`.

Detect these before the PLAN.md check:
```bash
if [ "${1:-}" = "--status" ]; then ... exit 0; fi
```

## Part C — Re-implement the three components via tokenmiser (for comparison)

IMPORTANT: Do NOT overwrite the existing blocks. Create parallel versions:
- `blocks/image-compare-tm/` — tokenmiser-built image compare
- `blocks/metrics-grid-tm/` — tokenmiser-built metrics grid
- `blocks/callout-panel-tm/` — tokenmiser-built callout panel

Each should be a full re-implementation from scratch using only the PLAN spec as input
(no looking at existing block code). Suffix "-tm" on all CSS classes too.

Add these to `demo/tokenmiser.html` BELOW the existing three components,
with a heading "Tokenmiser-Built Versions" so both versions are visible side-by-side.

Add all three to `models/_section.json` and run `npm run build:json`.
Add UE model JSON for each.

## Verification

1. `npm run build:json`
2. `npm run lint` — 0 errors
3. `npx playwright test tests/image-compare.spec.ts tests/metrics-grid.spec.ts tests/callout-panel.spec.ts`
4. Print cost summary at end

## Constraints

- PATCH mode where possible, full create for new files
- Read existing files before editing any
- Do not modify existing block files (image-compare, metrics-grid, callout-panel)
- The -tm blocks are fresh implementations, not copies
