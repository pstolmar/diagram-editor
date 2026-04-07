function moveChildren(source, target) {
  if (!source || !target) return;
  while (source.firstChild) {
    target.appendChild(source.firstChild);
  }
}

function parseRows(block) {
  return [...block.children].map((row) => {
    const cols = [...row.children];
    return {
      sticky: cols[0] || null,
      scroll: cols[1] || null,
    };
  }).filter((row) => row.sticky || row.scroll);
}

function swapStickyContent(stickyInner, stickyContents, nextIndex, state) {
  if (!stickyInner || !stickyContents[nextIndex]) return;
  if (state.currentIndex === nextIndex) return;

  if (state.isAnimating) {
    state.pendingIndex = nextIndex;
    return;
  }

  const nextContent = stickyContents[nextIndex];
  state.isAnimating = true;

  const finalizeSwap = () => {
    stickyInner.textContent = '';
    stickyInner.append(nextContent);
    requestAnimationFrame(() => {
      stickyInner.classList.remove('is-leaving');
    });
    state.currentIndex = nextIndex;
    state.isAnimating = false;
    if (state.pendingIndex !== null && state.pendingIndex !== state.currentIndex) {
      const pending = state.pendingIndex;
      state.pendingIndex = null;
      swapStickyContent(stickyInner, stickyContents, pending, state);
    }
  };

  const onTransitionEnd = (event) => {
    if (event.propertyName !== 'opacity') return;
    stickyInner.removeEventListener('transitionend', onTransitionEnd);
    finalizeSwap();
  };

  stickyInner.addEventListener('transitionend', onTransitionEnd);
  stickyInner.classList.add('is-leaving');

  // Fallback in case transitionend does not fire.
  window.setTimeout(() => {
    if (!state.isAnimating) return;
    stickyInner.removeEventListener('transitionend', onTransitionEnd);
    finalizeSwap();
  }, 450);
}

function setupIntersectionObserver(panels, stickyInner, stickyContents) {
  const state = {
    currentIndex: 0,
    pendingIndex: null,
    isAnimating: false,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const index = Number(entry.target.dataset.snIndex || 0);
      swapStickyContent(stickyInner, stickyContents, index, state);
    });
  }, { threshold: 0.5 });

  panels.forEach((panel) => observer.observe(panel));
}

export default function decorate(block) {
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
        const stickyChunk = document.createElement('div');
        stickyChunk.className = 'sn-ue-sticky';
        moveChildren(row.sticky, stickyChunk);
        panel.append(stickyChunk);
      }
      if (row.scroll) {
        const scrollChunk = document.createElement('div');
        scrollChunk.className = 'sn-ue-scroll';
        moveChildren(row.scroll, scrollChunk);
        panel.append(scrollChunk);
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

  if (stickyContents[0]) {
    stickyInner.append(stickyContents[0]);
  }

  wrapper.append(sticky, scroll);
  block.append(wrapper);

  setupIntersectionObserver(panels, stickyInner, stickyContents);
}
