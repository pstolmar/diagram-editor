export default function decorate(block) {
  const rows = [...block.children];

  // First row = section title
  const titleRow = rows[0];
  const title = titleRow ? titleRow.children[0]?.textContent.trim() : '';

  // Remaining rows = metric items: [value, label, subtitle]
  const items = rows.slice(1).map((row) => {
    const cells = [...row.children];
    return {
      value: cells[0]?.textContent.trim() || '',
      label: cells[1]?.textContent.trim() || '',
      subtitle: cells[2]?.textContent.trim() || '',
    };
  });

  block.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'mg-tm-grid';

  if (title) {
    const header = document.createElement('div');
    header.className = 'mg-tm-header';
    const h2 = document.createElement('h2');
    h2.className = 'mg-tm-title';
    h2.textContent = title;
    header.append(h2);
    grid.append(header);
  }

  const cards = document.createElement('div');
  cards.className = 'mg-tm-cards';

  items.forEach(({ value, label, subtitle }) => {
    const card = document.createElement('div');
    card.className = 'mg-tm-card';

    const valEl = document.createElement('div');
    valEl.className = 'mg-tm-value';
    valEl.textContent = value;

    const labelEl = document.createElement('div');
    labelEl.className = 'mg-tm-label';
    labelEl.textContent = label;

    card.append(valEl, labelEl);

    if (subtitle) {
      const subEl = document.createElement('div');
      subEl.className = 'mg-tm-subtitle';
      subEl.textContent = subtitle;
      card.append(subEl);
    }

    cards.append(card);
  });

  grid.append(cards);
  block.append(grid);
}
