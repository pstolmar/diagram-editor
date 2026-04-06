# PLAN.md

## Task

Build three new EDS blocks for the diagram-editor site. Each is a standalone, fully UE-authorable
component with animations. Do NOT modify any existing blocks.

## Part A — Tabbed Feature Showcase (`blocks/tabbed-feature/`)

A marketing component: left-side vertical tab list (up to 6 tabs), clicking a tab animates in
a panel on the right with a large image + headline + 2–3 bullet points. Tabs auto-advance every
5 seconds with an animated progress bar; hovering pauses the timer.

### Block HTML structure (UE authored as rows)

Each row = one tab:
| Tab Label | Image | Heading | Body (bullets, `\n`-separated) |

### Files

- `blocks/tabbed-feature/tabbed-feature.js`
  - Parse rows: col 0 = tab label, col 1 = image, col 2 = heading, col 3 = body text
  - Build left tab list and right panel area
  - On tab click/auto-advance: swap active panel with CSS class transition
  - Auto-advance timer: `setInterval` paused on `mouseenter`, resumed on `mouseleave`
  - Progress bar: `<div class="tf-progress">` under active tab, animated via CSS
  - `moveInstrumentation(block, ...)` for UE live editing support

- `blocks/tabbed-feature/tabbed-feature.css`
  - Two-column layout (tabs left ~30%, panel right ~70%), mobile stacks vertically
  - Tab list: dark sidebar (#0f172a bg), active tab highlighted with blue left border
  - Panel: fade + slight translateX entrance transition on tab switch
  - Progress bar: `animation: tf-progress-fill linear` keyed to tab interval duration
  - Accent: #0070f3 blue for active states

- `blocks/tabbed-feature/_tabbed-feature.json`
  - UE model: 4-cell row (tabLabel text, image image, heading text, body text)
  - filters: empty (no sub-blocks)

### Add to `models/_section.json` filters array: "tabbed-feature"

---

## Part B — Sticky Scroll Narrative (`blocks/scroll-narrative/`)

"Apple-style" storytelling: a tall pinned section where a LEFT panel sticks to the viewport
while the user scrolls through stacked RIGHT panels. As each right panel enters the viewport,
the left panel content swaps to match. Great for "how it works" flows.

### Files

- `blocks/scroll-narrative/scroll-narrative.js`
  - Parse rows: col 0 = pinned-side content (text/heading/image), col 1 = scroll-side content
  - Build a wrapper with `position: sticky` left panel and a tall right scroll area
  - Use IntersectionObserver on each right panel to detect which is most visible
  - On intersection: update left panel content with crossfade transition
  - Fallback for UE Author iframe: show all panels stacked (no sticky)

- `blocks/scroll-narrative/scroll-narrative.css`
  - `.sn-wrapper`: CSS Grid, two columns (40% sticky / 60% scroll)
  - `.sn-sticky`: `position: sticky; top: 10vh; height: 80vh`
  - `.sn-panel`: min-height 60vh per scroll panel, padding
  - Left panel crossfade: `opacity` + `transform: translateY(8px)` transition on content swap
  - Mobile: single column, no sticky, sequential stacking
  - Color scheme: clean white/light grey, accent #0070f3

- `blocks/scroll-narrative/_scroll-narrative.json`
  - UE model: 2-cell row (leftContent text, rightContent text)
  - filters: empty

### Add to `models/_section.json` filters array: "scroll-narrative"

---

## Part C — Testimonials Mosaic (`blocks/testimonials-mosaic/`)

Masonry-style grid of testimonial cards. Filter chips at top (All + any categories found in
data). Cards animate in with stagger on load. "Show more" reveals next batch of 6.

### Files

- `blocks/testimonials-mosaic/testimonials-mosaic.js`
  - Parse rows: col 0 = quote, col 1 = name, col 2 = role+company (e.g. "VP · Adobe"),
    col 3 = category tag, col 4 = optional star rating (1–5)
  - Build filter chips from unique categories
  - Render cards with staggered `animation-delay` (0, 0.05s, 0.1s…)
  - Filter click: add/remove `hidden` class on cards matching category, animate remaining
  - "Show more" button: reveal next 6 hidden-by-count cards
  - Stars: render filled/empty star spans

- `blocks/testimonials-mosaic/testimonials-mosaic.css`
  - Grid: `columns: 3` CSS multi-column masonry, gap 1.5rem, mobile → 1 column
  - Cards: `break-inside: avoid`, white bg, border-radius 12px, box-shadow,
    hover: lift (translateY(-4px))
  - Stagger entrance: `@keyframes tm-card-in` (opacity 0→1, translateY 16px→0)
  - Filter chips: pill buttons, active chip has #0070f3 bg
  - Stars: color #f59e0b
  - "Show more" button: centered, outline style

- `blocks/testimonials-mosaic/_testimonials-mosaic.json`
  - UE model: 5-cell row (quote text, name text, role text, category text, stars text)
  - filters: empty

### Add to `models/_section.json` filters array: "testimonials-mosaic"

---

## Part D — Wire up `demo/tokenmiser.html` additions and `demo/tokenmiser-dash.html`

Add BELOW the existing `-tm` section in `demo/tokenmiser.html`:

### Tabbed Feature Showcase demo

```html
<div class="tabbed-feature">
  <div><div>Platform Analytics</div><div><picture><img src="/blocks/diagram-editor/filmstrip.html" alt="Analytics"></picture></div><div>Real-time insights</div><div>Track every token\nSee cost per run\nOptimize routing live</div></div>
  <div><div>Smart Routing</div><div><picture><img src="" alt="Routing"></picture></div><div>Model ladder, automated</div><div>Free tools first\nHaiku for simple tasks\nOpus only when essential</div></div>
  <div><div>Cost Dashboard</div><div><picture><img src="" alt="Dashboard"></picture></div><div>Know what you spend</div><div>Per-run breakdown\nSavings vs Opus 4\nExport to HTML</div></div>
</div>
```

### Scroll Narrative demo

```html
<div class="scroll-narrative">
  <div><div>Step 1: Plan decomposes automatically</div><div>PLAN.md gets parsed by a lightweight Haiku call into a structured JobSpec with phases and parallel groups.</div></div>
  <div><div>Step 2: Cheapest tool handles each step</div><div>bash for shell commands, codex for mechanical writes, fj.snippet for AEM JSON — no LLM needed.</div></div>
  <div><div>Step 3: Parallel phases cut wall-clock time</div><div>Independent blocks build simultaneously across Node workers. Three blocks in the time of one.</div></div>
</div>
```

### Testimonials Mosaic demo

```html
<div class="testimonials-mosaic">
  <div><div>Tokenmiser cut our build costs by 80% on the first run.</div><div>Peter S.</div><div>Engineer · Adobe</div><div>Engineering</div><div>5</div></div>
  <div><div>The parallel executor is a game-changer for multi-block sprints.</div><div>Demo User</div><div>Architect · EDS</div><div>Architecture</div><div>5</div></div>
  <div><div>FluffyJaws + Codex combo produces clean AEM JSON every time.</div><div>Test Author</div><div>Content · AEM</div><div>AEM</div><div>4</div></div>
  <div><div>MISER=8 gives 90% of Sonnet quality at Haiku prices.</div><div>Cost Analyst</div><div>Finance · Demo</div><div>Engineering</div><div>4</div></div>
</div>
```

---

## Part E — Verification

1. `npm run build:json`
2. `npm run lint` — 0 errors
3. Confirm all three blocks load at `http://localhost:3000/demo/tokenmiser` (section "New Blocks")
