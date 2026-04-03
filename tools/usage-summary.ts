import * as fs from "fs";
import * as path from "path";

type UsageRow = {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
  task: string;
};

function parseCsvLine(header: string[], line: string): UsageRow | null {
  if (!line.trim() || line.startsWith("#")) return null;
  const cols = line.split(",").map((c) => c.trim());
  const map: Record<string, string> = {};
  header.forEach((h, i) => {
    map[h] = cols[i] ?? "";
  });

  const num = (k: string): number =>
    map[k] ? Number(map[k]) || 0 : 0;

  return {
    timestamp: map["timestamp"],
    model: map["model"],
    inputTokens: num("inputTokens"),
    outputTokens: num("outputTokens"),
    cacheReadInputTokens: num("cacheReadInputTokens"),
    cacheCreationInputTokens: num("cacheCreationInputTokens"),
    costUSD: num("costUSD"),
    task: map["task"] || "",
  };
}

function loadUsageCsv(csvPath: string): UsageRow[] {
  if (!fs.existsSync(csvPath)) {
    console.error(`No usage CSV found at ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) {
    console.error(`Usage CSV at ${csvPath} has no data`);
    process.exit(1);
  }

  const header = lines[0].split(",").map((h) => h.trim());
  const rows: UsageRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(header, lines[i]);
    if (row) rows.push(row);
  }

  return rows;
}

function summarize(rows: UsageRow[]) {
  if (rows.length === 0) {
    console.log("No usage rows to summarize.");
    return;
  }

  const byDay: Record<
    string,
    {
      count: number;
      totalCost: number;
      totalInput: number;
      totalOutput: number;
      models: Record<string, number>;
    }
  > = {};

  for (const r of rows) {
    const day = r.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!byDay[day]) {
      byDay[day] = {
        count: 0,
        totalCost: 0,
        totalInput: 0,
        totalOutput: 0,
        models: {},
      };
    }
    const d = byDay[day];
    d.count += 1;
    d.totalCost += r.costUSD;
    d.totalInput += r.inputTokens + r.cacheCreationInputTokens + r.cacheReadInputTokens;
    d.totalOutput += r.outputTokens;
    d.models[r.model] = (d.models[r.model] || 0) + 1;
  }

  console.log("=== Claude Planning Usage Summary ===\n");

  const days = Object.keys(byDay).sort();
  for (const day of days) {
    const d = byDay[day];
    const avgCost = d.totalCost / d.count;
    console.log(`Date: ${day}`);
    console.log(`  Jobs planned:   ${d.count}`);
    console.log(`  Total cost:     $${d.totalCost.toFixed(4)} (Claude-reported)`);
    console.log(`  Avg cost/job:   $${avgCost.toFixed(4)}`);
    console.log(`  Total tokens in: ${d.totalInput} (incl. cache)`);
    console.log(`  Total tokens out: ${d.totalOutput}`);
    console.log(
      `  Models used:    ${Object.entries(d.models)
        .map(([m, c]) => `${m} x${c}`)
        .join(", ")}`
    );
    console.log("");
  }

  console.log("Note: costUSD is from Claude's modelUsage; Adobe internal billing is ~10% lower, but this is perfect for before/after comparisons.");
}

function main() {
  const csvPath =
    process.argv[2] ||
    path.join(process.cwd(), ".claude", "claudium-usage.csv");

  const rows = loadUsageCsv(csvPath);
  summarize(rows);
}

main();
