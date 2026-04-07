import { loadScript } from '../../scripts/aem.js';

const CHART_JS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
const LABEL_COLOR = '#475569';
const GRID_COLOR = 'rgba(0,0,0,0.1)';
const PALETTE = ['#0070f3', '#059669', '#d97706', '#dc2626', '#7c3aed'];

const VARIANTS = ['bar', 'line', 'pie', 'doughnut'];

function detectVariant(classList) {
  return VARIANTS.find((v) => classList.contains(v)) || 'bar';
}

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map((h) => h.trim());
  const labels = [];
  const datasets = headers.slice(1).map((label, i) => ({
    label,
    data: [],
    backgroundColor: PALETTE[i % PALETTE.length],
    borderColor: PALETTE[i % PALETTE.length],
    borderWidth: 2,
    fill: false,
  }));

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    labels.push(cols[0]);
    datasets.forEach((ds, j) => {
      ds.data.push(parseFloat(cols[j + 1]) || 0);
    });
  }

  return { labels, datasets };
}

function extractText(block) {
  return block.textContent || '';
}

export default async function decorate(block) {
  const variant = detectVariant(block.classList);
  const rawText = extractText(block);
  const parsed = parseCsv(rawText);

  block.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'miser-csv-chart-wrap';
  const canvas = document.createElement('canvas');
  canvas.className = 'miser-csv-chart-canvas';
  wrap.appendChild(canvas);
  block.appendChild(wrap);

  if (!parsed) return;

  await loadScript(CHART_JS_URL);

  const isPolar = variant === 'pie' || variant === 'doughnut';
  const tickColor = LABEL_COLOR;

  // eslint-disable-next-line no-undef, no-new
  new Chart(canvas, {
    type: variant,
    data: {
      labels: parsed.labels,
      datasets: isPolar
        ? [{
          ...parsed.datasets[0],
          backgroundColor: parsed.datasets[0].data.map((_, i) => PALETTE[i % PALETTE.length]),
        }]
        : parsed.datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: tickColor },
        },
      },
      ...(isPolar ? {} : {
        scales: {
          x: {
            ticks: { color: tickColor },
            grid: { color: GRID_COLOR },
          },
          y: {
            ticks: { color: tickColor },
            grid: { color: GRID_COLOR },
          },
        },
      }),
    },
  });
}
