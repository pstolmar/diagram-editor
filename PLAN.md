# [MISER=5] Enrich all block UE models + kitchen-sink demo page

Two independent goals in one run:
1. Add proper UE sidebar fields (aem-assets, select, multifield) to all remaining blocks
2. Generate demo/all-components.html with every block on one page

## Already done (do NOT re-do):
- balloon: color/position/sticky fields (select + checkbox) ✓
- image-compare + image-compare-tm: before/after aem-assets fields ✓
- photo-cubes: multifield for photos ✓
- m3d-photo-globe: multifield for locations ✓
- tabbed-feature: multifield for tabs ✓
- models/_section.json: all blocks registered ✓

---

## PHASE 1 — Model field enrichment (parallel, haiku reads each block's JS)

For each block below, haiku reads the block's JS to determine the authoring pattern and
rewrites the block's _*.json with appropriate fields. Follow RULE 6 from the system prompt.

Max 4 fields total per block (xwalk max-cells limit). For multifield, max 4 sub-fields per item.
Use "aem-assets" with accept:"image/*" for images. Use "multifield" for repeatable rows.
Keep the outer _*.json structure identical — only the "fields" array changes.

### Group A — Image pair / single image blocks (aem-assets, parallel)

Each step: read blocks/BLOCK/BLOCK.js to understand cell layout, write blocks/BLOCK/_BLOCK.json
with aem-assets fields replacing empty fields[].

- **filmstrip**: rows are image+caption pairs → multifield {image:aem-assets, caption:text}
- **corkboard**: rows are note cards → multifield {text:text, color:text}
- **polaroid-corkboard**: rows are photos → multifield {src:aem-assets, caption:text}
- **hero**: image + heading + body + CTA → 4 fields: {image:aem-assets, heading:text, body:text, cta:text}
- **cards**: rows are cards → multifield {image:aem-assets, title:text, body:text, link:text}
- **testimonials-mosaic**: rows are testimonials → multifield {quote:text, author:text, role:text, image:aem-assets}

### Group B — Content / navigation blocks (text/select fields, parallel)

- **scroll-narrative**: rows are slides → multifield {image:aem-assets, heading:text, body:text}
- **popin-carousel**: rows are carousel items → multifield {image:aem-assets, heading:text, body:text, cta:text}
- **timeline-story**: rows are events → multifield {date:text, title:text, description:text}
- **poll-widget**: first row = question text, subsequent rows = answers → read JS, add fields accordingly
- **scroll-reveal**: rows are reveal panels → multifield {heading:text, body:text}

### Group C — 3D / viz config blocks (select/text config fields, parallel)

Read the JS for each. These blocks have config rows (speed, color, count) → add text fields.
- **wave-terrain**: read blocks/wave-terrain/wave-terrain.js, add config fields
- **orbit-ring**: read blocks/orbit-ring/orbit-ring.js, add config fields
- **m3d-orbit**: read blocks/m3d-orbit/m3d-orbit.js, add config fields (if any)
- **m3d-globe**: read blocks/m3d-globe/m3d-globe.js, add CSV data + config fields
- **m3d-scatter**: read blocks/m3d-scatter/m3d-scatter.js, add config fields
- **m3d-bars**: read blocks/m3d-bars/m3d-bars.js, add config fields
- **m3d-force-graph**: read blocks/m3d-force-graph/m3d-force-graph.js, add config fields
- **m3d-image-cube**: read blocks/m3d-image-cube/m3d-image-cube.js, add image fields

### Group D — Photo / media blocks (aem-assets + config, parallel)

- **photo-effects**: reads imageUrl from config JSON → add aem-assets for the source image
- **video-panel**: reads video URL from first cell → add text field for videoUrl
- **video-scrub**: reads video URL + config rows → add text videoUrl + config fields
- **image-table**: reads rows as table data → multifield {thumbnail:aem-assets, title:text, date:text, size:text}
- **image-explorer**: reads image rows → multifield {src:aem-assets, title:text, tags:text}

---

## PHASE 2 — Integration (serial, after Phase 1)

### Step 2a — build:json
bash: npm run build:json

### Step 2b — lint
bash: npm run lint:fix && npm run lint

---

## PHASE 3 — Kitchen-sink demo page (single sonnet step, parallel with Phase 1)

Create demo/all-components.html — a single publishable EDS page with all 78+ blocks grouped
by category. This is independent of Phase 1; run in parallel.

**Page structure:**
Full HTML document. Title: "All Components — EDS Component Gallery".
Link /styles/styles.css in <head>. Each section has an <h2> heading.

**Block HTML format:**
```html
<div class="BLOCK-NAME block" data-block-name="BLOCK-NAME" data-block-status="initialized">
  <div><div>row 1 col 1</div><div>row 1 col 2</div></div>
</div>
```

**Sections and defaults:**

SECTION 1 — Content & Layout:
- hero: 2 rows: row1=[placeholder img src, heading text], row2=[body text, CTA text]
- cards: 3 rows, each: [image src, title, body text]
- columns: 2 rows, each: [left content, right content]
- text: 1 row with a paragraph of body copy
- title: 1 row with a heading
- button: 1 row: [link text, href]

SECTION 2 — Editorial / Interactive:
- tabbed-feature: 3 rows, each: [Tab Label, image, Heading, body text]
- scroll-narrative: 3 rows, each: [image, heading, body]
- testimonials-mosaic: 3 rows, each: [quote, author, role, image]
- popin-carousel: 3 rows, each: [image, heading, body, CTA]
- poll-widget: 4 rows: [Question text], [Option A], [Option B], [Option C]
- timeline-story: 3 rows, each: [2024, Event title, Description]
- scroll-reveal: 2 rows, each: [Heading, body text]
- card-reveal-hero: demo data per its existing structure

SECTION 3 — Image & Media:
- image-compare: 4 rows: [before img], [after img], [Before], [After]
- image-compare-tm: same as above
- filmstrip: 4 rows, each: [image src, caption]
- corkboard: 3 rows, each: [note text, #ffeeba]
- polaroid-corkboard: 3 rows, each: [image src, caption]
- video-panel: 1 row: [https://www.youtube.com/watch?v=dQw4w9WgXcQ]
- video-scrub: 1 row: [https://www.youtube.com/watch?v=dQw4w9WgXcQ]
- photo-effects: EMPTY block (loads from photo-effects.json)
- photo-cubes: 3 rows, each: [image src]

SECTION 4 — Data Visualization:
- csv-chart: EMPTY (loads demo JSON)
- d3-graph: EMPTY (loads demo JSON)
- particle-field: EMPTY (loads demo JSON)
- threejs-scene: EMPTY (loads demo JSON)
- metrics-grid: 3 rows, each: [value, label, trend]
- metrics-grid-tm: same
- callout-panel: 2 rows: [heading, body], [CTA label, href]
- callout-panel-tm: same
- image-table: 3 rows, each: [image src, title, 2024-01-01, 1.2 MB]
- data-explorer: EMPTY (loads demo JSON)

SECTION 5 — 3D Scenes:
- m3d-globe: EMPTY
- m3d-scatter: EMPTY
- m3d-bars: EMPTY
- m3d-force-graph: EMPTY
- m3d-orbit: EMPTY
- m3d-image-cube: EMPTY
- m3d-mirror-sphere: EMPTY
- m3d-photo-globe: 3 rows, each: [City Name, lat,lon, image url, Caption]
  Use: London 51.51,-0.13 | Tokyo 35.68,139.69 | Sydney -33.87,151.21

SECTION 6 — Live Data Feeds (all EMPTY — fetch their own data):
viz-analytics-pulse, viz-crypto-pulse, viz-quake-feed, viz-secure-feed,
viz-office-map, viz-threat-map, viz-pipeline, viz-supply-chain,
supply-chain-viz, viz-secure-feed

SECTION 7 — Creative / Fun:
- orbit-ring: EMPTY
- wave-terrain: EMPTY
- balloon: 2 rows: [color, #EB1000], [position, bottom-right]
- image-explorer: EMPTY
- diagram-editor: 1 row: [<pre class="diagram-source">graph TD; A[Start] --> B{Decision}; B -->|Yes| C[Done]; B -->|No| D[Retry]</pre>]

SECTION 8 — Tokenmiser:
- tokenmiser-dashboard: EMPTY
- tokenmiser-live: EMPTY

SECTION 9 — MISER variants (all EMPTY):
miser-csv-chart, miser-d3-graph, miser-particle-field, miser-threejs-scene,
miser-tabbed-feature, miser-scroll-narrative, miser-testimonials-mosaic, miser-popin-carousel,
miser-3d-bars, miser-3d-force-graph, miser-3d-globe, miser-3d-orbit, miser-3d-scatter,
miser-viz-csv-chart, miser-viz-d3-graph, miser-viz-particle-field,
miser-viz-scroll-narrative, miser-viz-tabbed-feature

Use sonnet for this step. target: demo/all-components.html

---

## PHASE 4 — Verify (serial, after Phase 3)

bash: node -e "
const h = require('fs').readFileSync('demo/all-components.html','utf8');
const must = ['photo-cubes','balloon','m3d-photo-globe','tabbed-feature','tokenmiser-live','viz-quake-feed','diagram-editor'];
const missing = must.filter(b => !h.includes(b));
if (missing.length) { console.error('MISSING:', missing); process.exit(1); }
console.log('OK — all spot-checked blocks present');
"
