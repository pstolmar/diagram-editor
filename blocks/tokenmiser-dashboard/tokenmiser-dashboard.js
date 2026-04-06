const RUNS_URL = '/.tokenmiser/runs.json';
const REFRESH_MS = 30000;

// Opus 4 Extended pricing per million tokens
const OPUS_INPUT_PER_M = 15;
const OPUS_OUTPUT_PER_M = 75;

function relativeTime(ts) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  return `${diffDay} days ago`;
}

function opusCost(run) {
  const usage = run.tokenUsage;
  if (usage && usage.inputTokens != null && usage.outputTokens != null) {
    return (usage.inputTokens / 1e6) * OPUS_INPUT_PER_M
      + (usage.outputTokens / 1e6) * OPUS_OUTPUT_PER_M;
  }
  // fallback: estimate Opus as 5× actual cost
  return parseFloat(run.approxCostUsd || 0) * 5;
}

function inferModel(run) {
  const steps = run.steps || [];
  if (steps.length > 0 && steps[0].model) {
    const m = steps[0].model.toLowerCase();
    if (m.includes('haiku')) return 'haiku';
    if (m.includes('opus')) return 'opus';
    return 'sonnet';
  }
  const miser = parseInt(run.miserLevel || 0, 10);
  if (miser >= 8) return 'haiku';
  return 'sonnet';
}

function stepSummary(run) {
  const steps = run.steps || [];
  const ok = steps.filter((s) => s.status === 'ok' || s.status === 'done').length;
  const fail = steps.filter((s) => s.status === 'fail' || s.status === 'error').length;
  const skip = steps.filter((s) => s.status === 'skip').length;
  const total = steps.length;
  if (total === 0) return '—';
  return `${ok} ok / ${fail} fail / ${skip} skip`;
}

function statusBadge(run) {
  const { status } = run;
  if (status === 'escalated') return '<span class="tm-badge tm-badge-warn">⚡ escalated</span>';
  if (status === 'failed' || status === 'error') return '<span class="tm-badge tm-badge-fail">✗ failed</span>';
  return '<span class="tm-badge tm-badge-ok">✓ ok</span>';
}

function formatCost(val) {
  const n = parseFloat(val || 0);
  if (Number.isNaN(n)) return '$?.??';
  return `$${n.toFixed(4)}`;
}

function renderDashboard(block, runs) {
  const totalCost = runs.reduce((s, r) => s + parseFloat(r.approxCostUsd || 0), 0);
  const totalOpus = runs.reduce((s, r) => s + opusCost(r), 0);
  const saved = totalOpus - totalCost;
  const savedPct = totalOpus > 0 ? Math.round((saved / totalOpus) * 100) : 0;

  const sorted = [...runs].reverse();

  const rows = sorted.map((run, i) => {
    const actualCost = parseFloat(run.approxCostUsd || 0);
    const opus = opusCost(run);
    const runSaved = opus - actualCost;
    const runPct = opus > 0 ? Math.round((runSaved / opus) * 100) : 0;
    const jobLabel = (run.jobId || '—').substring(0, 24);
    const timeStr = run.timestamp ? relativeTime(run.timestamp) : '—';

    return `
      <tr>
        <td class="tm-num">${runs.length - i}</td>
        <td class="tm-time">${timeStr}</td>
        <td class="tm-job" title="${run.jobId || ''}">${jobLabel}</td>
        <td class="tm-model">${inferModel(run)}</td>
        <td class="tm-steps">${stepSummary(run)}</td>
        <td class="tm-cost">${formatCost(run.approxCostUsd)}</td>
        <td class="tm-saved">$${runSaved.toFixed(4)} <span class="tm-pct">(${runPct}%)</span></td>
        <td class="tm-status">${statusBadge(run)}</td>
      </tr>`;
  }).join('');

  const emptyRow = runs.length === 0
    ? '<tr><td colspan="8" class="tm-empty">No runs found. Run tokenmiser to see data here.</td></tr>'
    : '';

  block.innerHTML = `
    <div class="tm-dashboard">
      <div class="tm-header">
        <h2 class="tm-title">Tokenmiser Runs</h2>
        <div class="tm-header-stats">
          <span class="tm-badge tm-badge-info">${runs.length} runs</span>
          <span class="tm-stat">Total: <strong>${formatCost(totalCost)}</strong></span>
          <span class="tm-stat tm-stat-savings">Saved: <strong>$${saved.toFixed(2)}</strong> <span class="tm-pct">(${savedPct}% vs Opus 4)</span></span>
        </div>
      </div>
      <div class="tm-table-wrap">
        <table class="tm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Job</th>
              <th>Model</th>
              <th>Steps</th>
              <th>Cost</th>
              <th>Savings</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${emptyRow}${rows}
          </tbody>
        </table>
      </div>
      <div class="tm-footer">Powered by Tokenmiser v2 · MISER routing active</div>
    </div>`;
}

async function fetchRuns() {
  try {
    const resp = await fetch(RUNS_URL);
    if (!resp.ok) return [];
    const text = await resp.text();
    return text.split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default async function decorate(block) {
  const runs = await fetchRuns();
  renderDashboard(block, runs);

  setInterval(async () => {
    const fresh = await fetchRuns();
    renderDashboard(block, fresh);
  }, REFRESH_MS);
}
