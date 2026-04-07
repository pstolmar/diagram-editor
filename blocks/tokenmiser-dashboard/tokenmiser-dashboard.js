// Try public path first (works with aem up), fall back to hidden dir (works on live site)
const RUNS_URLS = ['/tokenmiser-data/runs.json', '/.tokenmiser/runs.json'];
const REFRESH_MS = 30000;
const LIVE_REFRESH_MS = 5000;
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours → treat as abandoned

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

function fmtDuration(ms) {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function elapsedStr(startedAt) {
  if (!startedAt) return '';
  const ms = Date.now() - new Date(startedAt).getTime();
  return fmtDuration(ms);
}

function isStale(run) {
  if (!run.startedAt) return false;
  return (Date.now() - new Date(run.startedAt).getTime()) > STALE_THRESHOLD_MS;
}

function renderLiveBar(activeRuns) {
  if (activeRuns.length === 0) {
    return `<div class="tm-live-bar tm-live-idle">
      <span class="tm-live-dot tm-live-dot-idle"></span>
      <span class="tm-live-label">idle</span>
      <span class="tm-live-meta">no jobs running</span>
    </div>`;
  }
  const items = activeRuns.map((run) => {
    const stale = isStale(run);
    const stateClass = stale ? 'tm-live-stale' : 'tm-live-active';
    const stateLabel = stale ? 'abandoned?' : 'running';
    const desc = run.description || jobDesc(run.jobId || '');
    const elapsed = elapsedStr(run.startedAt);
    return `<div class="tm-live-job ${stateClass}">
      <span class="tm-live-dot ${stale ? 'tm-live-dot-stale' : 'tm-live-dot-pulse'}"></span>
      <span class="tm-live-tag">${stateLabel}</span>
      <span class="tm-live-desc">${desc}</span>
      <span class="tm-live-elapsed" data-started="${run.startedAt || ''}">${elapsed}</span>
      <span class="tm-live-meta">MISER=${run.miserLevel ?? '?'} · ${run.modelTier || '?'}</span>
    </div>`;
  }).join('');
  return `<div class="tm-live-bar tm-live-busy">${items}</div>`;
}

function renderDetail(run) {
  const inp = run.tokenUsage?.inputTokens || 0;
  const out = run.tokenUsage?.outputTokens || 0;
  const cacheRead = run.tokenUsage?.cacheReadTokens || 0;
  const cacheWrite = run.tokenUsage?.cacheWriteTokens || 0;
  const totalTok = inp + out;
  const actualCost = parseFloat(run.approxCostUsd || 0);
  const opus = opusCost(run);
  const durationMs = run.totalDurationMs
    || (run.completedAt && run.startedAt
      ? new Date(run.completedAt) - new Date(run.startedAt)
      : 0);

  // Cost per-model breakdown
  const costIn = (inp / 1e6) * (run.modelTier === 'haiku' ? 0.25 : 3);
  const costOut = (out / 1e6) * (run.modelTier === 'haiku' ? 1.25 : 15);

  // Step breakdown
  const steps = run.steps || [];
  const toolCounts = steps.reduce((acc, s) => {
    acc[s.tool] = (acc[s.tool] || 0) + 1;
    return acc;
  }, {});
  const toolBreakdown = Object.entries(toolCounts)
    .map(([tool, n]) => `<span class="tm-step-tool tm-step-tool-${tool}">${tool}×${n}</span>`)
    .join(' ');

  const stepRows = steps.map((s) => {
    let icon = '⏭️';
    if (s.status === 'ok') icon = '✅';
    else if (s.status === 'failed') icon = '❌';
    return `<div class="tm-step-entry">
      <span class="tm-step-icon">${icon}</span>
      <span class="tm-step-tool tm-step-tool-${s.tool}">${s.tool}</span>
      <span>${s.name || '—'}</span>
      <span class="tm-step-dur">${fmtDuration(s.durationMs)}</span>
    </div>`;
  }).join('');

  const noSteps = steps.length === 0
    ? '<span style="color:var(--tm-muted);font-style:italic">No step detail (pre-executor run)</span>'
    : '';

  const escalations = (run.escalations || []).map((e) => `<div>⚡ ${e}</div>`).join('');

  return `<div class="tm-detail-inner">
    <div class="tm-detail-section">
      <div class="tm-detail-label">🔀 Routing &amp; config</div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">model tier</span><span class="tm-detail-val">${run.modelTier || inferModel(run)}</span></div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">MISER level</span><span class="tm-detail-val">${run.miserLevel ?? '—'}</span></div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">status</span><span class="tm-detail-val">${run.status || '—'}</span></div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">wall time</span><span class="tm-detail-val">${fmtDuration(durationMs)}</span></div>
      ${run.escalationRecommended ? '<div class="tm-detail-row-entry"><span class="tm-detail-key">note</span><span style="color:var(--tm-yellow)">⚡ escalation recommended next run</span></div>' : ''}
      ${escalations ? `<div class="tm-detail-row-entry"><span class="tm-detail-key">escalations</span><span class="tm-detail-val">${escalations}</span></div>` : ''}
    </div>
    <div class="tm-detail-section">
      <div class="tm-detail-label">💰 Token &amp; cost breakdown</div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">input tokens</span><span class="tm-detail-val">${fmtTokens(inp)} <span style="color:var(--tm-muted)">($${costIn.toFixed(4)})</span></span></div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">output tokens</span><span class="tm-detail-val">${fmtTokens(out)} <span style="color:var(--tm-muted)">($${costOut.toFixed(4)})</span></span></div>
      ${cacheRead ? `<div class="tm-detail-row-entry"><span class="tm-detail-key">cache read</span><span class="tm-detail-val">${fmtTokens(cacheRead)}</span></div>` : ''}
      ${cacheWrite ? `<div class="tm-detail-row-entry"><span class="tm-detail-key">cache write</span><span class="tm-detail-val">${fmtTokens(cacheWrite)}</span></div>` : ''}
      <div class="tm-detail-row-entry"><span class="tm-detail-key">total tokens</span><span class="tm-detail-val">${fmtTokens(totalTok)}</span></div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">actual cost</span><span class="tm-detail-val">${formatCost(run.approxCostUsd)}</span></div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">Opus4 equiv</span><span class="tm-detail-val">$${opus.toFixed(4)}</span></div>
      <div class="tm-detail-row-entry"><span class="tm-detail-key">saved</span><span class="tm-detail-val tm-detail-val-hi">$${(opus - actualCost).toFixed(4)} (${opus > 0 ? Math.round(((opus - actualCost) / opus) * 100) : 0}%)</span></div>
    </div>
    <div class="tm-detail-section">
      <div class="tm-detail-label">⚡ Step breakdown (${steps.length})</div>
      ${toolBreakdown ? `<div style="margin-bottom:0.5rem;display:flex;flex-wrap:wrap;gap:0.25rem">${toolBreakdown}</div>` : ''}
      <div class="tm-step-list">${stepRows}${noSteps}</div>
    </div>
  </div>`;
}

function wireInteractions(block, openRidRef) {
  // Accordion
  block.querySelectorAll('.tm-run-row').forEach((tr) => {
    tr.addEventListener('click', () => {
      const { rid } = tr.dataset;
      const detail = block.querySelector(`#${rid}`);
      if (!detail) return;
      const isOpen = !detail.classList.contains('is-hidden');
      block.querySelectorAll('.tm-detail-row').forEach((d) => d.classList.add('is-hidden'));
      block.querySelectorAll('.tm-run-row').forEach((r) => r.classList.remove('is-expanded'));
      if (!isOpen) {
        detail.classList.remove('is-hidden');
        tr.classList.add('is-expanded');
        openRidRef.value = rid;
      } else {
        openRidRef.value = null;
      }
    });
  });

  // Marquee: measure real overflow with JS, scroll exactly that far
  block.querySelectorAll('.tm-desc').forEach((td) => {
    const text = td.querySelector('.tm-desc-text');
    if (!text) return;
    td.addEventListener('mouseenter', () => {
      const overflow = text.scrollWidth - text.clientWidth;
      if (overflow <= 4) return; // nothing hidden
      text.style.setProperty('--tm-overflow', `-${overflow}px`);
      text.classList.add('is-scrolling');
    });
    td.addEventListener('mouseleave', () => {
      text.classList.remove('is-scrolling');
      text.style.removeProperty('--tm-overflow');
    });
  });
}

function renderDashboard(block, runs, openRidRef) {
  const activeRuns = runs.filter((r) => r.status === 'running' && !isStale(r));
  const completedRuns = runs.filter((r) => r.status !== 'running' || isStale(r));
  const totalCost = completedRuns.reduce((s, r) => s + parseFloat(r.approxCostUsd || 0), 0);
  const totalOpus = runs.reduce((s, r) => s + opusCost(r), 0);
  const saved = totalOpus - totalCost;
  const savedPct = totalOpus > 0 ? Math.round((saved / totalOpus) * 100) : 0;

  const sorted = [...completedRuns].reverse();

  const rowPairs = sorted.map((run, i) => {
    const actualCost = parseFloat(run.approxCostUsd || 0);
    const opus = opusCost(run);
    const runSaved = opus - actualCost;
    const runPct = opus > 0 ? Math.round((runSaved / opus) * 100) : 0;
    const timeStr = relativeTime(getTs(run));
    const desc = run.description || jobDesc(run.jobId || '');
    const dateStr = jobDate(run.jobId || '', getTs(run));
    const rid = `tm-run-${i}`;

    return `
      <tr class="tm-run-row" data-rid="${rid}" title="Click to expand run detail">
        <td class="tm-num">${runs.length - i}</td>
        <td class="tm-time">${timeStr}<span class="tm-date">${dateStr}</span></td>
        <td class="tm-desc" title="${desc} · ${run.jobId || ''}">
          <span class="tm-desc-text">${desc}</span>
          <span class="tm-desc-full" aria-hidden="true">${desc}</span>
        </td>
        <td class="tm-model">${inferModel(run)}</td>
        <td class="tm-steps">${stepSummary(run)}</td>
        <td class="tm-cost">${formatCost(run.approxCostUsd)}</td>
        <td class="tm-saved">$${runSaved.toFixed(4)} <span class="tm-pct">(${runPct}%)</span></td>
        <td class="tm-status">${statusBadge(run)}</td>
      </tr>
      <tr class="tm-detail-row is-hidden" id="${rid}">
        <td colspan="8">${renderDetail(run)}</td>
      </tr>`;
  }).join('');

  const emptyRow = completedRuns.length === 0
    ? '<tr><td colspan="8" class="tm-empty">No completed runs. Run <code>t</code> to see data here.</td></tr>'
    : '';

  block.innerHTML = `
    <div class="tm-dashboard">
      <div class="tm-header">
        <h2 class="tm-title">TokenMiser Runs</h2>
        <div class="tm-header-meta">
          <span class="tm-badge tm-badge-info">${completedRuns.length} run${completedRuns.length !== 1 ? 's' : ''}</span>
          ${activeRuns.length > 0 ? `<span class="tm-badge tm-badge-live">⚡ ${activeRuns.length} running</span>` : ''}
          <span class="tm-stat tm-stat-savings">
            <strong>${savedPct}% saved</strong> · $${saved.toFixed(2)} vs Opus 4
          </span>
        </div>
      </div>
      ${renderLiveBar(activeRuns)}
      ${renderHeroStats(completedRuns)}
      <div class="tm-table-wrap">
        <table class="tm-table">
          <colgroup>
            <col class="col-num"><col class="col-time"><col class="col-desc">
            <col class="col-model"><col class="col-steps"><col class="col-cost">
            <col class="col-saved"><col class="col-status">
          </colgroup>
          <thead>
            <tr>
              <th>#</th><th>Time</th><th>Task ↕</th><th>Model</th>
              <th>Steps</th><th>Cost</th><th>Savings</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${emptyRow}${rowPairs}</tbody>
        </table>
      </div>
      <div class="tm-footer">Powered by TokenMiser v2 · MISER routing active · click any row to expand</div>
    </div>`;

  wireInteractions(block, openRidRef);

  // Restore previously open accordion row after re-render
  if (openRidRef.value) {
    const detail = block.querySelector(`#${openRidRef.value}`);
    const row = block.querySelector(`[data-rid="${openRidRef.value}"]`);
    if (detail && row) {
      detail.classList.remove('is-hidden');
      row.classList.add('is-expanded');
    } else {
      openRidRef.value = null; // row no longer exists
    }
  }
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

function tickElapsed(block) {
  block.querySelectorAll('.tm-live-elapsed[data-started]').forEach((el) => {
    const { started } = el.dataset;
    if (started) el.textContent = elapsedStr(started);
  });
}

export default async function decorate(block) {
  const openRidRef = { value: null }; // persists across re-renders
  let allRuns = await fetchRuns();
  renderDashboard(block, allRuns, openRidRef);

  // Tick elapsed timers every second (cheap DOM update, no re-fetch)
  setInterval(() => tickElapsed(block), 1000);

  // Fast poll for running-job status changes
  setInterval(async () => {
    const fresh = await fetchRuns();
    const hadActive = allRuns.some((r) => r.status === 'running' && !isStale(r));
    const hasActive = fresh.some((r) => r.status === 'running' && !isStale(r));
    allRuns = fresh;
    if (hadActive !== hasActive) {
      renderDashboard(block, fresh, openRidRef);
    } else {
      const liveBar = block.querySelector('.tm-live-bar');
      if (liveBar) {
        const active = fresh.filter((r) => r.status === 'running' && !isStale(r));
        liveBar.outerHTML = renderLiveBar(active);
      }
    }
  }, LIVE_REFRESH_MS);

  // Full refresh every 30s — accordion state preserved via openRidRef
  setInterval(async () => {
    const fresh = await fetchRuns();
    allRuns = fresh;
    renderDashboard(block, fresh, openRidRef);
  }, REFRESH_MS);
}
