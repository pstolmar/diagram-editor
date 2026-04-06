import { moveInstrumentation } from '../../scripts/scripts.js';

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

  itemRows.forEach((row) => {
    const cols = [...row.children];
    const [valueDiv, labelDiv, subtitleDiv] = cols;

    const item = document.createElement('li');
    item.className = 'metrics-grid-item';
    moveInstrumentation(row, item);

    if (valueDiv) {
      const valueEl = document.createElement('span');
      valueEl.className = 'metrics-grid-value';
      valueEl.textContent = valueDiv.textContent.trim();
      item.append(valueEl);
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
}
