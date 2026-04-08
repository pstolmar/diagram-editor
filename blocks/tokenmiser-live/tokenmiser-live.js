const RUNS_URLS = ['/tokenmiser-data/runs.json', '/.tokenmiser/runs.json'];
const POLL_MS = 5000;
const STALE_MS = 2 * 60 * 60 * 1000;

function parseNdjson(text) {
  return text.split('\n')
    .map((l) => l.trim()).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

async function tryFetch(url) {
  const r = await fetch(url);
  if (!r.ok) return [];
  return parseNdjson(await r.text());
}

async function fetchRuns() {
  return tryFetch(RUNS_URLS[0])
    .then((d) => (d.length > 0 ? d : tryFetch(RUNS_URLS[1])))
    .catch(() => tryFetch(RUNS_URLS[1]).catch(() => []));
}

function fmtElapsed(startedAt) {
  if (!startedAt) return '';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function isStale(run) {
  return run.startedAt && (Date.now() - new Date(run.startedAt).getTime()) > STALE_MS;
}

function jobLabel(run) {
  const desc = run.description || (run.jobId || '').replace(/^\d{8}_\d{6}_/, '').replace(/_/g, ' ');
  return desc.substring(0, 40);
}

function render(block, runs) {
  const active = runs.filter((r) => r.status === 'running' && !isStale(r));

  if (active.length === 0) {
    block.innerHTML = '';
    return;
  }

  const jobs = active.map((run) => {
    const stale = isStale(run);
    return `<span class="tl-job${stale ? ' tl-job-stale' : ''}">
      <span class="tl-dot ${stale ? 'tl-dot-stale' : 'tl-dot-pulse'}"></span>
      <span class="tl-status">${stale ? 'abandoned?' : 'running'}</span>
      <span class="tl-sep">·</span>
      <span class="tl-desc">${jobLabel(run)}</span>
      <span class="tl-sep">·</span>
      <span class="tl-elapsed" data-started="${run.startedAt || ''}">${fmtElapsed(run.startedAt)}</span>
      <span class="tl-sep">·</span>
      <span class="tl-meta">MISER=${run.miserLevel ?? '?'} ${run.modelTier || ''}</span>
    </span>`;
  }).join('<span class="tl-sep tl-sep-big">|</span>');

  block.innerHTML = `<div class="tl-widget tl-busy">${jobs}</div>`;
}

export default async function decorate(block) {
  let runs = await fetchRuns();
  render(block, runs);

  setInterval(() => {
    block.querySelectorAll('.tl-elapsed[data-started]').forEach((el) => {
      if (el.dataset.started) el.textContent = fmtElapsed(el.dataset.started);
    });
  }, 1000);

  setInterval(async () => {
    runs = await fetchRuns();
    render(block, runs);
  }, POLL_MS);
}
