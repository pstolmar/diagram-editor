# PLAN.md

## Task

Implement **Tokenmiser v2 — Phase 1**: update the `t` wrapper and `tokenmiser` scripts with the
new flags and MISER 11 level. Then update `tools/code-executor.ts` with new step types.

Full spec: `docs/superpowers/specs/2026-04-06-tokenmiser-v2-design.md`

## Scope (Phase 1 only — do NOT touch routing logic or dashboard yet)

### 1. Update `~/bin/t`

Current file is at `/Users/pstolmar/bin/t`. Read it first, then make targeted edits:

- Add `--linear` flag (sets `LINEAR=1`, passed as marker `[LINEAR]`)
- Add `--reactive` flag (sets `REACTIVE=1`, passed as marker `[REACTIVE]`)
- Add `--deploy` flag (sets `DEPLOY=1`, passed as marker `[DEPLOY]`)
- Add `--validate` flag with optional argument (sets `VALIDATE="<cmd>"`, marker `[VALIDATE=<cmd>]`)
- Add `--yolo` / `--danger` flag (sets `YOLO=1`, marker `[YOLO]`)
- Extend MISER to accept 11 (currently 0–10); add note in usage that 11 = no Sonnet or Opus
- Update usage string to reflect all new flags
- Pass all markers to `./tokenmiser` (or fallback `claude -p`) just like PATCH and MISER

### 2. Update `./tokenmiser` (repo root)

Current file is at `tokenmiser` in repo root. Read it first, then make targeted edits:

- Accept and pass through all new markers (LINEAR, REACTIVE, DEPLOY, VALIDATE, YOLO)
- Add MISER 11 note to the system prompt preamble sent to claude -p:
  "MISER=11 means never use Opus or Sonnet — plan for Haiku/Codex/FJ only"
- After `claude -p` completes, if `[DEPLOY]` marker is present:
  - Run: `git add -A && git commit -m "chore: tokenmiser auto-deploy" && git push`
  - Print a clear message about what was pushed
  - If `[VALIDATE=<cmd>]` present: run that command; if `[VALIDATE]` with no cmd: run
    `npx playwright test` (critical path only)
- If `[YOLO]` marker: append to system prompt preamble: "Skip screenshots and video steps."

### 3. Update `tools/code-executor.ts`

Read the current file first. Add these new `tool:` types to the switch statement:

- `codex.write`: run `codex -q "<description of file to write>" --full-auto` targeting `args.target`
  file path. If codex not available (`which codex` fails), fall back to logging a warning and
  marking step as skipped (not failed).
- `codex.patch`: run `codex -q "<args.prompt>" --full-auto` with context from `args.target`.
  Same fallback.
- `fj.snippet`: log a warning "fj.snippet not yet wired — skipped" and mark skipped.
  (Full FJ MCP wiring comes in Phase 2.)
- `log.escalate`: print `⚡ escalated: <args.from> → <args.to> · reason: <args.reason>` to
  console in yellow, write same line to REPORT.md escalations section, mark step ok.

### 4. Run verification

After edits:
1. `npm run lint` — must pass (0 errors)
2. `npx tsc --noEmit` — if tsconfig.json exists, check types compile cleanly
3. Print a summary of all changes made

## Constraints

- PATCH mode: targeted edits only, no full rewrites
- Read each file before editing
- Do not touch block files, demo HTML, or component models
- Do not implement routing logic (model ladder, signal bus) — that is Phase 2
