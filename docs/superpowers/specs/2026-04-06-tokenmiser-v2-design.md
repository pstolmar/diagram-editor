# Tokenmiser v2 — Design Spec
_Intelligent multi-model routing layer for the `t` / `claudium` task runner_
_Date: 2026-04-06_

---

## Overview

Tokenmiser v2 transforms the existing single-Sonnet-call architecture into a cost-optimised multi-model pipeline. The central insight: most mechanical work (file writes, lint, build, test) can be done for free by Codex CLI or local bash. LLMs are invoked only where genuine reasoning is needed, and only the cheapest capable model is used. Paid LLMs are a last resort, not a default.

**Current cost (3-block job):** ~$0.11 (Sonnet writes all code inline)
**Target cost (same job):** ~$0.005 planning + $0 code = ~95% reduction
**vs Opus 4 Extended baseline:** ~99% reduction

---

## 1. Model Ladder

Cheapest → most capable. Always use the lowest rung that can do the job.

| Tier | Models | Cost | When |
|------|--------|------|------|
| 0 | `bash`, local tools | Free | lint, build, test, file ops |
| 1 | `codex` CLI | Free (up to limits) | file writes, code patches, scaffolding |
| 2 | `fj + codex` | Free | AEM/XWalk snippets via FluffyJaws → Codex patches |
| 3 | `haiku` | ~$0.01/job | simple planning, routing decisions |
| 4 | `sonnet` | ~$0.10/job | architecture, design, blocked tasks, DECISION/DESIGN/ARCHITECTURE keywords |
| 5 | `opus` | ~$0.50/job | only after repeated failures; hard-blocked at MISER 8–11 |

**Tool detection (graceful fallback):**
- `codex`: `which codex` → if absent, fall back to bash heredoc
- FluffyJaws: `.mcp.json` presence + `fj-mcp` availability → if absent, fall back to Sonnet for AEM steps
- If both absent: behaviour identical to v1

---

## 2. FJ → Codex Snippet Pipeline

For AEM/XWalk-specific steps, FluffyJaws (which has deep AEM model knowledge) generates a minimal accurate snippet, then Codex patches it to disk for free. Net result: AEM-correct output at zero LLM cost.

**Job spec step types:**

```json
{ "tool": "fj.snippet", "prompt": "XWalk component-filters entry for callout-panel block" }
```
→ FluffyJaws returns 4–12 lines of accurate JSON/JS

```json
{ "tool": "codex.patch", "target": "models/_section.json", "from": "fj.output", "description": "Add callout-panel to section filter" }
```
→ Codex applies the patch. Cost: $0.00.

**Fallback chain:** `fj.snippet` → if FJ unavailable → Sonnet generates snippet → `codex.patch` still runs if Codex available.

---

## 3. MISER Levels (0–11)

Controls cost-avoidance aggressiveness. Stored as `[MISER=N]` prefix in task description.

| Level | Opus | Sonnet | Haiku | Codex/FJ | Extra behaviour |
|-------|------|--------|-------|-----------|-----------------|
| 0 | ✓ | ✓ | ✓ | ✓ | No restrictions |
| 1–4 | ✓ | ✓ | preferred for simple tasks | ✓ | Route mechanical work to Haiku |
| 5–7 | escalation only | ✓ | default | ✓ | Aggressive task splitting; skip screenshots/video |
| 8–10 | **never** | escalation only | default | ✓ | Max avoidance; PLAN.md split per-clause; skip screenshots/video |
| 11 | **never** | **never** | default | ✓ | Codex + FJ + Haiku only, no exceptions |

**MISER 5+ task splitting:** At high MISER the planning stage splits PLAN.md sentence-by-sentence and routes each clause to the cheapest capable model independently. A clause containing "DECISION", "DESIGN", or "ARCHITECTURE" routes to Sonnet (or Haiku at MISER 11). A clause describing a file write routes to Codex.

**Steps never skipped regardless of MISER:** lint, smoke tests (Playwright), REPORT.md generation.
**Steps skipped at MISER 5+:** screenshots, video capture.

---

## 4. Two Execution Modes

### `--linear` (default)
A Router pass runs before execution begins. It reads the full job spec and annotates every step with a `model:` field. Execution then proceeds top-to-bottom. Predictable cost, front-loaded reasoning. Slightly higher cost on ambiguous jobs (pays for the annotation pass) but faster total time.

### `--reactive`
No pre-annotation. Everything defaults to Codex+bash (free tier). A **signal bus** watches each step during execution and escalates reactively when signals fire. Most jobs never touch a paid LLM. Slightly slower recovery from first failures (escalation happens after the failure, not before).

Both modes share the same escalation and MISER logic.

---

## 5. Escalation System

Escalation is **silent** (no interactive prompt), but always visible in terminal and REPORT.md with a 5-second Ctrl+C window.

### Terminal output on escalation
```
⚡ [build_json] failed 2x — escalating haiku → sonnet
   Reason: JSON parse error repeated. Ctrl+C within 5s to abort.
```

### REPORT.md entry
```
⚡ escalated: haiku→sonnet · reason: retry>=2 · step: build_json · cost_delta: +$0.08
```

### Escalation signals

| Signal | Action |
|--------|--------|
| Same step fails 2+ times | Escalate one tier up |
| Keywords in PLAN.md: `DECISION`, `DESIGN`, `ARCHITECTURE`, `BLOCKED` | Start at Sonnet |
| Total job duration > 30 minutes | Escalate to Sonnet |
| 3+ phases failed | Escalate to Opus (blocked at MISER 8–11) |
| Context re-passing detected (see §7) | Warn + offer cancel |

**Hard caps by MISER:**
- MISER 8–10: escalation ceiling is Sonnet (Opus never called)
- MISER 11: escalation ceiling is Haiku (Sonnet and Opus never called)

---

## 6. CLI Flags

| Flag | Behaviour |
|------|-----------|
| `--linear` | Default. Pre-annotate all steps before execution. |
| `--reactive` | Signal-driven escalation. Default tier = Codex+bash. |
| `--miser N` | 0–11 cost-avoidance level. |
| `--deploy` | After successful job: `git add -A && git commit && git push`, then trigger AEM code sync via Admin API (`https://admin.hlx.page/code/<org>/<repo>/main`). Runs `--validate` afterward if set. |
| `--validate` | After `--deploy`: run default Playwright critical-path smoke tests. |
| `--validate "cmd"` | After `--deploy`: run `cmd` instead of Playwright. |
| `--yolo` / `--danger` | Skip screenshots and video capture only. Lint, smoke tests, and REPORT.md are never skipped. |

**`--deploy` step sequence:**
1. Run job (existing behaviour)
2. If job passes: `git push`
3. Trigger AEM code sync
4. Run `--validate` command (default: `npx playwright test` critical path)
5. Write deploy result to REPORT.md and `.tokenmiser/runs.json`

---

## 7. Token Re-passing Detection

The executor tracks context size for every LLM call by parsing `claude -p` output or API response metadata.

**Warning thresholds:**

| Condition | Action |
|-----------|--------|
| Single call context > 80% of model limit | `⚠ large context (180k/200k tokens)` in terminal + REPORT.md |
| Same effective context passed 3+ times | `⚠ context re-passing (3x, ~540k tokens burned)` |
| Re-passing at MISER 8–11 | Auto-truncate or split context; do not re-pass |

Re-passing warnings appear in the dashboard as a distinct event type so patterns can be spotted across runs.

---

## 8. New Job Step Types (executor additions)

The following `tool:` values need to be added to `tools/code-executor.ts`:

| Tool | Behaviour | Fallback |
|------|-----------|----------|
| `fj.snippet` | Call FluffyJaws MCP with `prompt`, store output as `fj.output` | Sonnet call |
| `codex.patch` | Call `codex` CLI with `target` file + `from` content | bash heredoc |
| `codex.write` | Call `codex` CLI to write a new file from description | bash heredoc |
| `router.annotate` | (--linear only) Annotate all remaining steps with model tier | skip in --reactive |
| `escalate` | Trigger escalation to next tier; log signal; print terminal notice | — |

---

## 9. _section.json Rule (enforced by tokenmiser)

**Every new EDS block added by a tokenmiser job MUST:**
1. Add its `id` to `models/_section.json` → `filters[id=section].components`
2. Re-run `npm run build:json`

This step is now a required phase in all job spec templates that create new blocks. Failure to do this causes UE component picker to not show the block on any page.

---

## 10. Dashboard

### Phase 1 — AEM EDS page (immediate)
Custom block `tokenmiser-dashboard` at `/demo/tokenmiser-dash`.
Reads `.tokenmiser/runs.json` (append-only NDJSON, one record per run).

**Run record schema:**
```json
{
  "id": "uuid",
  "timestamp": "ISO8601",
  "jobId": "string",
  "mode": "linear|reactive",
  "miserLevel": 5,
  "steps": [{"name":"...", "tool":"...", "model":"...", "costUsd":0.002, "durationMs":400}],
  "totalCostUsd": 0.042,
  "opusBaselineCostUsd": 0.52,
  "savingsPct": 92,
  "escalations": [{"from":"haiku","to":"sonnet","reason":"retry>=2","step":"build_json"}],
  "repassingEvents": [],
  "deployResult": null
}
```

**Dashboard shows:** run history, per-run cost, model breakdown by step, escalation events, savings vs Opus 4 Extended baseline, token re-passing events, deploy status.

### Phase 2 — Terminal commands
`t --status` — last run summary  
`t --cost` — cost breakdown for last run  
`t --history` — last 10 runs table  
`t --export` — generate `dashboard.html` and open it

### Phase 3 — Standalone HTML
`dashboard.html` at repo root. Self-contained, opens via `open dashboard.html` or `localhost:3000/dashboard.html` under `aem up`. Reads `.tokenmiser/runs.json` via fetch.

---

## 11. Implementation Order

1. **Executor additions** — new step types (`fj.snippet`, `codex.patch`, `codex.write`, `escalate`, `router.annotate`), tool detection, MISER level threading
2. **Run logging** — write `.tokenmiser/runs.json` after each job
3. **`t` script updates** — new flags (`--linear`, `--reactive`, `--deploy`, `--validate`, `--yolo`), MISER 11
4. **Token re-passing detection** — context size tracking in executor
5. **Dashboard block** — Phase 1 AEM EDS page
6. **`_section.json` enforcement** — job spec template update
7. **Terminal commands** — `t --status`, `t --cost`, `t --history`, `t --export`

Each item is independently deployable. Start with 1–3 for immediate savings.
