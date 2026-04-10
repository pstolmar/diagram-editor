#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCb } from "child_process";

const execAsync = promisify(execCb);

const PLAN_PATH = process.argv[2] ?? "PLAN.md";
const MISER_LEVEL = parseInt(process.env.MISER_LEVEL ?? "5", 10);
const MARKERS = process.env.MARKERS ?? "";
const JOB_PATH = path.join(".claude", "job.json");
const BRIDGE_ACTIVE = fs.existsSync(path.join(".claude", "mcp-bridge.active"));

// Tool override: TM_PLAN_WITH controls which model decomposes the plan
// "auto" = haiku at MISER>=5, sonnet otherwise
// Accepted values: auto, haiku, sonnet, opus
function resolvePlanModel(): string {
  const override = (process.env.TM_PLAN_WITH ?? "auto").toLowerCase();
  if (override === "sonnet") return "claude-sonnet-4-6";
  if (override === "opus")   return "claude-opus-4-6";
  if (override === "haiku")  return "claude-haiku-4-5-20251001";
  // auto
  return MISER_LEVEL >= 5 ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";
}
const PLAN_MODEL = resolvePlanModel();

async function main() {
  if (!fs.existsSync(PLAN_PATH)) {
    console.error(`❌ decompose: PLAN.md not found at ${PLAN_PATH}`);
    process.exit(1);
  }

  const plan = await fs.promises.readFile(PLAN_PATH, "utf8");

  const systemPrompt = `You are a build orchestrator for Adobe AEM Edge Delivery Services projects.
Your job is to decompose a PLAN.md into a JobSpec JSON object.

## Tool selection

- bash: npm scripts, file operations, lint, build:json, any shell command
- playwright.test: run Playwright tests expecting PASS (TDD green). args: { spec: "tests/foo.spec.ts" }
- playwright.test.red: run Playwright tests expecting FAIL (TDD red). args: { spec: "tests/foo.spec.ts" }
- haiku: reasoning/judgment tasks — writing test specs, JS/CSS block files, demo HTML
- sonnet: complex multi-file logic, heavy state machines; use over haiku when spec is ambiguous
${BRIDGE_ACTIVE ? "- fj.mcp: AEM knowledge queries ONLY (best practices, doc lookups). NEVER for file generation.\n- fj.snippet: fallback for fj.mcp when bridge is not active." : "- fj.snippet: AEM knowledge queries ONLY (best practices, doc lookups). NEVER for file generation."}

## RULE 1 — AEM component model files (_*.json): ALWAYS bash, NEVER anything else

PROVEN FAILURE MODES (from production runs):
- haiku for _*.json → FAILS: LLM generates wrong schema; fields[] contents or missing keys break AEM
- fj.mcp for _*.json → FAILS: 120-second timeout every time; 100% failure rate across all recorded runs
- fj.snippet for _*.json → FAILS: same as fj.mcp, wrong tool for file generation

Use tool "bash" with this exact heredoc (substitute BLOCK-ID in kebab-case, Block Title in Title Case):

  mkdir -p blocks/BLOCK-ID && cat > blocks/BLOCK-ID/_BLOCK-ID.json << 'ENDJSON'
  {"definitions":[{"title":"Block Title","id":"BLOCK-ID","plugins":{"xwalk":{"page":{"resourceType":"core/franklin/components/block/v1/block","template":{"name":"Block Title","model":"BLOCK-ID"}}}}}],"models":[{"id":"BLOCK-ID","fields":[]}],"filters":[]}
  ENDJSON

  fields[] starts empty for new blocks. See RULE 6 for when to add UE fields.

## RULE 2 — Playwright: NEVER use bash for test runs

PROVEN FAILURE MODE: bash with "npm test" or "npx playwright test" → does not integrate with the
step result system; the step always reports ok even when tests fail.

- TDD green phase: tool "playwright.test", args { spec: "tests/foo.spec.ts" }
- TDD red phase: tool "playwright.test.red", args { spec: "tests/foo.spec.ts" }
- NEVER: bash { command: "npm test ..." } or bash { command: "npx playwright test ..." }

## RULE 3 — Lint: ALWAYS run lint:fix before lint

PROVEN FAILURE MODE: AI-generated CSS and JS almost always has auto-fixable lint errors.
Running "npm run lint" without "npm run lint:fix" first → lint step fails every time.

Always combine as a single bash step: npm run lint:fix && npm run lint
NEVER emit a bare "npm run lint" step without "npm run lint:fix &&" prefix.

CSS anti-patterns haiku generates that cause lint failures (instruct haiku to avoid these):
- rgba(R,G,B,A) → must be rgb(R G B / A) modern syntax
- word-break: break-word → must be overflow-wrap: anywhere
- BEM selectors (.block__elem, .block--mod) → must be flat .block-elem .block-mod
- More-specific selector before less-specific in same file → causes no-descending-specificity

JS anti-patterns haiku generates that cause lint failures:
- for...of loops → use .forEach() (no-restricted-syntax airbnb rule)
- Function called before its declaration → add // eslint-disable-next-line no-use-before-define
- new Promise(r => setTimeout(r, N)) → must be new Promise((r) => { setTimeout(r, N); })
- Import paths without .js extension

## RULE 4 — build:json ordering

npm run build:json aggregates _*.json files. It MUST run in a serial phase AFTER all _*.json
files are written. Never put build:json in the same parallel phase as the bash heredoc writes.

## RULE 5 — Demo HTML: use haiku, not bash or codex.patch

PROVEN FAILURE MODE: codex.patch for demo HTML → produces empty or skeleton output.
bash cat-heredoc for demo HTML → brittle, content is too large.
Use tool "haiku" for demo HTML files (demo/*.html).

## TDD phase structure for new block creation

Use this exact phase order when creating new EDS blocks:

  Phase 0, serial=false:
    [haiku] Write tests/BLOCK.spec.ts — Playwright test spec for new block
    [playwright.test.red] Confirm tests fail (spec="tests/BLOCK.spec.ts")

  Phase 1, parallel=true (one group per block, or one phase per block):
    [bash] _BLOCK-ID.json — model file via heredoc (RULE 1)
    [bash] block-demo.json — demo data via heredoc
    [haiku] BLOCK.js — block implementation
    [haiku] BLOCK.css — block styles

  Phase 2, serial (integration):
    [bash] Add block IDs to models/_section.json filters (jq or sed)
    [bash] npm run lint:fix && npm run lint (RULE 3)
    [bash] npm run build:json (RULE 4)

  Phase 3, serial:
    [playwright.test] Confirm tests pass (spec="tests/BLOCK.spec.ts") (RULE 2)

## RULE 6 — Block model fields: context-aware, not always empty

fields[] starts empty for brand-new blocks (bash heredoc is correct).
When ENRICHING an existing block's model (or creating one that clearly needs UE sidebar controls),
use haiku with files:["blocks/X/X.js"] to infer the right field schema.

Three authoring patterns — pick the one that matches how the block's decorate() reads content:

PATTERN A — Config via data attributes (block.dataset.myParam):
  → Add simple fields per param: text, select, checkbox
  → select needs "options": [{"name":"Label","value":"value"},...]
  → Example: { "component": "select", "name": "position", "label": "Position",
               "options": [{"name":"Bottom Right","value":"bottom-right"}, ...] }

PATTERN B — Single/paired asset inputs (block reads img.src or first-cell URLs):
  → Add aem-assets field(s) — gives the browse button in the UE sidebar
  → For images: { "component": "aem-assets", "name": "src", "label": "Image", "accept": "image/*" }
  → For DAM folders: { "component": "aem-assets", "name": "folder", "label": "Folder", "accept": "directory" }
  → Combine with text fields for labels: max 4 fields total (xwalk max-cells limit)

PATTERN C — Repeatable rows (block reads querySelectorAll(':scope > div') for a list):
  → Add ONE multifield — each item maps to one table row
  → Each item can have max 4 sub-fields (xwalk max-cells limit)
  → Gives the + Add button in UE sidebar automatically
  → Example: { "component": "multifield", "name": "items", "label": "Items",
               "fields": [
                 { "component": "aem-assets", "name": "src", "label": "Image", "accept": "image/*" },
                 { "component": "text", "name": "caption", "label": "Caption" }
               ] }

Keep fields[] EMPTY when:
  → Block loads all data from external fetch/JSON (no authored rows needed)
  → Block content is pure freeform prose/rich-text
  → Block is infrastructure (header, footer, fragment)

## Token-minimization rules

- files: [] — only include when haiku MUST see existing file content (appending/modifying).
  For brand-new files: omit files or use files: []. Max 1 file per step.
  NEVER list files from other blocks as "inspiration" — embed key patterns inline in prompt text.
- bash: use "mkdir -p blocks/BLOCK-ID &&" prefix before cat/heredoc writes to new directories.
- Keep prompt strings to 2-4 sentences — spec, not essay.

## Parallelism rules

- parallel: true — steps touching DIFFERENT files/blocks with NO shared dependencies
- parallel: false — steps with ordering constraints (test-write→red, code→lint, lint→build:json, build:json→green-test)
- JS + CSS for the same block can be parallel (different files, same directory is fine)
- _*.json model files for different blocks can be parallel

MISER level is ${MISER_LEVEL} (0=cheapest-ok, 10=maximum-avoidance).
${MISER_LEVEL >= 8 ? "At MISER>=8: prefer haiku over sonnet. Use bash for all deterministic writes." : ""}
${MARKERS ? `Active markers: ${MARKERS}` : ""}

Output ONLY valid JSON — no markdown fences, no prose, no explanation.
The JSON must match this exact schema:
{
  "id": "string (task name derived from PLAN.md, may include MISER level)",
  "kind": "eds-block-build",
  "constraints": { "stopOnError": false },
  "phases": [
    {
      "name": "string",
      "parallel": true,
      "steps": [
        {
          "name": "string",
          "tool": "bash|fj.snippet|haiku|sonnet|groundtruth|playwright.test|playwright.test.red",
          "description": "clear one-sentence instruction",
          "args": {
            "command": "shell cmd if bash",
            "prompt": "full instruction if haiku/sonnet",
            "target": "REQUIRED for haiku/sonnet steps that write a file — must be the exact output file path",
            "query": "question if fj.snippet — must include the target file path in the text",
            "files": ["input files to read if haiku/sonnet"]
          }
        }
      ]
    }
  ]
}`;

  const userPrompt = `Decompose this PLAN.md into a JobSpec JSON:\n\n${plan}`;

  // Write system prompt and user prompt to separate temp files.
  // --system-prompt overrides CLAUDE.md + memory auto-loading (~28k cache tokens saved per call).
  // The full orchestration instructions go in the system prompt file; only the PLAN goes to stdin.
  const ts = Date.now();
  const tmpSys = `/tmp/tm-decompose-sys-${ts}.txt`;
  const tmpUser = `/tmp/tm-decompose-user-${ts}.txt`;
  await fs.promises.writeFile(tmpSys, systemPrompt, "utf8");
  await fs.promises.writeFile(tmpUser, userPrompt, "utf8");

  let raw: string;
  try {
    console.log(`   model: ${PLAN_MODEL}`);
    const result = await execAsync(
      `claude -p --model ${PLAN_MODEL} --system-prompt "$(cat '${tmpSys}')" --strict-mcp-config --mcp-config '{"mcpServers":{}}' < "${tmpUser}"`,
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
    );
    raw = result.stdout.trim();
  } catch (err: any) {
    console.error(`❌ decompose: claude call failed: ${err?.message || err}`);
    process.exit(1);
  } finally {
    await fs.promises.unlink(tmpSys).catch(() => {});
    await fs.promises.unlink(tmpUser).catch(() => {});
  }

  // Strip markdown fences if model wrapped output
  let jsonStr = raw;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Find first { and last } to extract JSON robustly
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  let jobSpec: any;
  try {
    jobSpec = JSON.parse(jsonStr);
  } catch (err: any) {
    console.error(`❌ decompose: failed to parse JobSpec JSON: ${err?.message}`);
    console.error(`Raw response:\n${raw.substring(0, 500)}`);
    process.exit(1);
  }

  // Validate minimal structure
  if (!jobSpec.phases || !Array.isArray(jobSpec.phases)) {
    console.error(`❌ decompose: JobSpec missing phases array`);
    process.exit(1);
  }

  // Ensure .claude dir exists
  if (!fs.existsSync(".claude")) {
    fs.mkdirSync(".claude", { recursive: true });
  }

  await fs.promises.writeFile(JOB_PATH, JSON.stringify(jobSpec, null, 2), "utf8");

  // Print human-readable summary
  const phases = jobSpec.phases as any[];
  console.log(`\n✅ JobSpec written to ${JOB_PATH}`);
  console.log(`   ID: ${jobSpec.id ?? "(none)"}`);
  console.log(`   Phases: ${phases.length}`);
  for (const phase of phases) {
    const steps = (phase.steps ?? []) as any[];
    const tools = [...new Set(steps.map((s: any) => s.tool))].join("+");
    const parallelIcon = phase.parallel ? "⚡ parallel" : "→ serial";
    console.log(`   ${parallelIcon}  ${phase.name}: ${steps.length} step(s) [${tools}]`);
  }
}

main().catch((err) => {
  console.error(`\n💥 decompose error:`, err);
  process.exit(1);
});
