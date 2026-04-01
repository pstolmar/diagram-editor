# Demo Research Notes
_Saved mid-session for FluffyJaws follow-up after restart_

## Experian Visual Design (from experian.com CSS analysis)

### Color Palette
- **Primary accent**: `#c1188b` (vibrant magenta/pink) — hero CTAs, active tab indicators
- **Secondary/base**: `#194088` (deep navy blue) — consistent across sections
- **Teal accent**: `#45c2c2`
- **Neutrals**: `#f4f5f8` (off-white), `#2c3039` (dark text)
- **Semantic**: `#24c762` green (success), `#dc3838` red (error)
- **Subtle backgrounds**: "Pale Cherry" `#feebeb`, "Coconut" `#f5f8fe`

### Animations (confirmed in CSS)
- **Fade**: 0.15–0.25s ease-in opacity transitions
- **SlideY**: 0.5–0.6s upward entrance keyframes
- **Shake**: 1s ease-in rotational wobble (±7deg), 0.3s delay
- **Shimmer**: infinite horizontal gradient sweep (loading states)
- **Staggered image slide**: `.img-sliding-1` (0.1s delay), `.img-sliding-2` (0.4s delay)
- **Collapse**: 0.35s ease height transitions for accordions
- Sparkles/fireworks/confetti = canvas JS (not in static CSS — confirmed they exist from user observation)
- All animations include `prefers-reduced-motion` overrides

### Layout
- Bootstrap-style 12-column grid
- Roboto font throughout
- Pills-style tabs with pink active underline
- Hero: flexbox centered mobile, split layout desktop
- Cards: hover-triggered shadow elevation

## Experian Business Context

### Scale & Complexity
- 5 product ecosystems: Financial Services, Consumer Services, Health, Automotive, Marketing Services
- 32 countries, large global marketing operation
- Scaled Generative AI for email personalization at scale (2025)
- Data-driven lead gen + ML personalization + partnerships model

### Pain Points (relevant to our demo)
1. **Content velocity**: Getting high-fidelity campaign pages live fast without developer bottleneck
2. **Multi-product consistency**: Many products need consistent branding with varied, region-specific content
3. **Asset management at scale**: Large DAM → many teams pulling assets → rendition/format chaos
4. **Performance under complexity**: Complex animated pages that still need to be fast
5. **Creative production bottleneck**: Marketing needs Creative Cloud but workflow between DAM → design → publish is slow

### What resonates from our demo
- **UE authoring complex animated components** → directly removes the developer bottleneck
- **AEM Assets rendition API** → solves the asset format/rendition chaos
- **Express deep-link integration** → speeds up Creative Cloud workflow
- **100 Lighthouse with effects** → proves performance doesn't require simplicity

## Three Component Concept (agreed direction)

### Visual System
- Base: Experian navy `#194088` (or deeper `#050d1f` for more drama)
- Per-component accent shifts: Teal → Purple → Electric Blue
- Shared: dot-grid texture, animated glow orbs, gradient-bordered cards

### Component 1: Tabbed Hero (`tabbed-hero` block)
- Full-width navy hero with 3 tabs
- Each tab: different accent color + different effect
- **Effect on load**: sparkles (canvas-based particles)
- **Effect per tab switch**: can be configured per tab (sparkles/fireworks/confetti/none)
- Authorable fields: tab.label, tab.accentColor, tab.effect, tab.heading, tab.body, tab.ctaLabel, tab.ctaUrl, tab.assetRef

### Component 2: Asset Intelligence Gallery (`asset-gallery` block)
- Teal accent
- Shows AEM Assets + rendition API (fisheyeglass, monochrome, smart-crop, web-optimized)
- Rendition switcher with shimmer transition effect
- Authorable fields: assetRefs (multi), enabledRenditions, sectionTitle, sectionBody

### Component 3: Express Creative Launch (`creative-launch` block)
- Purple accent
- Campaign card with Express deep-link
- **Confetti fires on "Edit in Express" click**
- Shows: AEM Assets ref → Express template pre-loaded
- Authorable fields: assetRef, expressTemplateUrl, confetti (on/off), cardTitle, ctaLabel

## Effects System (Performance Strategy)
- **Sparkles**: CSS-only `@keyframes` — zero JS, zero libraries
- **Fireworks**: Small canvas animation (~8KB), lazy loaded on `requestIdleCallback`
- **Confetti**: `canvas-confetti` library (~7KB), lazy loaded only when `confetti=on` in block config
- All effects: non-blocking, run after LCP, do NOT affect Lighthouse score
- Reduced motion: all effects respect `prefers-reduced-motion`

## TODO: FluffyJaws Research
- Need to restart session for FluffyJaws MCP to load
- Ask FluffyJaws for: Experian-specific AEM pain points, active initiatives, stakeholder priorities, any known asks from Experian account team
- Cross-reference findings with component design — may need to pivot one of the three components

## Mockup Files (visual companion)
- Session dir: `/Users/pstolmar/dev/eds/diagram-editor/.superpowers/brainstorm/85356-1775059731/`
- `content/visual-style.html` — initial aesthetic direction (A/B/C)
- `content/color-palette.html` — Experian-style navy + three accent colors
- `content/full-concept.html` — full three-component layout mockup ← **main reference**

## Next Steps After Restart
1. Query FluffyJaws MCP for Experian account intelligence
2. Refine design if FluffyJaws surfaces new requirements
3. Get user approval on full-concept mockup
4. Write design doc → write-plans → implement
