import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec as execCb } from "child_process";
import crypto from "crypto";
import { mcpRequest, isBridgeActive } from "./mcp-bridge.js";

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
  inputTokens?: number;
  outputTokens?: number;
};

const JOB_PATH = path.join(".claude", "job.json");
const LOG_DIR = path.join(".claude", "logs");
const REPORT_PATH = "REPORT.md";

/**
 * TM_CODE_WITH: override the tool used for every non-bash step.
 * "auto" = use the tool from the JobSpec (default behaviour)
 * "codex" | "fj" | "haiku" | "sonnet" | "opus" = force that tool for all LLM steps
 * bash/groundtruth steps are never overridden (they have no LLM equivalent).
 */
const CODE_WITH_OVERRIDE = (process.env.TM_CODE_WITH ?? "auto").toLowerCase();
const LLM_TOOLS = new Set(["codex.patch", "codex.write", "fj.snippet", "fj.mcp", "haiku", "sonnet", "opus"]);

// Read MISER from job at runtime, but also read from env for early enforcement
const ENV_MISER = parseInt(process.env.MISER_LEVEL ?? "0", 10);
// DISABLE_CODEX=true routes all codex.* steps to haiku instead (use when codex is rate-limited)
const DISABLE_CODEX = process.env.DISABLE_CODEX === "true" || process.env.DISABLE_CODEX === "1";

function applyCodeWithOverride(tool: string): string {
  // DISABLE_CODEX: route all codex steps to haiku
  if (DISABLE_CODEX && (tool === "codex.patch" || tool === "codex.write")) {
    console.warn(`  [disable-codex] ${tool} → haiku`);
    return "haiku";
  }
  // MISER enforcement: demote expensive models regardless of job spec
  // At MISER>=8: sonnet → haiku, opus → skipped (via default case)
  // At MISER>=10: haiku → fj.mcp (or fj.snippet if bridge inactive)
  if (LLM_TOOLS.has(tool)) {
    if (tool === "opus") {
      console.warn(`  [miser] opus requested but NEVER allowed — skipping step`);
      return "opus"; // hits default: case → skip
    }
    if (ENV_MISER >= 8 && tool === "sonnet") {
      console.warn(`  [miser=${ENV_MISER}] sonnet demoted → haiku`);
      return "haiku";
    }
    if (ENV_MISER >= 10 && tool === "haiku") {
      const cheap = isBridgeActive() ? "fj.mcp" : "codex.patch";
      console.warn(`  [miser=${ENV_MISER}] haiku demoted → ${cheap}`);
      return cheap;
    }
  }

  if (CODE_WITH_OVERRIDE === "auto" || !LLM_TOOLS.has(tool)) return tool;
  // Map override name to canonical tool name used in runStep
  const map: Record<string, string> = {
    codex: "codex.patch",
    fj:    isBridgeActive() ? "fj.mcp" : "fj.snippet",
    haiku: "haiku",
    sonnet:"sonnet",
    opus:  "sonnet", // redirected through sonnet path if explicitly forced
  };
  return map[CODE_WITH_OVERRIDE] ?? tool;
}
const TOKENMISER_DIR = ".tokenmiser";
const RUNS_LOG = path.join(TOKENMISER_DIR, "runs.json");

/** Infer model tier from tool name */
function inferModel(tool: string): string {
  if (["bash", "bash.check", "npmScript", "eds.buildJson", "eds.lint", "playwright.test"].includes(tool)) return "bash";
  if (["codex.write", "codex.patch"].includes(tool)) return "codex";
  if (tool === "fj.snippet") return "fj";
  if (tool === "fj.mcp") return "fj.mcp";
  if (tool === "haiku") return "haiku";
  if (tool === "sonnet") return "sonnet";
  if (tool === "groundtruth") return "groundtruth";
  if (tool === "log.escalate") return "system";
  return "unknown";
}

// Approximate cost per million tokens by model tier
const COST_RATES: Record<string, { in: number; out: number }> = {
  haiku:    { in: 0.80,  out: 4.00  },
  sonnet:   { in: 3.00,  out: 15.00 },
  codex:    { in: 0.15,  out: 0.60  },  // gpt-4o-mini estimate
  fj:       { in: 0.80,  out: 4.00  },  // proxy: haiku rates
  "fj.mcp": { in: 0.80,  out: 4.00  },
};

function computeStepCost(tool: string, inp: number, out: number): number {
  const tier = inferModel(tool);
  const rates = COST_RATES[tier] ?? COST_RATES["haiku"];
  return (inp / 1e6) * rates.in + (out / 1e6) * rates.out;
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

/** Write content to a temp file; return its path. Caller must unlink when done. */
async function writeTmp(content: string): Promise<string> {
  const tmpPath = `/tmp/tm-executor-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  await fs.promises.writeFile(tmpPath, content, "utf8");
  return tmpPath;
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
  // Apply --code-with override (e.g. force all LLM steps through codex)
  const effectiveTool = applyCodeWithOverride(step.tool);
  if (effectiveTool !== step.tool) {
    console.log(`  [code-with] ${step.tool} → ${effectiveTool}`);
  }
  const stepTool = { ...step, tool: effectiveTool };
  const stepName = stepTool.name || stepTool.tool;

  const resultBase: Omit<StepResult, "status"> = {
    phase: phase.name,
    stepName,
    tool: stepTool.tool,
    startedAt,
    endedAt: startedAt,
    durationMs: 0,
  };

  const phasePrefix = `[${phase.name}]`;
  const label = `${phasePrefix} ${stepName} (${stepTool.tool})`;

  console.log(`\n🚀 ${label}`);

  const perStepTimeout =
    typeof step.args?.timeoutSeconds === "number"
      ? step.args.timeoutSeconds
      : constraints.maxRuntimeSeconds ?? 600;

  let command = "";
  let stdout = "";
  let stderr = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    switch (stepTool.tool) {
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

      // bash.check: zero-token validation step — runs a shell command and reports pass/fail.
      // Use for lint, JSON validity, URL probes, file existence, grep checks — anything that
      // doesn't need an LLM. Plans should prefer this over haiku/codex for any verifiable assertion.
      case "bash.check": {
        const checkCmd = step.args?.command;
        if (!checkCmd || typeof checkCmd !== "string") {
          throw new Error("bash.check step requires args.command:string");
        }
        command = checkCmd;
        console.log(`✔ check: ${checkCmd}`);
        try {
          const out = await runCommand(checkCmd, perStepTimeout);
          stdout = out.stdout;
          stderr = out.stderr;
          if (stdout || stderr) console.log((stdout + stderr).trim().substring(0, 400));
        } catch (err: any) {
          // Non-zero exit: report but don't throw — let constraints.stopOnError decide
          stdout = err.stdout ?? "";
          stderr = err.stderr ?? "";
          const combined = (stdout + stderr).trim();
          console.warn(`  ✗ check failed (exit ${err.code ?? "?"}):\n${combined.substring(0, 600)}`);
          return {
            ...resultBase,
            status: "failed",
            endedAt: nowIso(),
            durationMs: Date.now() - start,
            command,
            stdout,
            stderr,
            errorMessage: `exit ${err.code ?? "nonzero"}: ${combined.substring(0, 200)}`,
          };
        }
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
        const writeTmpFile = await writeTmp(description);
        command = `cat "${writeTmpFile}" | codex exec --full-auto`;
        if (target) command += ` -- ${JSON.stringify(target)}`;
        console.log(`$ ${command.replace(writeTmpFile, '<prompt>')}`);
        try {
          const out = await runCommand(command, perStepTimeout);
          stdout = out.stdout;
          stderr = out.stderr;
          // Estimate tokens from prompt + response length (codex CLI has no token output)
          inputTokens = Math.ceil(description.length / 4);
          outputTokens = Math.ceil(stdout.length / 4);
        } finally {
          await fs.promises.unlink(writeTmpFile).catch(() => {});
        }
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
        const patchPrompt = step.args?.prompt ?? step.description ?? stepName;
        const patchTmp = await writeTmp(patchPrompt);
        // codex reads prompt from stdin; --approval-mode full-auto for non-interactive
        command = `cat "${patchTmp}" | codex exec --full-auto`;
        if (patchTarget) command += ` -- ${JSON.stringify(patchTarget)}`;
        console.log(`$ ${command.replace(patchTmp, '<prompt>')}`);
        try {
          const out = await runCommand(command, perStepTimeout);
          stdout = out.stdout;
          stderr = out.stderr;
          // Estimate tokens from prompt + response length (codex CLI has no token output)
          inputTokens = Math.ceil(patchPrompt.length / 4);
          outputTokens = Math.ceil(stdout.length / 4);
        } finally {
          await fs.promises.unlink(patchTmp).catch(() => {});
        }
        break;
      }

      case "fj.mcp": {
        // Use real FluffyJaws MCP via the file-based bridge (parent CC session fulfills)
        const fjMcpQuery = step.args?.query ?? step.description ?? stepName;
        const fjMcpTarget = (step.args?.target as string | undefined) ?? (() => {
          const m = fjMcpQuery.match(/\b(blocks\/[\w-]+\/[\w.-]+|demo\/[\w-]+\.html|models\/[\w.-]+\.json)/);
          return m?.[1];
        })();
        const fjTool = (step.args?.fjTool as string | undefined) ?? "fluffyjaws_chat";
        const bridgeStepId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        console.log(`  🌐 fj.mcp [${fjTool}]: ${fjMcpQuery.substring(0, 60)}`);
        // Bridge timeout 120s — gives cron at least one full fire window
        const res = await mcpRequest(
          { stepId: bridgeStepId, tool: fjTool, args: { message: fjMcpQuery }, targetFile: fjMcpTarget, description: stepName },
          120_000,
        );
        if (res.status === "error") throw new Error(res.errorMessage ?? "fj.mcp bridge returned error");
        stdout = res.content ?? "";
        // Estimate tokens from query + response (bridge is a black box)
        inputTokens = Math.ceil(fjMcpQuery.length / 4);
        outputTokens = Math.ceil(stdout.length / 4);
        if (fjMcpTarget && stdout) {
          await fs.promises.mkdir(path.dirname(path.resolve(fjMcpTarget)), { recursive: true });
          await fs.promises.writeFile(fjMcpTarget, stdout, "utf8");
          console.log(`  → wrote to ${fjMcpTarget}`);
        }
        break;
      }

      case "fj.snippet": {
        // Auto-route through MCP bridge when the parent session has real FJ access
        if (isBridgeActive()) {
          return handleStep(phase, { ...step, tool: "fj.mcp" }, constraints);
        }
        const query = step.args?.query ?? step.description ?? stepName;
        // Explicit target wins; fall back to extracting a file path from the query string
        const extractedTarget = (() => {
          const m = query.match(/\b(blocks\/[\w-]+\/[\w.-]+|demo\/[\w-]+\.html|models\/[\w.-]+\.json)/);
          return m?.[1];
        })();
        const target = (step.args?.target as string | undefined) ?? extractedTarget;
        const fjPrompt = `You are an AEM Edge Delivery Services expert. Output ONLY the requested code or JSON, no explanation, no markdown fences.\n\nRequest: ${query}`;
        const fjTmp = await writeTmp(fjPrompt);
        command = `claude -p --model claude-haiku-4-5-20251001 --output-format json < "${fjTmp}"`;
        console.log(`  🔍 fj.snippet: ${query.substring(0, 60)}`);
        try {
          const fjOut = await runCommand(command, perStepTimeout);
          stderr = fjOut.stderr;
          try {
            const fjParsed = JSON.parse(fjOut.stdout.trim());
            stdout = typeof fjParsed.result === "string" ? fjParsed.result : fjOut.stdout.trim();
            const fjUsage = fjParsed.usage ?? {};
            inputTokens = (fjUsage.input_tokens ?? 0) + (fjUsage.cache_creation_input_tokens ?? 0);
            outputTokens = fjUsage.output_tokens ?? 0;
          } catch {
            stdout = fjOut.stdout.trim();
          }
        } finally {
          await fs.promises.unlink(fjTmp).catch(() => {});
        }
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
        const llmTmp = await writeTmp(llmPrompt);
        command = `claude -p ${modelFlag} --output-format json --permission-mode acceptEdits < "${llmTmp}"`.trim();
        console.log(`  🤖 ${step.tool}: ${llmPrompt.substring(0, 60)}...`);
        try {
          const llmOut = await runCommand(command, perStepTimeout);
          stderr = llmOut.stderr;
          try {
            const parsed = JSON.parse(llmOut.stdout.trim());
            stdout = typeof parsed.result === "string" ? parsed.result : llmOut.stdout;
            const usage = parsed.usage ?? {};
            inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
            outputTokens = usage.output_tokens ?? 0;
            if (inputTokens || outputTokens) {
              console.log(`  📊 tokens: ${inputTokens}in ${outputTokens}out (~$${computeStepCost(step.tool, inputTokens, outputTokens).toFixed(5)})`);
            }
          } catch {
            stdout = llmOut.stdout;
          }
        } finally {
          await fs.promises.unlink(llmTmp).catch(() => {});
        }
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

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const logFile = path.join(
      LOG_DIR,
      `${sanitize(phase.name)}__${sanitize(stepName)}.log`
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
      ...(inputTokens > 0 && { inputTokens, outputTokens }),
    };
  } catch (err: any) {
    const endedAt = nowIso();
    const durationMs = Date.now() - start;
    const message =
      err?.message || (typeof err === "string" ? err : "Unknown error");

    console.error(`❌ ${label} failed: ${message}`);

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const logFile = path.join(
      LOG_DIR,
      `${sanitize(phase.name)}__${sanitize(stepName)}.log`
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
      ...(inputTokens > 0 && { inputTokens, outputTokens }),
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
  inputTokens?: number;
  outputTokens?: number;
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
  tokenUsage?: { inputTokens: number; outputTokens: number };
  approxCostUsd?: number;
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

    // Accumulate token usage across all steps
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    for (const r of results) {
      if (r.inputTokens) {
        totalInputTokens += r.inputTokens;
        totalOutputTokens += r.outputTokens ?? 0;
        totalCostUsd += computeStepCost(r.tool, r.inputTokens, r.outputTokens ?? 0);
      }
    }

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
        ...(r.inputTokens !== undefined && { inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
      })),
      totalDurationMs,
      failedSteps: failed.length,
      skippedSteps: skipped.length,
      escalations,
      ...(totalInputTokens > 0 && {
        tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        approxCostUsd: parseFloat(totalCostUsd.toFixed(6)),
      }),
    };

    if (failed.length >= 2) {
      runRecord.escalationRecommended = true;
      console.log(`\x1b[33m⚡ Next run may benefit from a higher model tier (${failed.length} steps failed)\x1b[0m`);
    }

    await appendRunRecord(runRecord);

    if (totalInputTokens > 0) {
      const opusEst = (totalInputTokens / 1e6) * 15 + (totalOutputTokens / 1e6) * 75;
      const saved = opusEst > 0 ? Math.round((1 - totalCostUsd / opusEst) * 100) : 0;
      console.log(`\n💰 tokens: ${totalInputTokens}in ${totalOutputTokens}out  cost: ~$${totalCostUsd.toFixed(4)}  opus4 est: ~$${opusEst.toFixed(4)}  saved: ~${saved}%`);
    }

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
