function moveChildren(source, target) {
  while (source.firstChild) target.appendChild(source.firstChild);
}

export default async function decorate(block) {
  const rows = [...block.children].map((row) => {
    const cols = [...row.children];
    return { sticky: cols[0] || null, scroll: cols[1] || null };
  }).filter((r) => r.sticky || r.scroll);

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
        const ueSticky = document.createElement('div');
        ueSticky.className = 'sn-ue-sticky';
        moveChildren(row.sticky, ueSticky);
        panel.append(ueSticky);
      }
      if (row.scroll) {
        const ueScroll = document.createElement('div');
        ueScroll.className = 'sn-ue-scroll';
        moveChildren(row.scroll, ueScroll);
        panel.append(ueScroll);
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

  const stickyContents = rows.map((row) => {
    const el = document.createElement('div');
    el.className = 'sn-sticky-content';
    moveChildren(row.sticky, el);
    return el;
  });

  let currentIndex = 0;
  let animating = false;

  const panels = rows.map((row, index) => {
    const panel = document.createElement('div');
    panel.className = 'sn-panel';
    panel.dataset.snIndex = String(index);
    moveChildren(row.scroll, panel);
    scroll.append(panel);
    return panel;
  });

  if (stickyContents[0]) stickyInner.append(stickyContents[0]);

  wrapper.append(sticky, scroll);
  block.append(wrapper);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || animating) return;
      const next = Number(entry.target.dataset.snIndex || 0);
      if (next === currentIndex) return;
      animating = true;
      stickyInner.classList.add('is-leaving');
      setTimeout(() => {
        stickyInner.textContent = '';
        stickyInner.append(stickyContents[next]);
        stickyInner.classList.remove('is-leaving');
        currentIndex = next;
        animating = false;
      }, 350);
    });
  }, { threshold: 0.5 });

  panels.forEach((panel) => observer.observe(panel));
}
