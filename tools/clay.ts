#!/usr/bin/env -S npx tsx

import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

type EngineConfig = {
  type: "claude_harness" | "gpt_api" | "fluffyjaws_api";
  cmd?: string;
  defaultModel?: string;
  model?: string;
  endpoint?: string;
};

type RepoConfig = {
  name: string;
  path: string;
  planFiles: string[];
  engine?: string;
};

type RoutingRule = {
  pattern: string; // simple regex on task description
  engine: string;
};

type Config = {
  repos: RepoConfig[];
  engines: Record<string, EngineConfig>;
  routing: {
    defaultEngine: string;
    rules: RoutingRule[];
  };
};

type Task = {
  description: string;
  repo?: RepoConfig;
};

function loadConfig(): Config {
  const configPath = join(process.env.HOME || "", ".clay", "config.json");
  if (!existsSync(configPath)) {
    console.error(`No config at ${configPath}. Create it first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function pickRepo(config: Config, cwd: string): RepoConfig | undefined {
  return config.repos.find((r) => cwd.startsWith(r.path));
}

function pickEngine(config: Config, task: Task): string {
  const text = task.description;
  for (const rule of config.routing.rules) {
    const re = new RegExp(rule.pattern, "i");
    if (re.test(text)) return rule.engine;
  }
  const repoEngine = task.repo?.engine;
  if (repoEngine && config.engines[repoEngine]) return repoEngine;
  return config.routing.defaultEngine;
}

function runClaudeHarness(repo: RepoConfig, task: Task): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = "./claudium";
    const cwd = repo.path;
    const args = task.description ? [task.description] : [];
    console.log(`🚀 [clay] Running Claude harness in ${cwd}: ${cmd} ${args.join(" ")}`);
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`claudium exited with code ${code}`));
    });
  });
}

// Stub engines for now
async function runGptEngine(task: Task, engine: EngineConfig): Promise<void> {
  console.log(`⚠️ [clay] GPT engine not wired yet. Would handle: "${task.description}" with model ${engine.model}`);
}

async function runFluffyjawsEngine(task: Task, engine: EngineConfig): Promise<void> {
  console.log(`⚠️ [clay] FluffyJaws engine not wired yet. Would handle: "${task.description}" via ${engine.endpoint}`);
}

async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();
  const cwd = process.cwd();

  if (args[0] === "scan") {
    console.log("📂 Repos and plan files:");
    for (const repo of config.repos) {
      console.log(`- ${repo.name} (${repo.path})`);
      for (const pf of repo.planFiles) {
        const full = join(repo.path, pf);
        console.log(`  ${existsSync(full) ? "✅" : "❌"} ${pf}`);
      }
    }
    return;
  }

  // Default: run task in current repo
  const repo = pickRepo(config, cwd);
  const description = args.length ? args.join(" ") : "Run PLAN.md for this repo";
  const task: Task = { description, repo };

  const engineName = pickEngine(config, task);
  const engine = config.engines[engineName];
  if (!engine) {
    console.error(`No engine config for "${engineName}"`);
    process.exit(1);
  }

  console.log(`🧠 [clay] Task: "${description}"`);
  console.log(`🧠 [clay] Repo: ${repo ? repo.name : "(none matched)"}`);
  console.log(`🧠 [clay] Engine: ${engineName} (${engine.type})`);

  if (engine.type === "claude_harness") {
    if (!repo) {
      console.error("No repo matched current directory for Claude harness.");
      process.exit(1);
    }
    await runClaudeHarness(repo, task);
  } else if (engine.type === "gpt_api") {
    await runGptEngine(task, engine);
  } else if (engine.type === "fluffyjaws_api") {
    await runFluffyjawsEngine(task, engine);
  }
}

main().catch((err) => {
  console.error("💥 [clay] Error:", err.message);
  process.exit(1);
});
