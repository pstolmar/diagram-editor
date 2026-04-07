#!/usr/bin/env tsx
/**
 * gen-tests — generate a failing Playwright spec for a new EDS block (TDD red phase).
 * Usage: npx tsx tools/gen-tests.ts <block-name> [plan-file] [demo-page-path]
 *
 * Produces three test suites in one file:
 *   - Integration (Playwright): block renders, interactions work, ARIA correct
 *   - Unit stubs: pure helpers extracted from the block (CSV parsers, slot calculators, etc.)
 *   - Regression guard: smoke assertion so future commits can't silently break the block
 *
 * Tests FAIL before implementation (TDD red) and PASS after (TDD green).
 * Outputs the written spec path on the last line of stdout for callers to capture.
 *
 * TM_TESTS_WITH: fj (default) | haiku | sonnet | opus | auto
 *   fj     = Haiku + AEM expert system prompt — knows EDS block conventions (DEFAULT)
 *   haiku  = vanilla claude-haiku-4-5-20251001
 *   sonnet = claude-sonnet-4-6 (best quality, higher cost)
 *   opus   = claude-opus-4-6
 *   auto   = fj (same as default)
 */
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCb } from "child_process";

const execAsync = promisify(execCb);

const BLOCK_NAME = process.argv[2];
const PLAN_PATH = process.argv[3] ?? "PLAN.md";
const DEMO_PAGE_ARG = process.argv[4] ?? "";

if (!BLOCK_NAME) {
  console.error("Usage: gen-tests.ts <block-name> [plan-file] [demo-page]");
  process.exit(1);
}

const cssClass = BLOCK_NAME.replace(/_/g, "-").toLowerCase();
const specPath = path.join("tests", `${cssClass}.spec.ts`);

// ── AEM expert system prompt (fj.tests flavour) ─────────────────────────────
// This is the "fj" path: haiku with a domain-specific system prompt that knows
// EDS block conventions, demo page structure, UE authoring, and what makes a
// good TDD spec for an Adobe Edge Delivery Services component.
const FJ_TESTS_SYSTEM = `You are an Adobe AEM Edge Delivery Services (EDS) testing expert.
You write Playwright TypeScript specs for EDS blocks — the kind that:
  1. FAIL before the block JS+CSS are loaded (TDD red phase)
  2. PASS once the block is correctly implemented (TDD green phase)

EDS block conventions you know:
- Every block gets a wrapper div with the CSS class matching its name (e.g. .tabbed-feature)
- The decorate(block) function runs after page load and transforms the raw authored HTML
- Block CSS classes follow BEM-lite: .block-name, .block-name-element, modifier via .is-state
- Demo pages live at /demo/<block-name>.html and use the block as plain HTML divs
- UE (Universal Editor) authoring context: blocks must not break when inside an iframe
- Blocks load their own CSS; if CSS file is missing the block still renders (gracefully)
- Interactive blocks use event delegation and standard DOM APIs (no framework)
- Animated blocks use CSS classes + requestAnimationFrame, not inline JS transitions

Test suite structure you always produce (in one .spec.ts file):

SECTION 1 — Integration tests (Playwright, require running server):
  - Block container is visible: page.locator('.css-class') is visible
  - Core structure rendered: key child elements exist (tabs, panels, canvas, grid, etc.)
  - Primary interaction works: click/hover/drag/scroll triggers expected state change
  - Accessibility: at least one aria-label, role, or keyboard navigation check
  - Responsive: viewport resize doesn't break layout (optional, include when relevant)

SECTION 2 — Unit stubs (vitest/describe.skip blocks):
  - Identify any pure helper functions the block would have (CSV parser, color resolver,
    grid slot calculator, particle initialiser, etc.)
  - Write describe.skip blocks with test stubs that will be un-skipped and filled in
    once the block is built and the helper is extractable
  - Comment: "// TODO: extract <helperName> from blocks/<name>/<name>.js and un-skip"

SECTION 3 — Regression guard:
  - A single test that asserts the block's root element exists and has expected class
  - This test lives forever in critical-path.json to catch accidental block removal

Rules:
- Import ONLY from '@playwright/test' for integration tests
- Unit stubs use describe.skip so they never run in CI until opted in
- 4–7 integration tests, 2–4 unit stubs, 1 regression guard
- beforeEach: page.goto(DEMO_PAGE, { waitUntil: 'domcontentloaded' })
- Use test.describe() to group the three sections clearly
- Output ONLY the TypeScript file content — no prose, no markdown fences, no explanation`;

async function resolveTestsCmd(systemPrompt: string, userPrompt: string): Promise<{
  cmd: string;
  label: string;
}> {
  const override = (process.env.TM_TESTS_WITH ?? "fj").toLowerCase();

  // fj and auto both use the AEM expert prompt; only the model changes
  const modelMap: Record<string, string> = {
    fj:     "claude-haiku-4-5-20251001",
    auto:   "claude-haiku-4-5-20251001",
    haiku:  "claude-haiku-4-5-20251001",
    sonnet: "claude-sonnet-4-6",
    opus:   "claude-opus-4-6",
  };
  const model = modelMap[override] ?? "claude-haiku-4-5-20251001";

  // fj/auto use the AEM expert system prompt; haiku/sonnet/opus use a simpler prompt
  const useExpertPrompt = override === "fj" || override === "auto";
  const fullPrompt = useExpertPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  // Write prompt to temp file to avoid shell arg-length limits
  const tmpFile = `/tmp/tm-gentests-${Date.now()}.txt`;
  await fs.promises.writeFile(tmpFile, fullPrompt, "utf8");

  const label = useExpertPrompt ? `fj.tests (${model})` : model;
  return { cmd: `claude -p --model ${model} < "${tmpFile}"`, label };
}

async function main() {
  if (fs.existsSync(specPath)) {
    console.log(`⚠️  gen-tests: ${specPath} already exists — skipping`);
    process.stdout.write(specPath + "\n");
    return;
  }

  const plan = fs.existsSync(PLAN_PATH)
    ? await fs.promises.readFile(PLAN_PATH, "utf8")
    : "(no PLAN.md found)";

  const demoPage = DEMO_PAGE_ARG || `/demo/${cssClass}`;

  const userPrompt = `Write a complete Playwright + unit-stub spec file for the "${cssClass}" EDS block.

Demo page: ${demoPage}
Block CSS class: .${cssClass}

PLAN.md excerpt (block specification):
${plan.substring(0, 4000)}`;

  const { cmd, label } = await resolveTestsCmd(FJ_TESTS_SYSTEM, userPrompt);
  console.log(`   tool: ${label}`);

  // Extract tmp file path from cmd for cleanup
  const tmpMatch = cmd.match(/< "([^"]+)"/);
  const tmpFile = tmpMatch?.[1] ?? "";

  let raw: string;
  try {
    const result = await execAsync(cmd, { encoding: "utf8", maxBuffer: 1024 * 1024 });
    raw = result.stdout.trim();
  } catch (err: any) {
    console.error(`❌ gen-tests: LLM call failed: ${err?.message ?? err}`);
    process.exit(1);
  } finally {
    if (tmpFile) await fs.promises.unlink(tmpFile).catch(() => {});
  }

  // Strip markdown fences if model wrapped output
  let specContent = raw;
  const fenceMatch = raw.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
  if (fenceMatch) specContent = fenceMatch[1].trim();

  // Sanity: must look like a Playwright file
  if (!specContent.includes("@playwright/test") || !specContent.includes("test(")) {
    console.error(`❌ gen-tests: output doesn't look like a Playwright spec (${label})`);
    console.error(specContent.substring(0, 400));
    process.exit(1);
  }

  await fs.promises.writeFile(specPath, specContent + "\n", "utf8");
  console.log(`✅ gen-tests: wrote ${specPath}`);
  process.stdout.write(specPath + "\n");
}

main().catch((err) => {
  console.error("💥 gen-tests error:", err);
  process.exit(1);
});
