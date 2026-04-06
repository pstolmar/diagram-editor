// Try public path first (works with aem up), fall back to hidden dir (works on live site)
const RUNS_URLS = ['/tokenmiser-data/runs.json', '/.tokenmiser/runs.json'];
const REFRESH_MS = 30000;

// Opus 4 Extended pricing per million tokens
const OPUS_INPUT_PER_M = 15;
const OPUS_OUTPUT_PER_M = 75;

function relativeTime(ts) {
  if (!ts) return '—';
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
  if (miser === 11) return 'haiku';
  return run.modelTier || 'sonnet';
}

function stepSummary(run) {
  const steps = run.steps || [];
  const ok = steps.filter((s) => s.status === 'ok' || s.status === 'done').length;
  const fail = steps.filter((s) => s.status === 'fail' || s.status === 'failed' || s.status === 'error').length;
  const skip = steps.filter((s) => s.status === 'skip' || s.status === 'skipped').length;
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

function getTs(run) {
  return run.completedAt || run.startedAt || run.timestamp || null;
}

/** Extract a short readable description from a jobId like 20260406_091540_feat_phase3_dash */
function jobDesc(jobId) {
  // Strip leading date/time prefix (YYYYMMDD_HHMMSS_)
  const noDate = jobId.replace(/^\d{8}_\d{6}_/, '');
  // Convert underscores to spaces, title-case, limit to 5 words
  const words = noDate.replace(/_/g, ' ').split(' ').slice(0, 5);
  return words.join(' ') || jobId.substring(0, 28);
}

/** Extract YYYY-MM-DD from jobId or timestamp */
function jobDate(jobId, ts) {
  const m = jobId.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (ts) return ts.substring(0, 10);
  return '';
}

function renderHeroStats(runs) {
  const totalCost = runs.reduce((s, r) => s + parseFloat(r.approxCostUsd || 0), 0);
  const totalOpus = runs.reduce((s, r) => s + opusCost(r), 0);
  const saved = totalOpus - totalCost;
  const savedPct = totalOpus > 0 ? Math.round((saved / totalOpus) * 100) : 0;

  return `
    <div class="tm-hero">
      <div class="tm-hero-stat tm-hero-stat-savings">
        <div class="tm-hero-value">${savedPct}<span class="tm-hero-unit">%</span></div>
        <div class="tm-hero-label">saved vs Opus 4 Extended</div>
      </div>
      <div class="tm-hero-stat tm-hero-stat-saved">
        <div class="tm-hero-value">$<span class="tm-hero-num">${saved.toFixed(2)}</span></div>
        <div class="tm-hero-label">total saved (${runs.length} runs)</div>
      </div>
      <div class="tm-hero-stat tm-hero-stat-cost">
        <div class="tm-hero-value">$<span class="tm-hero-num">${totalCost.toFixed(4)}</span></div>
        <div class="tm-hero-label">actual spend</div>
      </div>
      <div class="tm-hero-stat tm-hero-stat-opus">
        <div class="tm-hero-value">$<span class="tm-hero-num">${totalOpus.toFixed(2)}</span></div>
        <div class="tm-hero-label">Opus 4 would have cost</div>
      </div>
    </div>`;
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
    const timeStr = relativeTime(getTs(run));
    const desc = run.description || jobDesc(run.jobId || '');
    const dateStr = jobDate(run.jobId || '', getTs(run));

    return `
      <tr>
        <td class="tm-num">${runs.length - i}</td>
        <td class="tm-time">${timeStr}<br><span class="tm-date">${dateStr}</span></td>
        <td class="tm-desc" title="${run.jobId || ''}">${desc}</td>
        <td class="tm-model">${inferModel(run)}</td>
        <td class="tm-steps">${stepSummary(run)}</td>
        <td class="tm-cost">${formatCost(run.approxCostUsd)}</td>
        <td class="tm-saved">$${runSaved.toFixed(4)} <span class="tm-pct">(${runPct}%)</span></td>
        <td class="tm-status">${statusBadge(run)}</td>
      </tr>`;
  }).join('');

  const emptyRow = runs.length === 0
    ? '<tr><td colspan="8" class="tm-empty">No runs found. Run <code>t</code> to see data here.</td></tr>'
    : '';

  block.innerHTML = `
    <div class="tm-dashboard">
      <div class="tm-header">
        <h2 class="tm-title">TokenMiser Runs</h2>
        <div class="tm-header-meta">
          <span class="tm-badge tm-badge-info">${runs.length} run${runs.length !== 1 ? 's' : ''}</span>
          <span class="tm-stat tm-stat-savings">
            <strong>${savedPct}% saved</strong> · $${saved.toFixed(2)} vs Opus 4
          </span>
        </div>
      </div>
      ${renderHeroStats(runs)}
      <div class="tm-table-wrap">
        <table class="tm-table">
          <thead>
            <tr>
              <th>#</th><th>Time</th><th>Task</th><th>Model</th>
              <th>Steps</th><th>Cost</th><th>Savings</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${emptyRow}${rows}</tbody>
        </table>
      </div>
      <div class="tm-footer">Powered by TokenMiser v2 · MISER routing active</div>
    </div>`;
}

function parseNdjson(text) {
  return text.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

async function tryFetchUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) return [];
  return parseNdjson(await resp.text());
}

async function fetchRuns() {
  return tryFetchUrl(RUNS_URLS[0])
    .then((runs) => (runs.length > 0 ? runs : tryFetchUrl(RUNS_URLS[1])))
    .catch(() => tryFetchUrl(RUNS_URLS[1]).catch(() => []));
}

export default async function decorate(block) {
  const runs = await fetchRuns();
  renderDashboard(block, runs);

  setInterval(async () => {
    const fresh = await fetchRuns();
    renderDashboard(block, fresh);
  }, REFRESH_MS);
}
