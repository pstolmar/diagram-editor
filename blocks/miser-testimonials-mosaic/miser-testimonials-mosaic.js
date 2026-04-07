import { moveInstrumentation } from '../../scripts/scripts.js';

function clampStars(value) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function buildStars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export default function decorate(block) {
  const rows = [...block.children];
  const categories = [];
  const categorySet = new Set();

  const chips = document.createElement('div');
  chips.className = 'tm-chips';

  const grid = document.createElement('div');
  grid.className = 'tm-grid';

  const showMore = document.createElement('button');
  showMore.className = 'tm-show-more';
  showMore.type = 'button';
  showMore.textContent = 'Show more';

  const cards = rows.map((row) => {
    const cols = [...row.children];
    const [quoteCol, nameCol, roleCol, categoryCol, starsCol] = cols;
    const category = (categoryCol?.textContent || '').trim();

    if (category && !categorySet.has(category)) {
      categorySet.add(category);
      categories.push(category);
    }

    const card = document.createElement('div');
    card.className = 'tm-card';
    if (category) card.dataset.category = category;
    moveInstrumentation(row, card);

    if (quoteCol) {
      const quote = document.createElement('div');
      quote.className = 'tm-quote';
      while (quoteCol.firstChild) quote.append(quoteCol.firstChild);
      card.append(quote);
    }

    if (nameCol) {
      const name = document.createElement('div');
      name.className = 'tm-name';
      name.textContent = nameCol.textContent.trim();
      card.append(name);
    }

    if (roleCol) {
      const role = document.createElement('div');
      role.className = 'tm-role';
      role.textContent = roleCol.textContent.trim();
      card.append(role);
    }

    if (starsCol) {
      const stars = document.createElement('div');
      stars.className = 'tm-stars';
      const count = clampStars(starsCol.textContent.trim());
      stars.textContent = buildStars(count);
      card.append(stars);
    }

    grid.append(card);
    return { el: card, category };
  });

  function buildChip(label, value) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tm-chip';
    btn.textContent = label;
    btn.dataset.category = value;
    return btn;
  }

  const allChip = buildChip('All', 'all');
  allChip.classList.add('is-active');
  allChip.setAttribute('aria-pressed', 'true');
  chips.append(allChip);
  categories.forEach((cat) => chips.append(buildChip(cat, cat)));

  let currentCategory = 'all';
  let visibleCount = 6;

  function restagger(visibleCards) {
    visibleCards.forEach((card, i) => {
      const { el } = card;
      el.style.animation = 'none';
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight; // force reflow to restart animation
      el.style.animation = '';
      el.style.animationDelay = `${i * 0.05}s`;
    });
  }

  function updateVisible() {
    const matches = cards.filter((c) => currentCategory === 'all' || c.category === currentCategory);

    cards.forEach((card) => {
      card.el.hidden = true;
    });

    const visible = matches.slice(0, visibleCount);
    visible.forEach((card) => {
      card.el.hidden = false;
    });

    restagger(visible);
    showMore.hidden = visibleCount >= matches.length;
  }

  chips.addEventListener('click', (event) => {
    const target = event.target.closest('.tm-chip');
    if (!target) return;
    const category = target.dataset.category || 'all';
    if (category === currentCategory) return;

    currentCategory = category;
    visibleCount = 6;

    chips.querySelectorAll('.tm-chip').forEach((chip) => {
      const isActive = chip === target;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    updateVisible();
  });

  showMore.addEventListener('click', () => {
    visibleCount += 6;
    updateVisible();
  });

  block.replaceChildren(chips, grid, showMore);
  updateVisible();
}
