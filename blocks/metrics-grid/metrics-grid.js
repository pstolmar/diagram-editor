import { moveInstrumentation } from '../../scripts/scripts.js';

// Parse "98%", "4.2x", "2.1s", "$1M" into { prefix, num, suffix }
function parseNumeric(str) {
  const match = str.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  return { prefix: match[1], num: parseFloat(match[2]), suffix: match[3] };
}

function countUp(el, parsed, duration = 1600) {
  const decimals = String(parsed.num).includes('.') ? String(parsed.num).split('.')[1].length : 0;
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = parsed.prefix + (parsed.num * eased).toFixed(decimals) + parsed.suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export default function decorate(block) {
  const rows = [...block.children];
  const [titleRow, ...itemRows] = rows;

  const wrapper = document.createElement('div');
  wrapper.className = 'metrics-grid-wrapper';

  if (titleRow) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'metrics-grid-title';
    moveInstrumentation(titleRow, titleEl);
    titleEl.textContent = titleRow.textContent.trim();
    wrapper.append(titleEl);
  }

  const grid = document.createElement('ul');
  grid.className = 'metrics-grid-list';
  const valueEls = [];

  itemRows.forEach((row, idx) => {
    const cols = [...row.children];
    const [valueDiv, labelDiv, subtitleDiv] = cols;

    const item = document.createElement('li');
    item.className = `metrics-grid-item metrics-grid-item-${idx % 4}`;
    moveInstrumentation(row, item);

    if (valueDiv) {
      const raw = valueDiv.textContent.trim();
      const valueEl = document.createElement('span');
      valueEl.className = 'metrics-grid-value';
      valueEl.textContent = raw;
      item.append(valueEl);
      const parsed = parseNumeric(raw);
      if (parsed) valueEls.push({ el: valueEl, parsed });
    }

    if (labelDiv) {
      const labelEl = document.createElement('span');
      labelEl.className = 'metrics-grid-label';
      labelEl.textContent = labelDiv.textContent.trim();
      item.append(labelEl);
    }

    if (subtitleDiv) {
      const subtitleEl = document.createElement('span');
      subtitleEl.className = 'metrics-grid-subtitle';
      subtitleEl.textContent = subtitleDiv.textContent.trim();
      item.append(subtitleEl);
    }

    grid.append(item);
  });

  wrapper.append(grid);
  block.replaceChildren(wrapper);

  // Trigger count-up when grid scrolls into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        valueEls.forEach(({ el, parsed }) => countUp(el, parsed));
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(grid);
}
