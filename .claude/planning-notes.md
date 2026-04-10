# Planning notes (not loaded in executor claude -p calls)

## Token & Context Budgets
- Use Opus only for planning (/model opusplan), not implementation
- Target each plan phase ≤ 50k context tokens
- After each major phase: run /context and /cost
- If context > 75% or cost > $5/phase: pause and ask before continuing
- Prefer reading specific files over scanning entire repos

## Job spec tool selection (for decompose.ts)
- `_*.json` AEM model files: use `haiku` — never fj.mcp (bridge latency/timeout risk)
- `fj.mcp`: AEM knowledge queries only — never for file generation
- `bash`: preferred for any file write expressible as a shell command
- Parallel phases: max 3 fj.mcp steps/phase (cron tick ~60s)

## Static demo inspection
- Use: cat blocks/diagram-editor/filmstrip.html
- Use: cat blocks/diagram-editor/corkboard.html
- (NOT root filmstrip.html)
