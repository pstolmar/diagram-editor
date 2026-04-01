# Experian AEM Innovations Demo — Design Spec
_Adobe Day — AEM Innovations Technical Deep Dive (B2B group, 30 min)_
_Date: 2026-04-01 | Last revised: 2026-04-01 (post critical-pass)_

---

## Strategic Frame

**What we are proving:**
> AEM as a cloud-native, governed experience + asset platform that integrates with creative tooling, external systems, and emerging agent workflows — without sacrificing compliance or requiring a single power-user hero.

Every demo moment must reinforce at least one of:
- Governance at scale (not just flexibility)
- Cloud-native differences vs. on-prem
- Integration realism (not mock magic)
- Reduced single-admin dependency
- Credible, auditable extensibility via APIs and agents

**We are not demoing features. We are walking through an ecosystem moment that feels like Experian.**

---

## Confirmed Pain Points (from Experian support tickets + account context)

These are real signals. Reference them explicitly where relevant — it lands as "they did their homework."

| Source | Pain | Product answer in demo |
|---|---|---|
| E-001946285 (Nov 2025) | "What chars are allowed in DAM filenames? Does AEM auto-sanitize?" — wanting hard rules, not tribal knowledge | AEM Governance Agent: naming policies enforced at upload |
| E-001289681 (Jul 2024) | 2-month OOTB sitemap escalation; needed undocumented `excludePath`. Gana Natarajan (Sr. Dir. Engineering) personally on thread | Sites Optimizer + LLM Optimizer |
| E-002109203 (Feb 2026) | "2 months into CJA contract, still no data — business critical." Blocked by sandbox/API auth | AEP Agents (Data Insights Agent), paved onboarding patterns |
| Account context | Reliance on one AEM power user/admin. Governance gaps + authoring flexibility simultaneously missing. | Governance Agent + UE governed dropdowns |
| Account context | 32 countries, multi-product (Financial, Consumer, Health, Auto, Marketing). Need consistency at scale without developer bottleneck. | XF + MSM + UE layout governance |
| Account context | Multiple in-flight RFPs: Marketo, AJO, RTCDP. Goal to unify Adobe stack and contracts. | OneAdobe close |
| Slack (migration scoping) | ~17k Experian URLs crawled by Aemy, 14k on WordPress blogs — migration may be in scope | EDS incremental adoption + Edge publish moment |

**DSAT flags on multiple support cases.** Their threshold for friction is low. The demo should feel polished and practiced, not exploratory.

---

## Single Cohesive Storyline

**"One Experian campaign asset → DAM governance → governed authoring → global reuse → AI discoverability"**

Works for B2B + B2C, agency + internal teams, Assets + Sites + Edge Delivery, Creative Cloud + APIs + Agents.

---

## Demo Arc (30 min)

| Min | Beat | What you show | What they feel |
|---|---|---|---|
| 0–2 | **Cold open — visual hook** | Filmstrip block running. Experian-flavored content (credit score card imagery, product campaign frames, NOT generic photos). Pause. "This page was authored by a marketing manager in 45 seconds. No dev ticket filed." | Immediate curiosity. Recalibrate expectations. |
| 2–6 | **Governance anchor** | DAM upload → Governance Agent catches naming/metadata policy violation → author fixes → approved → asset transitions mono → color. "You told us you needed hard rules, not one person who knows the rules." | "They did their homework" |
| 6–12 | **Authoring flexibility with guardrails** | UE layout dropdown (governed options, not freeform). Live section change, save, reload. Then: XF + MSM — fix one Experience Fragment, watch it propagate across a 32-country hierarchy except one intentional break. Narrate: "Scale globally without losing control." | "This is actually what we need" |
| 12–16 | **Corkboard moment — governance made visible** | Corkboard wall = pending campaign assets (all monochrome = not yet approved). Run "Governance Agent" button → assets color-reveal one by one → scroll past → photos fall onto published page (perspective floor flip). The visual effect IS the governance story. | Visual memory anchor + "I get it" |
| 16–20 | **Sites Optimizer + LLM Optimizer** | Surface 3 real Experian.com issues (SEO gaps, LLM discoverability). Optionally reference their sitemap escalation if room has technical people. "No more magic incantations." | Operational trust |
| 20–24 | **BYO agents — grounded version** | Mermaid flow diagram: Campaign Brief → DAM Ingest → Governance Check → Author → Publish → EDS Edge → AEP Event → CJA Dashboard. Rendered in Experian brand colors. "This is something your team builds and embeds in AEM. Auditable. Event-driven. Not black-box AI." AEP Agents (Data Insights Agent) for the CJA onboarding pain. | Credibly extensible, not scary |
| 24–27 | **OneAdobe close** | Map: AEM + Workfront + Express + AJO + Marketo + RTCDP. "One platform budget conversation." Reference their unification goal explicitly. Point to follow-up recording for depth. | Strategic alignment |
| 27–30 | **FluffyJaws A2A live** | Ask an Experian-specific question in voice mode. Watch it auto-route to AEM Data Advisory Agent. The routing moment IS the demo. Pre-baked fallback ready if network/MCP unstable. | Exclamation mark close |

---

## Visual Design: Reframing What We Built

### The Metaphor Fix

The polaroid/corkboard aesthetic is **not wrong because it's visual** — it's wrong without business meaning attached. Fix: the polaroids ARE the Experian campaign assets, monochrome = awaiting governance approval. The Governance Agent run triggers the mono→color reveal. The wall→floor perspective flip = approved assets landing in the live published experience.

Same code. New story container.

### Filmstrip — Content Swap Required

Replace gradient placeholder frames with **Experian-flavored financial services content**:
- Credit score card / eligibility check mockup imagery
- B2B API documentation screenshot
- Product comparison hero image
- Campaign landing page still

Same CSS, same JS. Just update the authored content. The filmstrip stops being "brand photography archive" and becomes the demo page's visual entry moment.

---

## Block 1: `filmstrip`

**Visual:** Horizontal scrolling band. Financial services content frames. Experian navy background. Entry moment for the demo page — establishes "this is a well-crafted page" before the narrative begins.

**Implementation:** ✅ Built — `blocks/filmstrip/filmstrip.js`, `blocks/filmstrip/filmstrip.css`

**Content swap needed:** Replace placeholder gradients with Experian-context imagery in the authored block table.

---

## Block 2: `polaroid-corkboard`

**Visual:** Corkboard wall (dark mahogany `#4a2810`) with monochrome campaign asset "photos" (= assets pending governance approval). Governance Agent trigger button → assets reveal color one by one. Scroll past → perspective flip (wall → floor), photos fall onto published page surface.

**New element needed:** "Run Governance Agent" button that iterates through `.polaroid-photo` elements, adds `.revealed` with staggered 200ms delays, plays sparkler fx on the first one.

**Implementation:** ✅ Built — `blocks/polaroid-corkboard/polaroid-corkboard.js`, `blocks/polaroid-corkboard/polaroid-corkboard.css`

**Pending:** Add governance trigger button to the JS. Wire `fireSparkler` from `scripts/fx-canvas.js` on first reveal.

### Photo states (unchanged from prototype)
- `aged` — `grayscale(1) contrast(1.22) brightness(.72) sepia(.15)` — pending approval
- `faded` — `grayscale(.82)...` — older asset, low priority
- `cracked` — `grayscale(1) contrast(1.38) brightness(.64)` — compliance risk

### Fall animation (unchanged)
`fall-stamp-cw / fall-stamp-ccw` — 1.15s cubic-bezier(.38,0,.78,.3) gravitational  
Color reveals at 38% keyframe (mid-fall). Dust puff at 88% delay.

### Perspective scene (unchanged)
Cork fades to opacity 0.15, wood floor fades in, scene rotates `rotateX(75deg)`.

### URL demo params
- `?demo=corkboard` → scrollIntoView
- `?demo=fallen` → trigger tip + fall immediately
- `?demo=governance` → NEW: scroll to corkboard AND auto-run governance reveal sequence

---

## Block 3: `card-reveal-hero` (port from mermaid-rde-tools)

Tabbed hero with Experian palette. Used on demo page opener (above filmstrip) or as the OneAdobe closer page hero.  
Source: `mermaid-rde-tools/blocks/card-reveal-hero/`  
**Status:** Not yet ported.

---

## Block 4: Mermaid Diagram — Campaign Pipeline

Use existing `blocks/diagram-editor/` to render a Mermaid flowchart showing the Experian campaign pipeline:

```
Campaign Brief → DAM Ingest → Governance Check → Author (UE) → Publish → EDS Edge → AEP Event → CJA Dashboard
```

Styled in Experian navy + teal via Mermaid `%%{init: { 'theme': 'base', 'themeVariables': { ... } } }%%`.  
**Purpose:** This IS the "BYO agents" demo moment. Not live coding. Not MCP spelunking.

---

## Shared Utilities

- **`scripts/fx-canvas.js`** ✅ Copied. `fireSparkler(el)`, `fireConfetti()`, `fireBalloons()`, `clearFx()`.
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

**The pitch (governance-first framing):** The dropdown doesn't just enable choices — it constrains them to approved options. An author can't accidentally create a layout that breaks brand or accessibility. The power user who currently holds this knowledge in their head has been replaced by a model definition in `models/`.

**Demo:** UE → section → layout dropdown (governed) → change → save → reload. Then show `models/` JSON to explain the constraint mechanism.

**No new block needed** — use an existing `columns` block variant with a `layout` model field.

---

## What to REFER (not demo live)

Frame these as: "We've recorded a 6-minute technical follow-up so we don't burn live time."
- Cloud Manager internals
- Full EDS blocks migration philosophy
- Asset Compute / Photoshop API depth
- Workfront workflow deep-dive
- Extended AEP/CJA integration setup

---

## What to SKIP entirely

- Marketing personalization features
- Flashy AI effects with no business meaning
- Cloud Manager spelunking
- Anything that feels like "AI hacking"
- Tool bragging (Fusion, Walnut, etc.)

---

## ORB (Back Pocket — Separate Sprint)

Not in the 30-min structure. If time + audience receptivity: activate post-Q&A as a bonus.  
Design spec: `docs/ORB.md`

---

## FluffyJaws Closer

Voice mode. Pre-stage a question that is Experian-specific (reference one of their products or markets — not generic AEM question). The routing to AEM Data Advisory Agent IS the moment.

**Fallback:** Pre-baked screenshot of A2A routing output. Still shows the concept clearly.

**Terminology guard:** If FluffyJaws says "core components" during the demo, correct live: "in the EDS/crosswalk world we call those blocks" — shows you know the space.

---

## Performance Constraints

- All animations: `prefers-reduced-motion` respected
- Canvas effects: lazy-loaded on `requestIdleCallback`, non-blocking, run after LCP
- No npm bundles, no CDN imports beyond Mermaid
- Target: 100 Lighthouse on all demo pages

---

## Build Order (updated)

1. ✅ `blocks/filmstrip/` — built
2. ✅ `blocks/polaroid-corkboard/` — built
3. **Add "Run Governance Agent" trigger to polaroid-corkboard** — button that reveals photos with stagger + sparkler fx
4. **Swap filmstrip content** — Experian-context financial services frames (can do with authored block content, no code change)
5. Wire Experian CSS vars into `styles/styles.css`
6. Port `card-reveal-hero` with Experian palette
7. Build demo page (filmstrip → governance anchor → UE story → corkboard → diagram → closer)
8. Mermaid campaign pipeline diagram
9. Sites Optimizer moment (screenshots + walkthrough if no live ASO access)
10. ORB — separate sprint
