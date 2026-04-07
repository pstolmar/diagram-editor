import { loadScript } from '../../scripts/aem.js';

const CHART_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
const LABEL_COLOR = '#475569';
const GRID_COLOR = 'rgba(0,0,0,0.1)';
const PALETTE = ['#0070f3', '#059669', '#d97706', '#dc2626', '#7c3aed'];

function getFirstCellText(block) {
  const firstRow = block.firstElementChild;
  if (!firstRow) return '';
  const firstCell = firstRow.firstElementChild || firstRow;
  return (firstCell.textContent || '').trim();
}

function parseCsvText(csvText) {
  return csvText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

function resolveVariant(block) {
  if (block.dataset.variant) return block.dataset.variant.toLowerCase();
  if (block.classList.contains('pie')) return 'pie';
  if (block.classList.contains('doughnut')) return 'doughnut';
  if (block.classList.contains('line')) return 'line';
  if (block.classList.contains('bar')) return 'bar';
  return 'bar';
}

export default async function decorate(block) {
  const sourceText = getFirstCellText(block);
  if (!sourceText) return;

  let csvText = sourceText;
  if (/^https?:\/\//i.test(sourceText)) {
    const res = await fetch(sourceText);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[csv-chart] Failed to fetch CSV:', sourceText);
      return;
    }
    csvText = await res.text();
  }

  const rows = parseCsvText(csvText);
  if (rows.length < 2) return;

  const header = rows[0];
  const labels = header.slice(1);
  const datasets = rows.slice(1).map((row, idx) => {
    const label = row[0] || `Series ${idx + 1}`;
    const values = row.slice(1).map((value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    });
    const color = PALETTE[idx % PALETTE.length];
    return {
      label,
      data: values,
      borderColor: color,
      backgroundColor: color,
      tension: 0.35,
    };
  });

  const variant = resolveVariant(block);
  if (variant === 'pie' || variant === 'doughnut') {
    const background = labels.map((_, i) => PALETTE[i % PALETTE.length]);
    datasets.forEach((dataset) => {
      dataset.backgroundColor = background;
      dataset.borderColor = GRID_COLOR;
      dataset.borderWidth = 1;
      delete dataset.tension;
    });
  }

  await loadScript(CHART_SRC);

  const wrap = document.createElement('div');
  wrap.className = 'csv-chart-wrap';
  const canvas = document.createElement('canvas');
  canvas.className = 'csv-chart-canvas';
  wrap.append(canvas);
  block.replaceChildren(wrap);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: LABEL_COLOR,
        },
      },
    },
  };

  if (variant !== 'pie' && variant !== 'doughnut') {
    options.scales = {
      x: {
        ticks: { color: LABEL_COLOR },
        grid: { color: GRID_COLOR },
      },
      y: {
        ticks: { color: LABEL_COLOR },
        grid: { color: GRID_COLOR },
      },
    };
  }

  // eslint-disable-next-line no-new
  new window.Chart(canvas, {
    type: variant,
    data: { labels, datasets },
    options,
  });
}
