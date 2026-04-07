import { loadScript } from '../../scripts/aem.js';

const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';

let d3Ready = null;
function ensureD3() {
  if (!d3Ready) d3Ready = loadScript(D3_URL);
  return d3Ready;
}

function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function parseNetworkRows(text) {
  const lines = parseLines(text);
  const nodesMap = new Map();
  const links = lines
    .map((line) => line.split('|').map((p) => p.trim()))
    .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
    .map(([a, b, w]) => {
      if (!nodesMap.has(a)) nodesMap.set(a, { id: a });
      if (!nodesMap.has(b)) nodesMap.set(b, { id: b });
      const weight = Number(w);
      return { source: a, target: b, weight: Number.isFinite(weight) ? weight : 1 };
    });
  return { nodes: Array.from(nodesMap.values()), links };
}

function parseBarRows(text) {
  return parseLines(text)
    .map((line) => line.split('|').map((p) => p.trim()))
    .filter((parts) => parts.length >= 2 && parts[0] && Number.isFinite(Number(parts[1])))
    .map(([label, val, color]) => ({ label, value: Number(val), color: color || null }));
}

function getSize(el) {
  const rect = el.getBoundingClientRect();
  const width = Math.max(200, Math.floor(rect.width));
  // Cap at 560px — prevents runaway SVG height growth from ResizeObserver loops
  const height = Math.max(280, Math.min(560, Math.floor(rect.height)));
  return { width, height };
}

function getTextData(el) {
  // Prefer pre-saved dataset to avoid reading after DOM changes
  return el.dataset.graphSrc || el.getAttribute('data') || (el.textContent || '').trim();
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function renderNetwork(el, d3) {
  const data = getTextData(el);
  const { nodes, links } = parseNetworkRows(data);
  const { width, height } = getSize(el);

  clear(el);

  const svg = d3
    .select(el)
    .append('svg')
    .attr('class', 'd3g-svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  if (!nodes.length) return;

  // Declare simulation first so drag handlers can reference it
  const simulation = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(90))
    .force('charge', d3.forceManyBody().strength(-80))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const link = svg
    .append('g')
    .attr('class', 'd3g-links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'd3g-link')
    .attr('stroke-width', (d) => Math.max(1, Math.min(4, d.weight)));

  const node = svg
    .append('g')
    .attr('class', 'd3g-nodes')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('class', 'd3g-node')
    .attr('r', 8)
    .call(
      d3
        .drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

  const label = svg
    .append('g')
    .attr('class', 'd3g-labels')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .attr('class', 'd3g-label')
    .text((d) => d.id)
    .attr('dx', 10)
    .attr('dy', 4);

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);

    label.attr('x', (d) => d.x).attr('y', (d) => d.y);
  });
}

function ensureTooltip(el, d3) {
  let tip = el.querySelector(':scope > .d3g-tooltip');
  if (!tip) {
    tip = d3
      .select(el)
      .append('div')
      .attr('class', 'd3g-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('transition', 'opacity 150ms ease');
  } else {
    tip = d3.select(tip);
  }
  return tip;
}

function renderBars(el, d3) {
  const data = getTextData(el);
  const rows = parseBarRows(data);
  const { width, height } = getSize(el);
  const margin = {
    top: 16, right: 16, bottom: 36, left: 44,
  };

  clear(el);

  const svg = d3
    .select(el)
    .append('svg')
    .attr('class', 'd3g-svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  if (!rows.length) return;

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3
    .scaleBand()
    .domain(rows.map((d) => d.label))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (d) => d.value) || 1])
    .nice()
    .range([innerHeight, 0]);

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const axisColor = '#94a3b8';
  const axisX = g.append('g')
    .attr('class', 'd3g-axis-x')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));
  axisX.selectAll('text').attr('dy', '0.9em').style('font-size', '11px').style('fill', axisColor);
  axisX.selectAll('line, path').style('stroke', axisColor);

  const axisY = g.append('g')
    .attr('class', 'd3g-axis-y')
    .call(d3.axisLeft(y).ticks(5));
  axisY.selectAll('text').style('font-size', '11px').style('fill', axisColor);
  axisY.selectAll('line, path').style('stroke', axisColor);

  const tooltip = ensureTooltip(el, d3);

  g.selectAll('rect')
    .data(rows)
    .join('rect')
    .attr('class', 'd3g-bar')
    .attr('x', (d) => x(d.label))
    .attr('width', x.bandwidth())
    .attr('y', innerHeight)
    .attr('height', 0)
    .attr('fill', (d) => d.color || 'currentColor')
    .on('mouseenter', (event, d) => {
      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 10}px`)
        .style('top', `${event.offsetY - 10}px`)
        .text(`${d.label}: ${d.value}`);
    })
    .on('mousemove', (event) => {
      tooltip
        .style('left', `${event.offsetX + 10}px`)
        .style('top', `${event.offsetY - 10}px`);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
    })
    .transition()
    .duration(600)
    .attr('y', (d) => y(d.value))
    .attr('height', (d) => innerHeight - y(d.value));
}

async function render(el) {
  await ensureD3();
  const { d3 } = window;
  if (!d3) return;

  if (el.classList.contains('bar')) {
    renderBars(el, d3);
  } else {
    renderNetwork(el, d3);
  }
}

function setup(el) {
  let raf = null;
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => render(el));
  };

  const observer = new ResizeObserver(schedule);
  observer.observe(el);

  schedule();
}

export default async function decorate(block) {
  // Save text content now — before EDS or render cycles modify the DOM
  block.dataset.graphSrc = block.textContent.trim();
  // Clear immediately so block height is CSS-driven (min-height: 360px), not text-driven
  while (block.firstChild) block.removeChild(block.firstChild);
  setup(block);
}
