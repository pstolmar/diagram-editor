# PLAN.md

## Task

Implement **Tokenmiser v2 — Phase 2**: run logging and the routing intelligence layer.

Full spec: `docs/superpowers/specs/2026-04-06-tokenmiser-v2-design.md`

## Scope

### 1. Run logging — `.tokenmiser/runs.json`

Update `tools/code-executor.ts` to append a run record to `.tokenmiser/runs.json` after every job.
Create `.tokenmiser/` dir if absent. Append one NDJSON line per run (do not rewrite the whole file).

Run record schema (all fields required, omit unknown ones gracefully):
```json
{
  "id": "<uuid-v4>",
  "timestamp": "<ISO8601>",
  "jobId": "<job.id or 'unknown'>",
  "miserLevel": <number or null>,
  "steps": [
    { "name": "...", "tool": "...", "model": "bash|codex|haiku|sonnet|opus|unknown",
      "durationMs": 123, "status": "ok|failed|skipped" }
  ],
  "totalDurationMs": 456,
  "failedSteps": 0,
  "skippedSteps": 0,
  "escalations": []
}
```

Model field: infer from tool name:
- `bash`, `npmScript`, `eds.buildJson`, `eds.lint`, `playwright.test` → `"bash"`
- `codex.write`, `codex.patch` → `"codex"`
- `fj.snippet` → `"fj"`
- `log.escalate` → `"system"`
- anything else → `"unknown"`

For uuid: use `crypto.randomUUID()` (Node 14.17+). No external packages.

### 2. Token re-passing detection in `tokenmiser` script

In the `tokenmiser` bash script (repo root), after `claude -p` completes:
- Parse the output for token usage if `--output-format=stream-json` is available.
- Actually simpler: pass `--output-format=stream-json --verbose` flags to `claude -p` and capture
  the stream to a temp file, then extract `modelUsage` with jq (if available).
- Print a summary line: `💰 tokens: <input>in <output>out  cost: ~$<N>`
- If input tokens > 160000: print `⚠ large context (<N>k tokens)`
- Append cost summary to `.tokenmiser/runs.json` last line (merge into the record written by executor).
  If jq not available, skip silently.
- Extract MISER level from markers using grep/sed (already parsed in Phase 1).

Compute approximate cost using Sonnet 4.6 rates:
  input: $3/MTok, output: $15/MTok, cache_read: $0.30/MTok, cache_write: $3.75/MTok

Use the `groundtruth` CLI for cost arithmetic to avoid LLM token burn on math:
  groundtruth math eval "3 * inputTokens / 1000000"
  groundtruth math eval "15 * outputTokens / 1000000"
`groundtruth` is on PATH at ~/bin/groundtruth.

### 3. Routing intelligence — `tokenmiser` script

Add a `route_task()` function to the `tokenmiser` bash script that analyzes the PLAN.md
content and returns a recommended model tier. Called before building the prompt.

Rules (check in order, first match wins):
1. MISER=11 → `haiku`
2. MISER >= 8 → `haiku` (no Sonnet)
3. PLAN.md contains any of: DECISION, DESIGN, ARCHITECTURE, BLOCKED → `sonnet`
4. PLAN.md line count > 60 → `sonnet`
5. MISER >= 5 → `haiku`
6. Default → `sonnet`

Use the recommended model tier to select the `claude -p` model flag:
- `haiku` → `--model claude-haiku-4-5-20251001`
- `sonnet` → `--model claude-sonnet-4-6` (or omit flag, let claude CLI use default)

Print the routing decision: `🔀 routing: <tier> (reason: <rule that matched>)`

### 4. Escalation signal tracking

In `tools/code-executor.ts`, track escalation signals during job execution:
- Count retries per step (if a step fails and stopOnError=false, it counts as a signal)
- If `failedSteps >= 2` at end of job: append to the run record `"escalationRecommended": true`
  and print `⚡ Next run may benefit from a higher model tier (2+ steps failed)`
- This is informational only — no automatic re-run yet

### 5. Lint and verify

After all changes:
1. `npm run lint` — 0 errors
2. `npx tsc --noEmit` if tsconfig exists
3. Print summary of all files changed

## Constraints

- PATCH mode: targeted edits, no full rewrites
- Read each file before editing
- No new npm packages — use Node built-ins only (crypto, fs, path)
- Do not touch block files or demo HTML
- Do not implement the dashboard block yet (Phase 3)
