import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import crypto from "crypto";

const execAsync = promisify(execCb);

type JobStep = {
  name?: string;
  tool: string;
  args?: Record<string, any>;
  description?: string;
};

type JobPhase = {
  name: string;
  parallel?: boolean;
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
const TOKENMISER_DIR = ".tokenmiser";
const RUNS_LOG = path.join(TOKENMISER_DIR, "runs.json");

/** Infer model tier from tool name */
function inferModel(tool: string): string {
  if (["bash", "npmScript", "eds.buildJson", "eds.lint", "playwright.test"].includes(tool)) return "bash";
  if (["codex.write", "codex.patch"].includes(tool)) return "codex";
  if (tool === "fj.snippet") return "fj";
  if (tool === "haiku") return "haiku";
  if (tool === "sonnet") return "sonnet";
  if (tool === "groundtruth") return "groundtruth";
  if (tool === "log.escalate") return "system";
  return "unknown";
}

function ensureDirs() {
  if (!fs.existsSync(".claude")) {
    fs.mkdirSync(".claude");
  }
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(TOKENMISER_DIR)) {
    fs.mkdirSync(TOKENMISER_DIR, { recursive: true });
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


      case "codex.write": {
        // Check codex availability; fall back to skip if absent
        try {
          await runCommand("which codex", 5);
        } catch {
          const msg = `codex not found — skipping codex.write step '${stepName}'`;
          console.warn(`⚠️ ${phasePrefix} ${msg}`);
          return {
            ...resultBase,
            status: "skipped",
            endedAt: nowIso(),
            durationMs: Date.now() - start,
            errorMessage: msg,
          };
        }
        const target = step.args?.target ?? "";
        const description = step.description ?? step.args?.description ?? stepName;
        command = `codex -q ${JSON.stringify(description)} --full-auto`;
        if (target) command += ` -- ${JSON.stringify(target)}`;
        console.log(`$ ${command}`);
        const out = await runCommand(command, perStepTimeout);
        stdout = out.stdout;
        stderr = out.stderr;
        break;
      }

      case "codex.patch": {
        // Check codex availability; fall back to skip if absent
        try {
          await runCommand("which codex", 5);
        } catch {
          const msg = `codex not found — skipping codex.patch step '${stepName}'`;
          console.warn(`⚠️ ${phasePrefix} ${msg}`);
          return {
            ...resultBase,
            status: "skipped",
            endedAt: nowIso(),
            durationMs: Date.now() - start,
            errorMessage: msg,
          };
        }
        const patchTarget = step.args?.target ?? "";
        const prompt = step.args?.prompt ?? step.description ?? stepName;
        command = `codex -q ${JSON.stringify(prompt)} --full-auto`;
        if (patchTarget) command += ` -- ${JSON.stringify(patchTarget)}`;
        console.log(`$ ${command}`);
        const out = await runCommand(command, perStepTimeout);
        stdout = out.stdout;
        stderr = out.stderr;
        break;
      }

      case "fj.snippet": {
        const query = step.args?.query ?? step.description ?? stepName;
        const target = step.args?.target as string | undefined;
        const fjPrompt = `You are an AEM Edge Delivery Services expert. Output ONLY the requested code or JSON, no explanation, no markdown fences.\n\nRequest: ${query}`;
        command = `echo ${JSON.stringify(fjPrompt)} | claude -p --model claude-haiku-4-5-20251001`;
        console.log(`  🔍 fj.snippet: ${query.substring(0, 60)}`);
        const fjOut = await runCommand(command, perStepTimeout);
        stdout = fjOut.stdout.trim();
        stderr = fjOut.stderr;
        if (target && stdout) {
          await fs.promises.mkdir(path.dirname(path.resolve(target)), { recursive: true });
          await fs.promises.writeFile(target, stdout, "utf8");
          console.log(`  → wrote to ${target}`);
        }
        break;
      }

      case "haiku":
      case "sonnet": {
        const modelId = step.tool === "haiku" ? "claude-haiku-4-5-20251001" : "";
        const modelFlag = modelId ? `--model ${modelId}` : "";
        let llmPrompt = step.args?.prompt ?? step.description ?? stepName;
        const files = step.args?.files as string[] | undefined;
        if (files?.length) {
          const contents = await Promise.all(
            files.map(async (f) => {
              try {
                return `\n\n--- ${f} ---\n${await fs.promises.readFile(f, "utf8")}`;
              } catch {
                return "";
              }
            })
          );
          llmPrompt += contents.join("");
        }
        command = `echo ${JSON.stringify(llmPrompt)} | claude -p ${modelFlag} --permission-mode acceptEdits`.trim();
        console.log(`  🤖 ${step.tool}: ${llmPrompt.substring(0, 60)}...`);
        const llmOut = await runCommand(command, perStepTimeout);
        stdout = llmOut.stdout;
        stderr = llmOut.stderr;
        break;
      }

      case "groundtruth": {
        const expr = step.args?.expr ?? step.args?.expression ?? step.description ?? "";
        const subCmd = (step.args?.subcommand as string | undefined) ?? "math eval";
        const gtBin = path.join(process.env.HOME ?? "", "bin", "groundtruth");
        command = `${gtBin} ${subCmd} ${JSON.stringify(String(expr))}`;
        console.log(`  🔢 groundtruth: ${expr}`);
        const gtOut = await runCommand(command, perStepTimeout);
        stdout = gtOut.stdout;
        stderr = gtOut.stderr;
        break;
      }

      case "log.escalate": {
        const from = step.args?.from ?? "unknown";
        const to = step.args?.to ?? "unknown";
        const reason = step.args?.reason ?? "(no reason)";
        const escalationLine = `⚡ escalated: ${from} → ${to} · reason: ${reason}`;
        // Print in yellow
        console.log(`\x1b[33m${escalationLine}\x1b[0m`);
        // Append to REPORT.md escalations section
        const reportExists = fs.existsSync(REPORT_PATH);
        const reportContent = reportExists
          ? await fs.promises.readFile(REPORT_PATH, "utf8")
          : "";
        const escalationSection = "\n## Escalations\n";
        const newEntry = `- ${escalationLine}\n`;
        let updatedReport: string;
        if (reportContent.includes("## Escalations")) {
          updatedReport = reportContent.replace(
            /## Escalations\n/,
            `## Escalations\n${newEntry}`
          );
        } else {
          updatedReport = reportContent + escalationSection + newEntry;
        }
        await fs.promises.writeFile(REPORT_PATH, updatedReport, "utf8");
        return {
          ...resultBase,
          status: "ok",
          endedAt: nowIso(),
          durationMs: Date.now() - start,
          stdout: escalationLine,
        };
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

/** Extract MISER level from markers env var or job id, returns null if absent */
function extractMiserLevel(job: JobSpec): number | null {
  const src = [job.id ?? "", job.kind ?? ""].join(" ");
  const m = src.match(/MISER=(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

interface RunStep {
  name: string;
  tool: string;
  model: string;
  durationMs: number;
  status: "ok" | "failed" | "skipped";
}

interface RunRecord {
  id: string;
  timestamp: string;
  jobId: string;
  miserLevel: number | null;
  steps: RunStep[];
  totalDurationMs: number;
  failedSteps: number;
  skippedSteps: number;
  escalations: string[];
  escalationRecommended?: boolean;
}

async function appendRunRecord(record: RunRecord): Promise<void> {
  const line = JSON.stringify(record) + "\n";
  await fs.promises.appendFile(RUNS_LOG, line, "utf8");
}

async function runPhase(
  phase: JobPhase,
  constraints: JobConstraints
): Promise<StepResult[]> {
  if (phase.parallel && phase.steps.length > 1) {
    console.log(`  ⚡ ${phase.steps.length} steps running in parallel`);
    return Promise.all(phase.steps.map((step) => handleStep(phase, step, constraints)));
  }
  const results: StepResult[] = [];
  for (const step of phase.steps ?? []) {
    const res = await handleStep(phase, step, constraints);
    results.push(res);
    if (constraints.stopOnError && res.status === "failed") break;
  }
  return results;
}

async function main() {
  const jobStartMs = Date.now();
  try {
    ensureDirs();
    const job = await loadJob();

    const constraints: JobConstraints = {
      stopOnError: job.constraints?.stopOnError ?? true,
      maxRuntimeSeconds: job.constraints?.maxRuntimeSeconds,
    };

    const results: StepResult[] = [];
    const escalations: string[] = [];

    for (const phase of job.phases ?? []) {
      console.log(`\n==============================`);
      console.log(`🧩 Phase: ${phase.name}${phase.parallel ? " ⚡ PARALLEL" : ""}`);
      console.log(`==============================`);

      const phaseResults = await runPhase(phase, constraints);
      results.push(...phaseResults);

      // Collect escalation messages from log.escalate steps
      for (const res of phaseResults) {
        const stepRef = phase.steps.find((s) => (s.name || s.tool) === res.stepName);
        if (stepRef?.tool === "log.escalate" && res.status === "ok" && res.stdout) {
          escalations.push(res.stdout);
        }
      }

      if (constraints.stopOnError && phaseResults.some((r) => r.status === "failed")) {
        console.log(`⚠️ Stopping job because a phase failed and stopOnError=true`);
        break;
      }
    }

    await writeReport(job, results);

    const failed = results.filter((r) => r.status === "failed");
    const skipped = results.filter((r) => r.status === "skipped");
    const totalDurationMs = Date.now() - jobStartMs;

    // Build and append run record
    const runRecord: RunRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      jobId: job.id ?? "unknown",
      miserLevel: extractMiserLevel(job),
      steps: results.map((r) => ({
        name: r.stepName,
        tool: r.tool,
        model: inferModel(r.tool),
        durationMs: r.durationMs,
        status: r.status,
      })),
      totalDurationMs,
      failedSteps: failed.length,
      skippedSteps: skipped.length,
      escalations,
    };

    if (failed.length >= 2) {
      runRecord.escalationRecommended = true;
      console.log(`\x1b[33m⚡ Next run may benefit from a higher model tier (${failed.length} steps failed)\x1b[0m`);
    }

    await appendRunRecord(runRecord);

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
