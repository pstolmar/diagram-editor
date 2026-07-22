# PS Offers Page — Design Spec

**Date:** 2026-07-22  
**File:** `tools/ue-spa-demo/offers.html`  
**Branch:** `offers`  
**Live URL:** `https://offers--diagram-editor--pstolmar.aem.live/tools/ue-spa-demo/offers.html`

---

## Goal

A PlayStation-style offers page that demonstrates:
1. AEM Content Fragment authoring as the source of truth for all offer copy
2. In-context editing via Universal Editor (click any text field → edit in UE right panel)
3. Generate Variations — one CF with three named variations showing AI-generated copy options
4. Timed offers with live countdown timers driven by CF expiry dates
5. Personalization — audience-segment switcher filtering the offer rail

**Constraint:** No Dynamic Media parameterized templates. All imagery is via direct `<img>` tags.

---

## Architecture

Single self-contained HTML file, following the established pattern in this repo:

- Inline React 18 via CDN (no build step, no bundler)
- `<meta name="urn:adobe:aue:system:aem">` → `author-p138879-e1741192.adobeaemcloud.com`
- `universal-editor-service.adobe.io/cors.js` loaded async
- Three data fetches on mount:
  1. `featurelist` persisted query → grid + personalization items
  2. Three `byPath` calls for `ps-ghost` CF variations (master / punchy / seo)
  3. Single `byPath` call for `offers-home-hero` singleton
- All fetches fall back to inline JS constants if the network call fails
- No imports from `app.js` / `config.js` — file is standalone

**AEM endpoints:**
```
AUTHOR  = https://author-p138879-e1741192.adobeaemcloud.com
PUBLISH = https://publish-p138879-e1741192.adobeaemcloud.com
FEATURELIST_QUERY = /graphql/execute.json/global/featurelist
HERO_QUERY        = /graphql/execute.json/global/heroByPath   (byPath, _path param)
```

---

## Page Sections (top to bottom)

### 1. PS Navbar
Dark bar (`#000` background, `#003791` PS-blue accents).  
PlayStation wordmark (text), nav links: Store / PS Plus / PS5 / Deals.  
"Sign In" button right-aligned.  
No CF backing — static.

### 2. Hero
Full-width layered image composition:
- **Base layer:** `image.api.playstation.com` JPEG background (`6caf31c8` — w=1920)
- **Left overlay:** `image.api.playstation.com` PNG (`6246f891` — w=620), absolutely positioned left ~5%
- **Right overlay:** `image.api.playstation.com` PNG (`e1d0d6ac` — w=940), absolutely positioned right 0

Text overlay floated left over the composition:
- Eyebrow pill badge (CF `eyebrow`)
- Headline H1 (CF `title`)
- Subtext paragraph (CF `description.plaintext`)
- Countdown timer — days / hours / mins / secs — hardcoded expiry `2026-08-15T23:59:00Z`
- CTA button (CF `ctaLabel`)

**CF resource:** `urn:aem:/content/dam/ue-demo/fragments/offers-home-hero/jcr:content/data/master`  
All four text nodes carry `data-aue-*` annotations.

### 3. PS5 Console Offer
Two sub-rows, each full-bleed with a split layout (image 55% / copy 45%):

**Row A — PS5 Slim Disc:**  
Image: `https://gmedia.playstation.com/is/image/SIEPDC/ps5-slim-disc-console-featured-hardware-image-block-02-en-15nov23?$1600px$`  
Copy: hardcoded (product spec content — not CF-driven). Headline, sub-copy, price, savings badge, CTA.

**Row B — Certified Refurbished:**  
Image: `https://gmedia.playstation.com/is/image/SIEPDC/certified-refurbished-xf-image-desktop-01-en-17feb26$en?$1200px--t$`  
Layout flipped (copy left, image right). Hardcoded copy.

If either `gmedia.playstation.com` image fails CORS in-browser, a dark gradient placeholder fills the slot. Both image URLs stored as named constants `PS5_SLIM_URL` / `PS5_REFURB_URL` for easy swap.

### 4. Generate Variations Showcase
Section header: "✦ Generate Variations" with a one-line explainer ("Same offer, three AI-generated copy variants — pick the one that performs").

Three cards side by side. Each card renders the `ps-ghost` CF at a different variation:

| Card | Variation path | Label |
|---|---|---|
| A | `.../ps-ghost/jcr:content/data/master` | Original |
| B | `.../ps-ghost/jcr:content/data/punchy` | Punchy |
| C | `.../ps-ghost/jcr:content/data/seo` | SEO |

Each card shows: title (same across all three), eyebrow badge, description (the varying field), price/CTA.  
Each card's root element carries full `data-aue-resource` pointing at its specific variation path — clicking in UE opens the correct variation for editing.

A pill-tab row (Original / Punchy / SEO) highlights the active card for presentation focus (no routing — pure visual).

### 5. Timed Offer Grid
3×2 grid. Items sourced from the `featurelist` query, filtered to slugs: `ps-spiderman`, `ps-god-of-war`, `ps-horizon` (first three non-ghost items returned).

Each card:
- Cover image — CF `image._publishUrl` if set; else a gaming-themed Unsplash fallback keyed per slug
- Eyebrow badge (CF `eyebrow`)
- Title (CF `title`)
- Description excerpt (CF `description.plaintext`, clamped to 2 lines)
- Price (CF `ctaLabel`)
- Live countdown timer — hardcoded per-slug expiry dates:
  - `ps-spiderman` → `2026-08-03T23:59:00Z`
  - `ps-god-of-war` → `2026-08-10T23:59:00Z`
  - `ps-horizon`    → `2026-08-15T23:59:00Z`
- "Add to Cart" CTA

All CF-backed fields annotated with `data-aue-*` per item's `_path`.

### 6. Personalization Rail
Section header: "Offers for you" with audience pill switcher:  
`PS Plus Essential` / `PS Plus Extra` / `PS Plus Premium` / `Guest`

Each tier maps to a 3-item subset of the featurelist items (client-side filter — no CF field needed):

| Tier | Items shown |
|---|---|
| Guest | spiderman, god-of-war, horizon |
| PS Plus Essential | god-of-war, horizon, ghost (master) |
| PS Plus Extra | horizon, ghost (punchy), spiderman |
| PS Plus Premium | ghost (seo), spiderman, god-of-war |

Items scroll horizontally on mobile. Cards are the same component as the timed offer grid.  
Audience selection is purely cosmetic (client-side) — no authentication required.

---

## CF Paths & UE Resources

```
offers-home-hero  → urn:aem:/content/dam/ue-demo/fragments/offers-home-hero/jcr:content/data/master
ps-ghost master   → urn:aem:/content/dam/ue-demo/fragments/ps-ghost/jcr:content/data/master
ps-ghost punchy   → urn:aem:/content/dam/ue-demo/fragments/ps-ghost/jcr:content/data/punchy
ps-ghost seo      → urn:aem:/content/dam/ue-demo/fragments/ps-ghost/jcr:content/data/seo
ps-spiderman      → urn:aem:/content/dam/ue-demo/fragments/ps-spiderman/jcr:content/data/master
ps-god-of-war     → urn:aem:/content/dam/ue-demo/fragments/ps-god-of-war/jcr:content/data/master
ps-horizon        → urn:aem:/content/dam/ue-demo/fragments/ps-horizon/jcr:content/data/master
```

---

## Visual Design

**Palette:**
- Background: `#000` / `#0a0a0a`
- PS Blue: `#003791`
- Accent blue: `#00439c`
- Highlight / countdown: `#00d4ff` (PS-style cyan)
- Text: `#fff` / `rgba(255,255,255,.75)`
- Badge pill: `#003791` bg, white text; Sale badge: `#e31837`
- Card bg: `#1a1a2e` / `rgba(255,255,255,.04)`

**Typography:**
- Body/UI: Inter (already loaded via Google Fonts in other pages)
- Hero headline: clamp(2.5rem, 5vw, 4.5rem), weight 900
- Card title: 1rem–1.125rem, weight 700

**PS aesthetic references:**
- Dark backgrounds, blue/white brand palette
- Rectangular pill badges (not rounded), skewed sale ribbons
- Countdown timers styled as segmented display blocks
- Offer cards with subtle border + hover lift

---

## Data Flow

```
mount
  ├─ fetchFeaturelist() → map by slug → {spiderman, god-of-war, horizon}
  ├─ fetchHero('offers-home-hero') → heroData
  └─ fetchVariations('ps-ghost', ['master','punchy','seo']) → ghostVariants[]

render
  Hero ← heroData (with UE annotations)
  PS5 Section ← hardcoded
  Gen Vars ← ghostVariants[0/1/2] (with UE annotations per variation path)
  Grid ← featurelist items + countdown setInterval
  Rail ← featurelist items filtered by active audience tier
```

---

## Fallback Strategy

Every fetch is wrapped in try/catch. If a fetch fails, the component renders from inline JS constant fallbacks — the page is always visible. UE annotations are still present on fallback content so the editor works even without a live AEM connection to publish.

---

## Out of Scope

- Dynamic Media parameterized image templates (explicitly excluded)
- Real authentication / personalization logic
- Mobile responsive breakpoints (desktop-first demo)
- Playwright tests (demo page, not a production block)
