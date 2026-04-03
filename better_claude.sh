#!/usr/bin/env bash
set -euo pipefail

echo "👉 Running setup_better_claude_for_peter.sh"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -f package.json ]]; then
  echo "❌ package.json not found in $(pwd). Run this from a JS/TS project root."
  exit 1
fi

echo "✅ Found package.json in $(pwd)"

# 1) Ensure tsx is installed for TS execution
echo "📦 Ensuring 'tsx' is installed as a dev dependency..."
npm install --save-dev tsx >/dev/null 2>&1 || {
  echo "⚠️ npm install tsx failed; please install manually and re-run."
  exit 1
}
echo "✅ tsx installed (or already present)"

# 2) Patch package.json to add/merge a 'code' script
echo "🧩 Patching package.json to add 'code' script..."
node <<'EOF_NODE'
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(process.cwd(), 'package.json');
const raw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);

pkg.scripts = pkg.scripts || {};
// Don't clobber an existing 'code' script if it's not the TS executor pattern;
// but for this setup we assume we can own it.
pkg.scripts.code = "npx tsx tools/code-executor.ts";

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", 'utf8');
console.log("✅ package.json 'scripts.code' set to: npx tsx tools/code-executor.ts");
EOF_NODE

# 3) Create PLAN.md if it doesn't exist
if [[ ! -f PLAN.md ]]; then
  echo "📝 Creating PLAN.md template..."
  cat > PLAN.md <<'EOF_PLAN'
# PLAN.md

## Task
Short human summary of the goal.

## Constraints
- Max LLM spend: $2
- Target environments: (e.g. EDS dev only)
- Deadline: (today/this week)

## Phases
1. Clarify requirements
2. Implement code changes
3. Add Playwright / E2E coverage
4. Demo capture / screenshots

## Status
- [ ] Planned
- [ ] Executing
- [ ] Ready for review
EOF_PLAN
  echo "✅ PLAN.md created"
else
  echo "ℹ️ PLAN.md already exists, leaving it as-is"
fi

# 4) Create tools/code-executor.ts (backup existing if present)
mkdir -p tools

if [[ -f tools/code-executor.ts && ! -f tools/code-executor.ts.bak ]]; then
  echo "📁 Backing up existing tools/code-executor.ts to tools/code-executor.ts.bak"
  cp tools/code-executor.ts tools/code-executor.ts.bak
fi

echo "🧠 Writing tools/code-executor.ts (TypeScript job executor)..."
cat > tools/code-executor.ts <<'EOF_TS'
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCb } from "child_process";

const execAsync = promisify(execCb);

type JobStep = {
  name?: string;
  tool: string;
  args?: Record<string, any>;
  description?: string;
};

type JobPhase = {
  name: string;
  steps: JobStep[];
};

type JobConstraints = {
  stopOnError?: boolean;
  maxRuntimeSeconds?: number;
};

type JobSpec = {
  id?: string;
  kind?: string;
  phases: JobPhase[];
  constraints?: JobConstraints;
};

type StepResult = {
  phase: string;
  stepName: string;
  tool: string;
  status: "ok" | "failed" | "skipped";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  command?: string;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
};

const JOB_PATH = path.join(".claude", "job.json");
const LOG_DIR = path.join(".claude", "logs");
const REPORT_PATH = "REPORT.md";

function ensureDirs() {
  if (!fs.existsSync(".claude")) {
    fs.mkdirSync(".claude");
  }
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

async function loadJob(): Promise<JobSpec> {
  if (!fs.existsSync(JOB_PATH)) {
    throw new Error(
      `Job spec not found at ${JOB_PATH}.\n` +
        "Expected Claude/you to write a JSON job description there before running `npm run code`.\n" +
        "For planning, ask Claude to output a JSON job spec and save it to .claude/job.json."
    );
  }
  const raw = await fs.promises.readFile(JOB_PATH, "utf8");
  return JSON.parse(raw) as JobSpec;
}

function nowIso() {
  return new Date().toISOString();
}

async function runCommand(
  command: string,
  timeoutSeconds: number | undefined
): Promise<{ stdout: string; stderr: string }> {
  const timeoutMs = timeoutSeconds ? timeoutSeconds * 1000 : 0;
  return execAsync(command, {
    cwd: process.cwd(),
    env: process.env,
    timeout: timeoutMs || undefined,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function handleStep(
  phase: JobPhase,
  step: JobStep,
  constraints: JobConstraints
): Promise<StepResult> {
  const start = Date.now();
  const startedAt = nowIso();
  const stepName = step.name || step.tool;

  const resultBase: Omit<StepResult, "status"> = {
    phase: phase.name,
    stepName,
    tool: step.tool,
    startedAt,
    endedAt: startedAt,
    durationMs: 0,
  };

  const phasePrefix = `[${phase.name}]`;
  const label = `${phasePrefix} ${stepName} (${step.tool})`;

  console.log(`\n🚀 ${label}`);

  const perStepTimeout =
    typeof step.args?.timeoutSeconds === "number"
      ? step.args.timeoutSeconds
      : constraints.maxRuntimeSeconds ?? 600;

  let command = "";
  let stdout = "";
  let stderr = "";

  try {
    switch (step.tool) {
      case "log": {
        const message = step.args?.message ?? "(no message)";
        console.log(`📝 ${phasePrefix} ${message}`);
        return {
          ...resultBase,
          status: "ok",
          endedAt: nowIso(),
          durationMs: Date.now() - start,
          stdout: message,
        };
      }

      case "bash": {
        const cmd = step.args?.command;
        if (!cmd || typeof cmd !== "string") {
          throw new Error("bash step requires args.command:string");
        }
        command = cmd;
        console.log(`$ ${cmd}`);
        const out = await runCommand(cmd, perStepTimeout);
        stdout = out.stdout;
        stderr = out.stderr;
        break;
      }

      case "npmScript": {
        const script = step.args?.script;
        if (!script || typeof script !== "string") {
          throw new Error("npmScript step requires args.script:string");
        }
        command = `npm run ${script}`;
        console.log(`$ ${command}`);
        const out = await runCommand(command, perStepTimeout);
        stdout = out.stdout;
        stderr = out.stderr;
        break;
      }

      case "eds.buildJson": {
        command = "npm run build:json";
        console.log(`$ ${command}`);
        const out = await runCommand(command, perStepTimeout);
        stdout = out.stdout;
        stderr = out.stderr;
        break;
      }

      case "eds.lint": {
        const target = step.args?.target ?? "lint";
        command = `npm run ${target}`;
        console.log(`$ ${command}`);
        const out = await runCommand(command, perStepTimeout);
        stdout = out.stdout;
        stderr = out.stderr;
        break;
      }

      case "playwright.test": {
        const spec = step.args?.spec ?? "";
        const extra = step.args?.extraArgs ?? "";
        command = `npx playwright test ${spec} ${extra}`.trim();
        console.log(`$ ${command}`);
        const out = await runCommand(command, perStepTimeout);
        stdout = out.stdout;
        stderr = out.stderr;
        break;
      }

      default: {
        const msg = `Unknown tool '${step.tool}', skipping.`;
        console.warn(`⚠️ ${phasePrefix} ${msg}`);
        return {
          ...resultBase,
          status: "skipped",
          endedAt: nowIso(),
          durationMs: Date.now() - start,
          errorMessage: msg,
        };
      }
    }

    const endedAt = nowIso();
    const durationMs = Date.now() - start;

    const logFile = path.join(
      LOG_DIR,
      `${phase.name.replace(/\s+/g, "_")}__${stepName.replace(
        /\s+/g,
        "_"
      )}.log`
    );
    const logContent = [
      `# ${phase.name} / ${stepName}`,
      "",
      `Tool: ${step.tool}`,
      command ? `Command: ${command}` : "",
      `Started: ${startedAt}`,
      `Ended:   ${endedAt}`,
      `Duration: ${durationMs}ms`,
      "",
      "## STDOUT",
      stdout || "(empty)",
      "",
      "## STDERR",
      stderr || "(empty)",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    await fs.promises.writeFile(logFile, logContent, "utf8");

    console.log(`✅ ${label} completed in ${durationMs}ms`);

    return {
      ...resultBase,
      status: "ok",
      endedAt,
      durationMs,
      command,
      stdout,
      stderr,
    };
  } catch (err: any) {
    const endedAt = nowIso();
    const durationMs = Date.now() - start;
    const message =
      err?.message || (typeof err === "string" ? err : "Unknown error");

    console.error(`❌ ${label} failed: ${message}`);

    const logFile = path.join(
      LOG_DIR,
      `${phase.name.replace(/\s+/g, "_")}__${stepName.replace(
        /\s+/g,
        "_"
      )}.log`
    );
    const logContent = [
      `# ${phase.name} / ${stepName} (FAILED)`,
      "",
      `Tool: ${step.tool}`,
      command ? `Command: ${command}` : "",
      `Started: ${startedAt}`,
      `Ended:   ${endedAt}`,
      `Duration: ${durationMs}ms`,
      "",
      "## ERROR",
      message,
      "",
      "## STDOUT",
      stdout || "(empty)",
      "",
      "## STDERR",
      stderr || "(empty)",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    await fs.promises.writeFile(logFile, logContent, "utf8");

    return {
      ...resultBase,
      status: "failed",
      endedAt,
      durationMs,
      command,
      stdout,
      stderr,
      errorMessage: message,
    };
  }
}

async function writeReport(job: JobSpec, results: StepResult[]) {
  const lines: string[] = [];

  lines.push(`# Job Report`);
  lines.push("");
  lines.push(`- ID: ${job.id || "(none)"}`);
  lines.push(`- Kind: ${job.kind || "(unspecified)"}`);
  lines.push(
    `- Generated at: ${nowIso()}`
  );
  lines.push("");

  const byPhase: Record<string, StepResult[]> = {};
  for (const r of results) {
    byPhase[r.phase] = byPhase[r.phase] || [];
    byPhase[r.phase].push(r);
  }

  for (const phase of job.phases ?? []) {
    lines.push(`## Phase: ${phase.name}`);
    const phaseResults = byPhase[phase.name] || [];
    if (!phaseResults.length) {
      lines.push("- (no steps executed)");
      lines.push("");
      continue;
    }

    for (const r of phaseResults) {
      const icon =
        r.status === "ok" ? "✅" : r.status === "failed" ? "❌" : "⏭️";
      lines.push(
        `- ${icon} **${r.stepName}** [${r.tool}] — ${r.status} (${r.durationMs}ms)`
      );
      if (r.errorMessage) {
        lines.push(`  - Error: ${r.errorMessage}`);
      }
    }
    lines.push("");
  }

  lines.push("## Notes");
  lines.push(
    "- Detailed logs are in `.claude/logs/` grouped by phase and step."
  );
  lines.push(
    "- Claude can read this REPORT.md and the logs to summarize or decide next steps."
  );
  lines.push("");

  await fs.promises.writeFile(REPORT_PATH, lines.join("\n"), "utf8");
  console.log(`\n📄 Wrote ${REPORT_PATH}`);
}

async function main() {
  try {
    ensureDirs();
    const job = await loadJob();

    const constraints: JobConstraints = {
      stopOnError: job.constraints?.stopOnError ?? true,
      maxRuntimeSeconds: job.constraints?.maxRuntimeSeconds,
    };

    const results: StepResult[] = [];

    for (const phase of job.phases ?? []) {
      console.log(`\n==============================`);
      console.log(`🧩 Phase: ${phase.name}`);
      console.log(`==============================`);

      for (const step of phase.steps ?? []) {
        const res = await handleStep(phase, step, constraints);
        results.push(res);
        if (constraints.stopOnError && res.status === "failed") {
          console.log(
            `⚠️ Stopping further steps in this job because stopOnError=true`
          );
          break;
        }
      }
    }

    await writeReport(job, results);

    const failed = results.filter((r) => r.status === "failed");
    if (failed.length > 0) {
      console.error(
        `\n❌ Job completed with ${failed.length} failed step(s). See REPORT.md and .claude/logs/ for details.`
      );
      process.exitCode = 1;
    } else {
      console.log(
        `\n✅ Job completed successfully. See REPORT.md and .claude/logs/ for details.`
      );
    }
  } catch (err: any) {
    console.error(`\n💥 Executor error:`, err?.message || err);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\n💥 Unhandled executor error:`, err);
  process.exitCode = 1;
});
EOF_TS

echo "✅ tools/code-executor.ts written"

# 5) Ensure .claude/logs exists
mkdir -p .claude/logs

# 6) Patch .gitignore to keep Claude artifacts out of git
if [[ -f .gitignore ]]; then
  echo "🧹 Updating .gitignore for Claude artifacts..."
  add_ignore() {
    local pattern="$1"
    if ! grep -qxF "$pattern" .gitignore; then
      echo "$pattern" >> .gitignore
      echo "  + added $pattern"
    fi
  }
  add_ignore ".claude/settings.local.json"
  add_ignore ".claude/job.json"
  add_ignore ".claude/logs/"
  add_ignore "REPORT.md"
else
  echo "ℹ️ No .gitignore found; skipping ignore rules"
fi

echo "🎉 Done. Next steps:"
echo "  1) Ask Claude to PLAN ONLY and write a job spec to .claude/job.json."
echo "  2) Run: npm run code"
echo "  3) Let Claude read REPORT.md and .claude/logs/* to decide next steps."
