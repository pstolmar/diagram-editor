function moveChildren(source, target) {
  if (!source || !target) return;
  while (source.firstChild) target.appendChild(source.firstChild);
}

function parseRows(block) {
  return [...block.children].map((row) => {
    const cols = [...row.children];
    return { sticky: cols[0] || null, scroll: cols[1] || null };
  }).filter((r) => r.sticky || r.scroll);
}

function swapStickyContent(stickyInner, stickyContents, nextIndex, state) {
  if (!stickyContents[nextIndex] || state.currentIndex === nextIndex) return;

  if (state.isAnimating) {
    state.pendingIndex = nextIndex;
    return;
  }

  state.isAnimating = true;
  stickyInner.classList.add('is-leaving');

  window.setTimeout(() => {
    stickyInner.textContent = '';
    stickyInner.append(stickyContents[nextIndex]);
    stickyInner.classList.remove('is-leaving');
    state.currentIndex = nextIndex;
    state.isAnimating = false;

    if (state.pendingIndex !== null && state.pendingIndex !== state.currentIndex) {
      const pending = state.pendingIndex;
      state.pendingIndex = null;
      swapStickyContent(stickyInner, stickyContents, pending, state);
    }
  }, 350);
}

function setupObserver(panels, stickyInner, stickyContents) {
  const state = { currentIndex: 0, pendingIndex: null, isAnimating: false };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const index = Number(entry.target.dataset.snIndex || 0);
      swapStickyContent(stickyInner, stickyContents, index, state);
    });
  }, { threshold: 0.5 });

  panels.forEach((panel) => observer.observe(panel));
}

export default async function decorate(block) {
  const rows = parseRows(block);
  if (!rows.length) return;

  const isUE = document.documentElement.classList.contains('hlx-ue');
  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'sn-wrapper';

  const scroll = document.createElement('div');
  scroll.className = 'sn-scroll';

  if (isUE) {
    rows.forEach((row) => {
      const panel = document.createElement('div');
      panel.className = 'sn-panel';
      if (row.sticky) {
        const chunk = document.createElement('div');
        chunk.className = 'sn-ue-sticky';
        moveChildren(row.sticky, chunk);
        panel.append(chunk);
      }
      if (row.scroll) {
        const chunk = document.createElement('div');
        chunk.className = 'sn-ue-scroll';
        moveChildren(row.scroll, chunk);
        panel.append(chunk);
      }
      scroll.append(panel);
    });
    wrapper.append(scroll);
    block.append(wrapper);
    return;
  }

  const sticky = document.createElement('div');
  sticky.className = 'sn-sticky';
  const stickyInner = document.createElement('div');
  stickyInner.className = 'sn-sticky-inner';
  sticky.append(stickyInner);

  const stickyContents = [];
  const panels = [];

  rows.forEach((row, index) => {
    const stickyContent = document.createElement('div');
    stickyContent.className = 'sn-sticky-content';
    moveChildren(row.sticky, stickyContent);
    stickyContents.push(stickyContent);

    const panel = document.createElement('div');
    panel.className = 'sn-panel';
    panel.dataset.snIndex = String(index);
    moveChildren(row.scroll, panel);
    scroll.append(panel);
    panels.push(panel);
  });

  if (stickyContents[0]) stickyInner.append(stickyContents[0]);

  wrapper.append(sticky, scroll);
  block.append(wrapper);

  setupObserver(panels, stickyInner, stickyContents);
}
