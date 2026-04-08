/**
 * viz-pipeline — SVG pipeline topology visualizer
 *
 * Renders nodes and directed edges from a JSON topology.
 * Click a node to open the metrics side-panel.
 * Auto-simulates live metric drift every refreshMs.
 */

const STATUS_COLORS = {
  ok: '#00c97a',
  warn: '#f5c842',
  error: '#ff4d5e',
  idle: '#3d5a73',
  unknown: '#8a7ecf',
};

function fmt(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function buildSvg(data, w, h) {
  const PAD = 0.04;
  const NODE_W = 88;
  const NODE_H = 40;

  // Map normalized coords to pixel coords
  const px = (x) => PAD * w + x * w * (1 - 2 * PAD);
  const py = (y) => PAD * h + y * h * (1 - 2 * PAD);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  // Defs — arrowhead marker
  const defs = document.createElementNS(ns, 'defs');
  ['ok', 'warn', 'error', 'idle'].forEach((s) => {
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', `arrow-${s}`);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '5');
    marker.setAttribute('markerHeight', '5');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    path.setAttribute('fill', STATUS_COLORS[s]);
    path.setAttribute('opacity', '0.7');
    marker.append(path);
    defs.append(marker);
  });
  svg.append(defs);

  // Draw edges
  data.edges.forEach((edge) => {
    const src = data.nodes.find((n) => n.id === edge.from);
    const dst = data.nodes.find((n) => n.id === edge.to);
    if (!src || !dst) return;

    const x1 = px(src.x) + NODE_W / 2;
    const y1 = py(src.y);
    const x2 = px(dst.x) - NODE_W / 2;
    const y2 = py(dst.y);
    const cx = (x1 + x2) / 2;

    const status = edge.status || 'ok';
    const color = STATUS_COLORS[status] || STATUS_COLORS.ok;
    const strokeW = 1 + (edge.bandwidth || 0.1) * 3;

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeW);
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.45');
    path.setAttribute('marker-end', `url(#arrow-${status})`);
    svg.append(path);

    // Edge label
    if (edge.label) {
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', cx);
      txt.setAttribute('y', (y1 + y2) / 2 - 4);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', color);
      txt.setAttribute('font-size', '9');
      txt.setAttribute('opacity', '0.7');
      txt.setAttribute('font-family', 'JetBrains Mono, monospace');
      txt.textContent = edge.label;
      svg.append(txt);
    }
  });

  // Draw nodes
  const nodeEls = {};
  data.nodes.forEach((node) => {
    const cx = px(node.x);
    const cy = py(node.y);
    const color = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('cursor', 'pointer');
    g.dataset.nodeId = node.id;

    // Background rect
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', cx - NODE_W / 2);
    rect.setAttribute('y', cy - NODE_H / 2);
    rect.setAttribute('width', NODE_W);
    rect.setAttribute('height', NODE_H);
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', '#0c1826');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '1.5');
    g.append(rect);

    // Status dot
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', cx + NODE_W / 2 - 8);
    dot.setAttribute('cy', cy - NODE_H / 2 + 8);
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', color);
    g.append(dot);

    // Label
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', cy - 4);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#cde0f0');
    label.setAttribute('font-size', '10');
    label.setAttribute('font-weight', '600');
    label.setAttribute('font-family', 'IBM Plex Sans, system-ui, sans-serif');
    label.textContent = node.label;
    g.append(label);

    // RPS sub-label
    if (node.metrics?.rps) {
      const sub = document.createElementNS(ns, 'text');
      sub.setAttribute('x', cx);
      sub.setAttribute('y', cy + 12);
      sub.setAttribute('text-anchor', 'middle');
      sub.setAttribute('fill', color);
      sub.setAttribute('font-size', '9');
      sub.setAttribute('font-family', 'JetBrains Mono, monospace');
      sub.textContent = `${fmt(node.metrics.rps)} rps`;
      g.append(sub);
    }

    svg.append(g);
    nodeEls[node.id] = g;
  });

  return { svg, nodeEls };
}

function openPanel(panel, node) {
  const m = node.metrics || {};
  panel.dataset.status = node.status;
  panel.querySelector('.node-panel-title').textContent = node.label;
  const row = (cls, label, val) => `<div class="vp-metric-row ${cls}"><span>${label}</span><span>${val}</span></div>`;
  let cpuCls = '';
  if (m.cpuPct > 80) cpuCls = 'vp-error';
  else if (m.cpuPct > 60) cpuCls = 'vp-warn';
  panel.querySelector('.node-panel-body').innerHTML = [
    m.rps !== undefined && row('', 'RPS', fmt(m.rps)),
    m.p99Ms !== undefined && row('', 'P99 Latency', `${m.p99Ms}ms`),
    m.errorPct !== undefined && row(m.errorPct > 2 ? 'vp-error' : '', 'Error Rate', `${m.errorPct}%`),
    m.cpuPct !== undefined && row(cpuCls, 'CPU', `${m.cpuPct}%`),
    m.hitRate !== undefined && row('', 'Cache Hit', `${(m.hitRate * 100).toFixed(0)}%`),
    m.queueDepth !== undefined && row('vp-error', 'Queue Depth', m.queueDepth.toLocaleString()),
  ].filter(Boolean).join('');
  panel.classList.add('is-open');
}

export default async function decorate(block) {
  let data;
  try {
    const url = new URL('./viz-pipeline-demo.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    block.innerHTML = `<div style="padding:2rem;color:#ff4d5e;font-family:monospace;">
      Pipeline data unavailable: ${e.message}</div>`;
    return;
  }

  block.innerHTML = '';
  block.style.position = 'relative';

  // Legend
  const legend = document.createElement('div');
  legend.className = 'vp-legend';
  legend.style.cssText = 'display:flex;gap:1rem;padding:8px 14px;border-bottom:1px solid #1a2d40;font-size:10px;font-family:JetBrains Mono,monospace;';
  legend.innerHTML = `
    <span style="color:#00c97a">● ok</span>
    <span style="color:#f5c842">● warn</span>
    <span style="color:#ff4d5e">● error</span>
    <span style="color:#8fa8bf;margin-left:auto;opacity:0.6">${data.title || 'Pipeline Topology'}</span>
  `;
  block.append(legend);

  // Canvas container
  const canvasDiv = document.createElement('div');
  canvasDiv.id = 'pipeline-canvas';
  canvasDiv.style.height = '420px';
  block.append(canvasDiv);

  const w = canvasDiv.clientWidth || 900;
  const h = 420;
  const { svg, nodeEls } = buildSvg(data, w, h);
  canvasDiv.append(svg);

  // Node panel
  const panel = document.createElement('div');
  panel.className = 'node-panel';
  panel.innerHTML = `
    <div class="node-panel-header">
      <span class="node-panel-status-dot"></span>
      <span class="node-panel-title"></span>
      <button class="node-panel-close" aria-label="Close">✕</button>
    </div>
    <div class="node-panel-body"></div>
  `;
  canvasDiv.append(panel);

  // Add metric row styles inline (CSS already has panel structure)
  const style = document.createElement('style');
  style.textContent = `
    .vp-metric-row { display:flex; justify-content:space-between; align-items:center;
      padding:5px 0; border-bottom:1px solid #1a2d40; font-size:11px;
      font-family:'JetBrains Mono',monospace; color:#8fa8bf; }
    .vp-metric-row span:last-child { color:#cde0f0; font-weight:600; }
    .vp-metric-row.vp-error span:last-child { color:#ff4d5e; }
    .vp-metric-row.vp-warn span:last-child { color:#f5c842; }
  `;
  block.append(style);

  panel.querySelector('.node-panel-close').addEventListener('click', () => {
    panel.classList.remove('is-open');
  });

  // Node click listeners
  Object.entries(nodeEls).forEach(([id, el]) => {
    el.addEventListener('click', () => {
      const node = data.nodes.find((n) => n.id === id);
      if (node) openPanel(panel, node);
    });
    el.addEventListener('mouseenter', () => {
      el.querySelector('rect').setAttribute('stroke-width', '2.5');
    });
    el.addEventListener('mouseleave', () => {
      el.querySelector('rect').setAttribute('stroke-width', '1.5');
    });
  });

  // Simulate metric drift
  const refresh = data.refreshMs ?? 5000;
  setInterval(() => {
    data.nodes.forEach((node) => {
      const m = node.metrics;
      if (!m) return;
      if (m.rps !== undefined) m.rps = Math.max(0, m.rps * (0.95 + Math.random() * 0.1));
      if (m.p99Ms !== undefined) {
        m.p99Ms = Math.max(1, Math.round(m.p99Ms * (0.9 + Math.random() * 0.2)));
      }
      if (m.cpuPct !== undefined) {
        m.cpuPct = Math.min(99, Math.max(1, m.cpuPct + (Math.random() - 0.5) * 5));
      }
    });
    // Re-render SVG
    const newW = canvasDiv.clientWidth || 900;
    const { svg: newSvg, nodeEls: newEls } = buildSvg(data, newW, h);
    svg.replaceWith(newSvg);
    Object.entries(newEls).forEach(([id, el]) => {
      const node = data.nodes.find((n) => n.id === id);
      el.addEventListener('click', () => { if (node) openPanel(panel, node); });
      el.addEventListener('mouseenter', () => el.querySelector('rect').setAttribute('stroke-width', '2.5'));
      el.addEventListener('mouseleave', () => el.querySelector('rect').setAttribute('stroke-width', '1.5'));
    });
  }, refresh);
}
