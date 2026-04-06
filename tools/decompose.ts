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

async function main() {
  if (!fs.existsSync(PLAN_PATH)) {
    console.error(`❌ decompose: PLAN.md not found at ${PLAN_PATH}`);
    process.exit(1);
  }

  const plan = await fs.promises.readFile(PLAN_PATH, "utf8");

  const systemPrompt = `You are a build orchestrator for Adobe AEM Edge Delivery Services projects.
Your job is to decompose a PLAN.md into a JobSpec JSON object.

Rules for tool selection:
- bash: npm scripts, file operations, lint, build:json, playwright, any shell command
- codex.patch: mechanical code writes where the spec is complete and unambiguous (new block JS/CSS)
- fj.snippet: AEM model JSON / UE component definitions / short targeted snippets
- haiku: reasoning tasks, integration work, debugging, anything needing judgment
- sonnet: complex multi-file architecture decisions, when haiku would likely fail

Rules for parallelism:
- parallel: true — steps that touch DIFFERENT files/blocks with NO shared dependencies
- parallel: false — steps that depend on each other (e.g. build:json after model JSONs exist)

MISER level is ${MISER_LEVEL} (0=cheapest-ok, 10=maximum-avoidance).
${MISER_LEVEL >= 8 ? "At MISER>=8: prefer codex.patch and fj.snippet over haiku for any step with a clear spec." : ""}
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
          "tool": "bash|codex.patch|fj.snippet|haiku|sonnet|groundtruth",
          "description": "clear one-sentence instruction",
          "args": {
            "command": "shell cmd if bash",
            "prompt": "full instruction if haiku/sonnet/codex",
            "target": "output file path if applicable",
            "query": "question if fj.snippet",
            "files": ["input files to read if haiku/sonnet"]
          }
        }
      ]
    }
  ]
}`;

  const userPrompt = `Decompose this PLAN.md into a JobSpec JSON:\n\n${plan}`;
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  // Write prompt to temp file to avoid shell argument-length limits
  const tmpFile = `/tmp/tm-decompose-${Date.now()}.txt`;
  await fs.promises.writeFile(tmpFile, fullPrompt, "utf8");

  let raw: string;
  try {
    const result = await execAsync(
      `claude -p --model claude-haiku-4-5-20251001 < "${tmpFile}"`,
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
    );
    raw = result.stdout.trim();
  } catch (err: any) {
    console.error(`❌ decompose: claude call failed: ${err?.message || err}`);
    process.exit(1);
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => {});
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
