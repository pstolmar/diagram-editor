import { moveInstrumentation } from '../../scripts/scripts.js';

const AUTO_ADVANCE_MS = 5000;
const KEYFRAMES_ID = 'tf-slide-in-keyframes';

function injectKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes tf-slide-in {
      from { opacity: 0; transform: translateX(12px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.append(style);
}

function parseTabRows(block) {
  return [...block.children].map((row, index) => {
    const cols = [...row.children];
    return {
      label: cols[0]?.textContent.trim() || `Tab ${index + 1}`,
      imageCell: cols[1] || null,
      heading: cols[2]?.textContent.trim() || '',
      bodyCell: cols[3] || null,
    };
  }).filter((item) => item.label || item.imageCell || item.heading || item.bodyCell);
}

function bodyToBullets(cell) {
  const wrap = document.createElement('div');
  wrap.className = 'tf-panel-body';
  moveInstrumentation(cell, wrap);

  const hasStructure = [...cell.children].some((el) => el.matches('p, ul, ol, h1, h2, h3, h4, h5, h6'));
  if (hasStructure) {
    while (cell.firstChild) wrap.append(cell.firstChild);
    return wrap;
  }

  const raw = cell.textContent.trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const ul = document.createElement('ul');
    lines.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      ul.append(li);
    });
    wrap.append(ul);
  } else if (lines.length === 1) {
    const p = document.createElement('p');
    const [firstLine] = lines;
    p.textContent = firstLine;
    wrap.append(p);
  }
  return wrap;
}

function buildPanel(item) {
  const panel = document.createElement('div');
  panel.className = 'tf-panel';

  if (item.imageCell) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'tf-panel-image';
    moveInstrumentation(item.imageCell, imageWrap);
    while (item.imageCell.firstChild) imageWrap.append(item.imageCell.firstChild);
    panel.append(imageWrap);
  }

  if (item.heading) {
    const h3 = document.createElement('h3');
    h3.textContent = item.heading;
    panel.append(h3);
  }

  if (item.bodyCell) {
    panel.append(bodyToBullets(item.bodyCell));
  }

  return panel;
}

function resetProgress(tabEls, activeTab) {
  tabEls.forEach((tab) => tab.querySelectorAll('.tf-progress').forEach((bar) => bar.remove()));
  const bar = document.createElement('div');
  bar.className = 'tf-progress';
  activeTab.append(bar);
}

export default async function decorate(block) {
  injectKeyframes();

  const data = parseTabRows(block);
  if (!data.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'tf-wrap';
  moveInstrumentation(block, wrap);

  const tabs = document.createElement('div');
  tabs.className = 'tf-tabs';

  const panelWrap = document.createElement('div');
  panelWrap.className = 'tf-panel-wrap';

  const tabEls = [];
  const panelEls = [];

  data.forEach((item, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tf-tab';
    tab.textContent = item.label;
    tab.dataset.index = String(index);
    tabs.append(tab);
    tabEls.push(tab);

    const panel = buildPanel(item);
    panelWrap.append(panel);
    panelEls.push(panel);
  });

  wrap.append(tabs, panelWrap);
  block.replaceChildren(wrap);

  let activeIndex = 0;
  let intervalId;

  function stopAutoAdvance() {
    clearInterval(intervalId);
    intervalId = undefined;
  }

  function setActive(index, restartTimer = true) {
    activeIndex = index;
    tabEls.forEach((tab, i) => tab.classList.toggle('is-active', i === index));
    panelEls.forEach((panel, i) => {
      const wasActive = panel.classList.contains('is-active');
      panel.classList.toggle('is-active', i === index);
      if (i === index && !wasActive) {
        panel.style.animation = 'none';
        // eslint-disable-next-line no-unused-expressions
        panel.offsetWidth; // reflow to restart animation
        panel.style.animation = '';
      }
    });
    resetProgress(tabEls, tabEls[index]);
    if (restartTimer) {
      stopAutoAdvance();
      if (tabEls.length > 1) {
        intervalId = setInterval(() => {
          setActive((activeIndex + 1) % tabEls.length, false);
        }, AUTO_ADVANCE_MS);
      }
    }
  }

  tabEls.forEach((tab, index) => {
    tab.addEventListener('click', () => setActive(index));
  });

  wrap.addEventListener('mouseenter', stopAutoAdvance);
  wrap.addEventListener('mouseleave', () => setActive(activeIndex, true));

  setActive(0);
}
