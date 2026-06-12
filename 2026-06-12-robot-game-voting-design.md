# Robot Game Voting Backend — Design Spec

**Date:** 2026-06-12  
**Branch:** demo-updates  
**Status:** Approved

## Overview

Add a real multiplayer voting backend to the AI Club Pit Crew robot-building game. Players load an EDS page, are assigned to one of 8 pre-named teams, vote on 4 robot-part tiers, and see their team's aggregated build + score in an arena reveal. The backend is a single Adobe I/O Runtime action deployed to the Stage workspace.

---

## 1. New Action: `actions/robot-game/index.js`

Single web action, `require-adobe-auth: false`, dispatches on `params.mode`:

| mode | verb | description |
|---|---|---|
| `join` | GET/POST | Returns a randomly assigned `{ teamSlug, teamName }`. No state written — pure random from the 8 slugs. |
| `submit` | POST | Reads `game:votes:{teamSlug}`, increments per-tier vote counts for the player's build, writes back. Returns `{ teamsReady }`. |
| `status` | GET | Returns phase, timer info, and team counts. Includes full `results` map only when `phase === "results"`. Lazily flips phase to `"results"` on first call after `expiresAt`. |
| `advance` | POST | Increments `game:arrivals` counter. Called once by client when player navigates to Arena. |
| `reset` | POST | Deletes all state keys, writes a fresh `game:session` with `expiresAt = now + GAME_DURATION_SECONDS`. |
| `seed` | POST | Injects fabricated vote-counts for all 8 teams with varied builds, sets `expiresAt = now + 30s`. For solo end-to-end testing. |
| `inspect` | GET | Returns raw state of all keys (`game:session`, all `game:votes:*`, `game:arrivals`) with no transformation. For debugging. |

The action URL (Stage):
```
https://adobeioruntime.net/api/v1/web/768811-280maroonswan-stage/pstolmar-test/robot-game
```

Client enables the integration via query param:
```
?aio=https://adobeioruntime.net/api/v1/web/768811-280maroonswan-stage/pstolmar-test/robot-game
```
Pages loaded without `?aio` continue using the existing local simulation — zero regression.

---

## 2. Teams

8 pre-named teams, fixed slugs:

| Slug | Name |
|---|---|
| `context-window-warriors` | Context Window Warriors |
| `prompt-engineers` | Prompt Engineers |
| `llm-dreamers` | LLM Dreamers |
| `mixture-of-experts` | Mixture of Experts |
| `agents-of-chaos` | Agents of Chaos |
| `search-party` | Search Party |
| `token-titans` | Token Titans |
| `the-verifiers` | The Verifiers |

`join` picks uniformly at random from these 8 slugs. No balancing, no persistence of player count. A team with no players simply scores 0 and is filtered from the arena display.

---

## 3. State Schema (`aio-lib-state`, 24h TTL)

**`game:session`**
```json
{
  "phase": "voting",
  "startedAt": "2026-06-12T18:00:00.000Z",
  "expiresAt": "2026-06-12T18:05:00.000Z"
}
```
`phase` values: `"voting"` | `"results"`.  
Phase flips lazily to `"results"` on the first `/status` call after `expiresAt` — no cron, no push.

**`game:votes:{teamSlug}`** (one key per team, written on first submit)
```json
{
  "teamName": "Agents of Chaos",
  "playerCount": 3,
  "mobility":  { "scout-legs": 2, "balanced-treads": 1 },
  "utility":   { "robot-arm": 3 },
  "care":      { "stabilizer": 1, "none": 2 },
  "brain":     { "verifier": 2, "fast-guesser": 1 }
}
```

**`game:arrivals`**
```json
{ "count": 3 }
```

---

## 4. Vote Aggregation

On `submit`:
1. Validate `teamSlug` is one of the 8 known slugs; validate all 4 build keys present with known option values.
2. If `game:session` is absent, auto-initialize it (same as `reset`) so the game starts on first submit without requiring an explicit reset call.
3. Read `game:votes:{teamSlug}` (may be absent on first submission for this team).
4. Increment `playerCount` and each tier's option counter.
5. Write back. Retry up to 5× with 50ms exponential backoff on write conflict.
6. Read all `game:votes:*` keys to count `teamsReady` (teams with `playerCount > 0`), return it.

**`actualBuild` determination** (computed at results time, not stored):
For each tier, pick the option with the highest vote count.  
**Tie-break: higher-scoring option wins.**

---

## 5. Scoring Map

Scores are computed server-side. The client's `SCORING_MAP` matches exactly.

| Tier | Slug | Score | Label |
|---|---|---|---|
| `mobility` | `balanced-treads` | 250 | Balanced Treads |
| `mobility` | `scout-legs` | 150 | Scout Legs |
| `mobility` | `heavy-lift` | 75 | Heavy Lift |
| `utility` | `robot-arm` | 250 | Robot Arm |
| `utility` | `grapple-hook` | 150 | Grapple Hook |
| `utility` | `suction-cup` | 75 | Suction Cup |
| `care` | `stabilizer` | 250 | Stabilizer Rig |
| `care` | `cushion-mount` | 150 | Cushion Mount |
| `care` | `none` | 75 | Unconstrained |
| `brain` | `structured-thinker` | 250 | Structured Thinker |
| `brain` | `verifier` | 150 | Verifier |
| `brain` | `fast-guesser` | 75 | Fast Guesser |

**`score = SCORING_MAP[mobility] + SCORING_MAP[utility] + SCORING_MAP[care] + SCORING_MAP[brain]`**

Range: 300 (all worst) → 1000 (all best).

Teams with `playerCount === 0`: `actualBuild: null`, `score: 0` — not fabricated, just absent.

---

## 6. Submit Payload (client → server)

```json
{
  "teamSlug": "agents-of-chaos",
  "build": {
    "mobility": "scout-legs",
    "utility": "robot-arm",
    "care": "stabilizer",
    "brain": "verifier"
  }
}
```

No `projectedScore`. Server ignores any extra fields.

---

## 7. Status Response

**During voting:**
```json
{
  "phase": "voting",
  "teamsReady": 5,
  "teamsTotal": 8,
  "expiresAt": "2026-06-12T18:05:00.000Z"
}
```

**After expiry / all teams submitted:**
```json
{
  "phase": "results",
  "teamsReady": 6,
  "teamsTotal": 8,
  "expiresAt": "2026-06-12T18:05:00.000Z",
  "results": {
    "agents-of-chaos": {
      "teamName": "Agents of Chaos",
      "playerCount": 5,
      "actualBuild": {
        "mobility": "scout-legs",
        "utility": "robot-arm",
        "care": "stabilizer",
        "brain": "verifier"
      },
      "score": 800
    },
    "mixture-of-experts": {
      "teamName": "Mixture of Experts",
      "playerCount": 0,
      "actualBuild": null,
      "score": 0
    }
  }
}
```

`runArenaPhase()` filters `results` with `r.actualBuild && r.score > 0` — absent teams are silently excluded.

---

## 8. CORS & Configuration (`app.config.yaml`)

```yaml
robot-game:
  function: actions/robot-game/index.js
  web: 'yes'
  runtime: nodejs:22
  inputs:
    LOG_LEVEL: debug
    ALLOWED_ORIGINS: >-
      https://ai-club-scavengers--diagram-editor--pstolmar.aem.live,
      https://ai-club-pit-crew--diagram-editor--pstolmar.aem.live,
      https://main--diagram-editor--pstolmar.aem.live,
      http://localhost:3000
    GAME_DURATION_SECONDS: 300
  annotations:
    require-adobe-auth: false
```

Action validates `Origin` header against `ALLOWED_ORIGINS` on every request, returns `403` if no match (same pattern as `aem-upload`).

---

## 9. Write Safety

- Per-team vote keys (`game:votes:{teamSlug}`) eliminate cross-team collisions entirely.
- Within-team concurrent submits use **read → increment → write, up to 5 retries, 50ms exponential backoff**.
- `game:arrivals` uses the same retry pattern (low-frequency, at most ~40 writes over 5 min).
- If `aio-lib-state` fails to initialize, fall back to `aio-lib-files` with a JSON semaphore lock file per team.
- Dropped votes are acceptable — a fake game was the baseline.

---

## 10. Testing Sequence (solo end-to-end)

1. `POST ?mode=reset` — fresh session, clears all state.
2. `POST ?mode=seed` — injects 8 teams with varied builds, `expiresAt = now+30s`.
3. Load EDS page with `?aio=<url>` — observe random team assignment in lobby.
4. Lobby counter shows `8/8` within one poll cycle (4s). `doAdvance()` fires automatically if not in quiz.
5. `GET ?mode=status` — confirm `phase: "results"` with 8 team entries and scores.
6. `GET ?mode=inspect` — verify raw state integrity.
7. `POST ?mode=reset` — confirm state wipes clean.

**Individual piece tests (curl):**
```bash
# Assign team
curl "<url>?mode=join"

# Submit a vote
curl -X POST "<url>?mode=submit" \
  -H "Content-Type: application/json" \
  -d '{"teamSlug":"agents-of-chaos","build":{"mobility":"scout-legs","utility":"robot-arm","care":"stabilizer","brain":"verifier"}}'

# Check status
curl "<url>?mode=status"

# Seed + fast-expire for phase-flip test
curl -X POST "<url>?mode=seed"
sleep 35
curl "<url>?mode=status"  # should return phase: "results"
```

---

## 11. Client Integration (EDS page — not in this repo)

Changes to `ai-club-pit-crew-challenge.js`:

| Where | Change |
|---|---|
| Page load | Call `?mode=join`, store `{ teamSlug, teamName }` in `sessionStorage`. Display team name. |
| Build submit | Call `?mode=submit` with the payload from §6 instead of local simulation. |
| `runLobbyPhase()` | Replace fake trickle timer with `setInterval(() => pollStatus(), 4000)`. On response: update counter, call `doAdvance()` when `teamsReady === 8 \|\| Date.now() > Date.parse(expiresAt)`. |
| `doAdvance()` | Fire `?mode=advance` once (guarded by existing `hasAdvanced` flag) before navigating. |
| Arena / results | Call `?mode=status` once, read `results` map for scoring display. |

---

## Files to Create / Modify

| File | Action |
|---|---|
| `actions/robot-game/index.js` | **Create** — new action |
| `app.config.yaml` | **Modify** — add `robot-game` action block |
| `test/robot-game.test.js` | **Create** — unit tests for aggregation, scoring, tie-break, phase flip |
