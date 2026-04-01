# Experian AEM Innovations Demo — Design Spec
_Adobe Day — AEM Innovations Technical Deep Dive (B2B group, 30 min)_
_Date: 2026-04-01_

---

## Context

30-minute technical deep dive for a B2B Experian audience (architects, senior developers, marketing engineers). Goal: visually memorable, technically credible, story-driven. The core pain point FluffyJaws confirmed: **authoring flexibility without layout chaos** — marketers want to experiment with layouts but developers can't babysit every page.

Demo repo: `diagram-editor` branch `mermaid-editor`, deployed on AEM EDS.

---

## Demo Arc (30 min)

| Min | Segment | Hook |
|-----|---------|------|
| 0–3 | **Open cold on the filmstrip block scrolling** — "This is a page. I didn't write any CSS today." | Show the visual impact first, explain nothing. |
| 3–8 | **Authoring flexibility story** — UE layout dropdown, governed options. Live edit a section layout, save, reload. | "Your team did this in 45 seconds. No dev." |
| 8–14 | **Corkboard → floor flip** — scroll past the polaroid wall, watch photos fall onto the wood floor. Hover/click reveals. | Pure CSS 3D + IntersectionObserver, 100 Lighthouse. |
| 14–20 | **Assets deep dive** — rendition switcher (smart-crop, mono, web-optimized, fisheye). Mermaid diagram generated, uploaded to AEM with custom metadata + workflow trigger. | Shows AEM Assets API + agent-authored content. |
| 20–26 | **FluffyJaws live A2A** — ask a question in voice mode, watch it auto-route to AEM Data Advisory Agent, get a live answer about the demo environment. | The routing moment IS the demo. Pre-baked fallback ready. |
| 26–30 | **Q&A** | Buffer built in. |

---

## Block 1: `filmstrip`

**Visual:** Horizontal band scrolling sideways as the page loads/scrolls. Cellulose film aesthetic. Sprocket holes top and bottom. Photos in frames with sepia/flicker filter. Experian navy background.

**Implementation:**
- CSS `@keyframes filmRoll` on a wide inner container: `translateX(0) → translateX(-50%)`  
- Duplicated set of frames for seamless loop  
- Sprocket holes: `repeating-radial-gradient` on `::before`/`::after` pseudo-elements  
- Flicker: fast `@keyframes flicker` alternating `brightness(0.88)` / `brightness(1.0)` at 0.08s intervals  
- Images: CSS filter `sepia(0.4) saturate(0.8) brightness(1.15) contrast(0.9)` (the "polaroid" filter from asset-gallery)  
- Filmstrip filter: `saturate(0.3) contrast(1.4) brightness(0.85) sepia(0.3)` on hover  
- `prefers-reduced-motion`: pause animation  

**AEM authoring:** Block takes a list of images. No required metadata beyond `src` + `alt`.

**Files:** `blocks/filmstrip/filmstrip.js`, `blocks/filmstrip/filmstrip.css`

---

## Block 2: `polaroid-corkboard`

**Visual:** A corkboard (dark mahogany `#4a2810`) covered in B&W/faded polaroid photos. As the user scrolls past, photos peel off and fall onto a wood-grain floor below — the perspective flips 90° so the "wall" becomes the "floor."

### Photo states
- **Default:** high-contrast monochrome (`grayscale(1) contrast(1.3) brightness(0.85)`), slightly aged  
- Some photos: sepia + cracked overlay via `::before` pseudo-element  
- **`ix="hover-reveal"`:** `mouseenter` → adds `.revealed` → full color; `mouseleave` → restore mono  
- **`ix="click-zoom"`:** `click` → adds `.zoomed` → `scale(2.4) translateZ(0) z-index:20`; click again restores  
- **`ix="both"`:** hover reveals color AND click zooms  
- `body.has-zoom`: non-zoomed polaroids dim to `opacity: 0.4`  

### Fall animation
Triggered by `IntersectionObserver` when the scene exits the viewport (user scrolls past).  

```
fall-stamp-cw / fall-stamp-ccw (mirrored for visual variety)
Duration: 1.4s  cubic-bezier(.38, 0, .78, .3)  -- gravitational

0%:    base position, pin present
5%:    pin pops: translateY(-6px) rotate(±1.5deg)
12%:   slight bounce down
38%:   CSS filter transitions to none (color reveals mid-fall)
68%:   rotateX(-82deg) — stamp away from camera
85%:   rotateX(-88deg) translateY(240px) scale(0.88)
100%:  rotateX(-90deg) translateY(290px) scale(0.85) opacity:0
```

Dust puff: `.polaroid.falling::after` — `radial-gradient(circle, rgba(180,160,130,.45) 0%, transparent 70%)` expanding from `0 0` to `180px 60px` at 88% of the fall animation.

### Perspective scene
```css
.scene-root {
  perspective: 950px;
  perspective-origin: 50% -10%;
}
.scene-root.tipped .scene-plane {
  transform: rotateX(75deg);
  transform-style: preserve-3d;
}
.corkboard { background: #4a2810 + noise texture }
.scene-root.tipped .corkboard { opacity: 0.15; transition: opacity 1.1s ease .25s; }
.wood-floor {
  background: repeating-linear-gradient(...)  /* grain */
  opacity: 0;
  transition: opacity 1.2s ease .4s;
}
.scene-root.tipped .wood-floor { opacity: 1; }
```

### URL demo params
- `?demo=corkboard` → `scrollIntoView()` the scene  
- `?demo=fallen` → trigger tip + fall immediately (for live demo jump)  
- `?demo=home` → redirect to old brainstorm full-concept mockup  

**Files:** `blocks/polaroid-corkboard/polaroid-corkboard.js`, `blocks/polaroid-corkboard/polaroid-corkboard.css`

**Reference prototype:** `tools/polaroid-mockup.html` — complete working prototype, use as direct implementation reference.

---

## Block 3: `card-reveal-hero` (port from mermaid-rde-tools)

Tabbed hero with Experian navy/teal/magenta branding. Tabs trigger sparkle/confetti/balloons via `scripts/fx-canvas.js`.  
Source: `/Users/pstolmar/dev/aio/aio-aem-helpers/mermaid-upload-to-aem/mermaid-rde-tools/blocks/card-reveal-hero/`

**Files:** `blocks/card-reveal-hero/` (port + adapt Experian palette)

---

## Shared Utilities

- **`scripts/fx-canvas.js`** — zero-dep canvas particle system. Already copied from mermaid-rde-tools. Exports: `fireSparkler(el)`, `fireConfetti()`, `fireBalloons()`, `clearFx()`.  
- **Experian CSS vars** (add to `styles/styles.css`):
  ```css
  --color-experian-navy: #194088;
  --color-experian-navy-deep: #050d1f;
  --color-experian-teal: #45c2c2;
  --color-experian-magenta: #c1188b;
  --color-experian-text: #2c3039;
  ```

---

## Authoring Flexibility Story

**The pitch:** UE gives authors a layout dropdown (`layout: 2-col | 3-col | hero | split`) that maps to CSS classes. Authors can change the layout of any section without touching code. The block governs _which_ options exist — no infinite freeform, no layout chaos.

**Demo:** Live in Universal Editor: open a section, change layout from `2-col` to `hero`, save, see the page update. Then show the model JSON in `models/` to explain how the dropdown options are defined.

**No new block needed** — demo using an existing `columns` block variant or a simple `layout-section` block with a `layout` model field.

---

## ORB (Back Pocket)

Not centerpiece. If the audience is receptive and time allows (last 5 min), activate the ORB Sidekick plugin to overlay mock AEM integrations (Analytics badges, Workfront status, Firefly buttons) on a live page.

Design spec: `docs/ORB.md`  
Source to generalize: `wm-extras.js` (67KB) from `eds-agents-demo` live branch `aem-20260317-1803`.  
Build separately from this demo sprint.

---

## FluffyJaws Closer

Voice mode. Ask a live question about the demo environment. Let FluffyJaws auto-route to AEM Data Advisory Agent — the routing moment is the demo, not just the answer.

**Fallback:** Pre-baked screenshot of A2A routing + answer available if voice/MCP is unstable.

**Key note:** When FluffyJaws (or any AEM agent) says "core components," correct to "blocks" or "reusable block components" for this audience. "Core Components" = old WCM Java/HTL world.

---

## Performance Constraints

- All animations: `prefers-reduced-motion` respected  
- Canvas effects: lazy-loaded on `requestIdleCallback`, non-blocking, run after LCP  
- No npm bundles, no CDN imports beyond Mermaid (already in diagram-editor)  
- Target: 100 Lighthouse on all demo pages  

---

## Build Order

1. `blocks/filmstrip/` — CSS-only scroll animation, no JS required for basic version  
2. `blocks/polaroid-corkboard/` — JS + CSS, use `tools/polaroid-mockup.html` as reference  
3. Port `card-reveal-hero` with Experian palette  
4. Wire Experian CSS vars into `styles/styles.css`  
5. Build demo page content in AEM (or static HTML page for preview)  
6. ORB — separate sprint  
