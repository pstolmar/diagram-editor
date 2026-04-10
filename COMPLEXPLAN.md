# Enterprise EDS Portal — Authenticated Data Platform
# Global Financial / Retail Scenario (e.g. "Nexus Wealth Portal" or "RetailMax Member Hub")
#
# This plan is designed to run as 4 separate tokenmiser jobs in order.
# Each job is independently valuable and tests a specific capability ceiling.
# 
# CURRENT JOB: Run 1 of 4 — IMS Auth Foundation

---

## Background / Context

A global financial services portal needs:
- Authenticated access to account data and personalized content  
- A Java backend Sling servlet serving personalized JSON from AEM  
- A CF Worker proxy that validates IMS tokens before relaying to AEM  
- EDS blocks that show locked/blurred state for anonymous users  
- A full sign-in/sign-out experience integrated with Adobe IMS  

The existing `viz-secure-feed` block already handles _detecting_ auth.  
This plan implements the **full auth stack** from sign-in UX to gated data.

---

## Run 1 of 4: IMS Auth Foundation + Site Login UX

Goal: A complete, reusable IMS authentication layer for the EDS site,  
plus a `member-login` block that handles sign-in/sign-out UI, and an  
`auth-gate` block that wraps any content with a paywall-style lock screen.

### Phase 0: TDD — write failing tests first

**Step 0a** — haiku: Write `tests/auth-blocks.spec.ts`

Tests to write:
```
describe('member-login')
  - block renders with Sign In button when IMS not authenticated
  - clicking Sign In button calls window.adobeIMS.signIn() (mock it)
  - after IMS:Ready event with isSignedInUser()=true, shows user email + Sign Out button
  - Sign Out button calls window.adobeIMS.signOut() and clears display

describe('auth-gate')
  - anonymous user: slot content is hidden, lock overlay shown with CTA
  - authenticated user: slot content is visible, lock overlay removed
  - overlay shows configurable CTA text from block table row "cta-text"
  - dispatches custom event auth-gate:unlocked when user authenticates

describe('scripts/auth.js module')
  - getCurrentUser() returns null when IMS not ready
  - getCurrentUser() returns { email, name, avatarUrl } when signed in
  - onAuthReady(cb) fires immediately when already authenticated
  - onAuthReady(cb) fires when IMS:Ready fires later
```

Point all tests at `http://localhost:3000/demo/auth-demo` (created Phase 3).

**Step 0b** — bash: Confirm all tests RED
```bash
npx playwright test tests/auth-blocks.spec.ts --reporter=list 2>&1 | tail -20
```

---

### Phase 1: Auth utility module

**Step 1a** — haiku: Create `scripts/auth.js`

Target: `scripts/auth.js`

Implement a shared auth utility (ES module, no external deps):

```
export function isAuthenticated(): boolean
  - checks window.adobeIMS?.isSignedInUser?.()
  - checks .hlx-edit class (Sidekick edit mode)
  - checks aem-sidekick element presence

export function getCurrentUser(): { email, displayName, avatarUrl } | null
  - returns null if not authenticated
  - reads from window.adobeIMS.getProfile() if available
  - caches result for 60s in module-level variable

export function onAuthReady(callback: (user) => void): void
  - fires immediately if already authed
  - listens for IMS:Ready, IMS:StateChange, sidekick-ready
  - only fires callback once with the user object

export function signIn(redirectUrl?: string): void
  - calls window.adobeIMS.signIn({ redirect_uri: redirectUrl ?? location.href })

export function signOut(): void
  - calls window.adobeIMS.signOut()
  - clears module-level user cache

export function requireAuth(redirectPath = '/member/login'): void
  - if not authenticated and not in edit mode, redirect to redirectPath
  - respects ?returnUrl= param so the login page can redirect back
```

---

### Phase 2: New blocks

**Step 2a** — haiku: `blocks/member-login/` (JS + CSS + JSON)

Target: `blocks/member-login/member-login.js`

A full-featured login/profile block for the site header or dedicated login page:

- Imports from `../../scripts/auth.js`
- Renders state: loading → anonymous (Sign In CTA) → authenticated (avatar + name + Sign Out)
- Sign In button: calls `signIn()` with current URL as redirect
- Authenticated: shows `<img>` avatar (from IMS profile), display name, Sign Out button
- Supports block variant `member-login member-login--compact` for header use
- Dispatches `member-login:signed-in` and `member-login:signed-out` events
- Block table row `redirect-after-login` sets post-sign-in destination

Target: `blocks/member-login/member-login.css`
- `.member-login` layout, avatar circle, button styles
- Loading skeleton (pulsing gray bars) while IMS initializes
- Compact variant: avatar + name inline for header

Target: `blocks/member-login/_member-login.json`
- Component model with: redirectAfterLogin (text), buttonLabel (text, default "Sign In")

**Step 2b** — haiku: `blocks/auth-gate/` (JS + CSS + JSON)

Target: `blocks/auth-gate/auth-gate.js`

Wraps children in a lock screen for anonymous users:

- Content slot: everything in the block (images, text, tables) is the "gated" content
- Anonymous: blurs content (filter: blur(8px)), overlays a lock UI with CTA
- Lock UI contains: lock icon, configurable headline, configurable CTA button, optional "what you get" bullet list
- Authenticated: removes overlay, shows content, dispatches `auth-gate:unlocked`
- Block table rows: `cta-text` (button label), `headline`, `benefits` (pipe-separated list)
- Supports `auth-gate auth-gate--preview` variant that shows a 30% unblurred preview strip at the bottom

Target: `blocks/auth-gate/auth-gate.css`
- Lock overlay with backdrop-filter + blur on content
- Smooth transition when unlocking (300ms fade + unblur)
- Preview strip mode

Target: `blocks/auth-gate/_auth-gate.json`
- Component model: headline (richtext), ctaText (text), benefits (text, hint: pipe-separated)

---

### Phase 3: Demo page

**Step 3a** — haiku: Create `demo/auth-demo.html`

Target: `demo/auth-demo.html`

A complete demo page for auth blocks. Include:
1. Page header: "Auth Foundation — Member Login + Auth Gate"
2. `member-login` block (standard + compact variant side by side)
3. `auth-gate` block wrapping a `metrics-grid` block (so you can see the blur/unblur)
4. `auth-gate auth-gate--preview` block wrapping a `viz-secure-feed` block
5. A plain HTML section explaining how to integrate `scripts/auth.js`

Use `window.__MOCK_IMS__` toggle button on the page to simulate sign-in without real IMS:
- Adds a `<script>` block at the top of the page that sets up a mock `window.adobeIMS`
- Button "Toggle Mock Auth" flips `window.adobeIMS.isSignedInUser()` and fires `IMS:Ready`

Use same structure as `demo/viz-blocks.html`.

---

### Phase 4: Models + lint + build

**Step 4a** — bash: Add blocks to section filters
```bash
node -e "
const fs = require('fs');
const f = 'models/_section.json';
const j = JSON.parse(fs.readFileSync(f,'utf8'));
const add = ['member-login','auth-gate'];
const arr = j.filters?.components ?? j.components ?? [];
add.forEach(id => { if (!arr.includes(id)) arr.push(id); });
if (j.filters) j.filters.components = arr; else j.components = arr;
fs.writeFileSync(f, JSON.stringify(j, null, 2));
console.log('added:', add.join(', '));
"
```

**Step 4b** — bash: `npm run lint:fix 2>&1 | tail -20`

**Step 4c** — bash: `npm run build:json`

---

### Phase 5: TDD GREEN

All tests in `tests/auth-blocks.spec.ts` must pass.

```bash
npx playwright test tests/auth-blocks.spec.ts --reporter=list
```

---

---

## Run 2 of 4: Java Backend Sling Servlet + AEM RDE Deploy

> NOTE: Run this AFTER Run 1 is complete and committed.
> Requires: AEM CLI installed, AEM RDE configured (`aem use`)

### Goal

A real Java OSGi bundle (`backend/`) containing a Sling servlet that:
- Serves personalized JSON at `/bin/ds/account-data.json`
- Reads the IMS user context from the request (via Granite auth)
- Returns mock account data in dev mode (`System.getProperty("sling.devmode")`)
- Returns 401 for unauthenticated requests

Deploy to AEM RDE and validate the endpoint responds.

### Phase 1: Maven project scaffold

**Step 1a** — bash: Create Maven multi-module project
```bash
mkdir -p backend/{core/src/main/java/com/nexus/portal/core/servlets,core/src/main/resources/OSGI-INF,all}
```

**Step 1b** — haiku (with fj.snippet for AEM patterns): Create `backend/pom.xml`

Use `fj.snippet` to get: "AEM 6.5 / Cloud Service multi-module Maven POM parent with aem-sdk-api 2024.x, bnd-maven-plugin, jackrabbit-filevault-package-maven-plugin, and embedded core bundle in all module"

Target: `backend/pom.xml` — parent POM with `<modules>core,all</modules>`

**Step 1c** — haiku: `backend/core/pom.xml` — bundle POM (bnd-maven-plugin, embed=none, AEM SDK api scope=provided)

**Step 1d** — haiku: `backend/all/pom.xml` — content-package POM, embeds core bundle

### Phase 2: Java servlet

**Step 2a** — haiku (use fj.snippet for Sling API patterns): `AccountDataServlet.java`

Target: `backend/core/src/main/java/com/nexus/portal/core/servlets/AccountDataServlet.java`

Use fj.snippet to get: "Sling servlet registered with @SlingServletPaths /bin/ds/account-data.json, reads Granite auth principal from request, returns JSON response, handles CORS for localhost:3000"

Implement:
```java
@Component(service = Servlet.class)
@SlingServletPaths("/bin/ds/account-data.json")
public class AccountDataServlet extends SlingAllMethodsServlet {
  // GET handler:
  // 1. Check if "sling.devmode" system property is true → return MOCK_DATA
  // 2. Get auth: request.getAuthType() or Granite AuthorizableUtil
  // 3. If not authenticated: response.setStatus(401), return {"error":"unauthenticated"}
  // 4. Get user email from principal.getName()
  // 5. Return: {
  //      "user": { "email": "...", "accountId": "ACC-XXXXXX" },
  //      "summary": { "balance": 125430.00, "currency": "USD", "lastUpdated": "ISO" },
  //      "positions": [{ "ticker": "AAPL", "shares": 10, "value": 1800.00 }, ...],
  //      "recentTransactions": [{ "date": "ISO", "description": "...", "amount": -42.00 }, ...]
  //    }
  // Mock data: use realistic-looking static values seeded by user email hashCode
}
```

### Phase 3: RDE deploy + validation

**Step 3a** — bash: Build the bundle
```bash
cd backend && mvn clean package -DskipTests 2>&1 | tail -20
```

**Step 3b** — bash: Deploy to RDE
```bash
aem rde deploy backend/all/target/nexus-portal.all-1.0.0-SNAPSHOT.zip 2>&1 | tail -20
```

**Step 3c** — bash: Validate endpoint (dev mode)
```bash
curl -s "http://localhost:4502/bin/ds/account-data.json" -u admin:admin | python3 -m json.tool | head -20
```

### Phase 4: EDS block consuming the servlet

**Step 4a** — haiku: `blocks/account-dashboard/` (JS + CSS + JSON)

- Fetches from `/bin/ds/account-data.json`  
- Shows 401 → triggers `signIn()` from `../../scripts/auth.js`  
- Shows skeleton loader while fetching  
- Renders: account summary card, positions mini-table, recent transactions list  
- Includes refresh button  

---

---

## Run 3 of 4: CF Worker Secure Proxy + Token Validation

> Depends on Run 2 (servlet) and Run 1 (auth.js)
> New complexity: CloudFlare Worker (JS), IMS token introspection, CORS hardening

### Goal

A CF Worker at `workers/account-proxy/` that:
- Accepts `Authorization: Bearer <IMS_TOKEN>` from the EDS page
- Validates the token against IMS `/ims/validate_token`
- Proxies to the AEM servlet if valid (with basic auth to AEM)
- Returns 401 with `{"code":"invalid_token"}` if not
- Rate-limits per IP (10 req/min) with in-memory counter
- Deployed via `wrangler deploy` with `wrangler.toml` config

Update `account-dashboard` block to send the IMS token in the Authorization header.

---

---

## Run 4 of 4: Document Library + Gated Content Publishing

> Depends on Runs 1-3
> New complexity: DAM asset access control, document download tracking, multi-segment gating

### Goal

- `document-library` block: shows a grid of PDFs/assets from a DAM folder, gated by auth  
  - Authenticated users see download links (proxied via CF Worker with token validation)  
  - Anonymous users see locked cards with teaser title only  
  - Download events logged to AEM via POST /bin/ds/download-event.json  
  
- `segment-hero` block: shows different hero content based on user segment  
  - Segments: anonymous, authenticated-basic, authenticated-premium  
  - Content per segment comes from block table rows (each row = one segment)  
  - Segment determined by `getCurrentUser().entitlements` from IMS profile  
  
- Protected page redirect: add to `scripts/scripts.js`  
  - Pages with `<meta name="protected" content="true">` redirect to `/member/login?returnUrl=`  
  - After sign-in, redirect back to `returnUrl`

---

## Notes for tokenmiser

- Run 1 and 3 are pure JS/CSS — ideal for `haiku` + `codex.patch` at MISER=8
- Run 2 requires Java/Maven knowledge — lean on `fj.snippet` for Sling API patterns, `haiku` for implementation
- Run 4 mixes all layers — use `sonnet` for the cross-cutting protected-route logic only
- Each run should add its tests to `tests/critical-path.json`
- The Java backend can use `System.getProperty("sling.devmode", "false").equals("true")` for dev mocking
  — no need for a separate mock server
