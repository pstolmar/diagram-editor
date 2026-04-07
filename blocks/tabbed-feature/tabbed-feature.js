import { moveInstrumentation } from '../../scripts/scripts.js';

const AUTO_ADVANCE_MS = 5000;

function parseTabRows(block) {
  const rows = [...block.children];
  return rows.map((row, index) => {
    const cols = [...row.children];
    return {
      label: cols[0]?.textContent.trim() || `Tab ${index + 1}`,
      imageCell: cols[1] || null,
      heading: cols[2]?.textContent.trim() || '',
      bodyCell: cols[3] || null,
    };
  }).filter((item) => item.label || item.imageCell || item.heading || item.bodyCell);
}

function buildPanelContent(item) {
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
    const heading = document.createElement('h3');
    heading.textContent = item.heading;
    panel.append(heading);
  }

  if (item.bodyCell) {
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'tf-panel-body';
    moveInstrumentation(item.bodyCell, bodyWrap);
    if (item.bodyCell.childNodes.length) {
      while (item.bodyCell.firstChild) bodyWrap.append(item.bodyCell.firstChild);
    } else {
      const text = item.bodyCell.textContent.trim();
      if (text) {
        const p = document.createElement('p');
        p.textContent = text;
        bodyWrap.append(p);
      }
    }
    panel.append(bodyWrap);
  }

  return panel;
}

function resetProgress(tabs, activeTab) {
  tabs.forEach((tab) => {
    tab.querySelectorAll('.tf-progress').forEach((bar) => bar.remove());
  });
  const progress = document.createElement('div');
  progress.className = 'tf-progress';
  activeTab.append(progress);
}

export default function decorate(block) {
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

    const panel = buildPanelContent(item);
    panelWrap.append(panel);
    panelEls.push(panel);
  });

  wrap.append(tabs, panelWrap);
  block.replaceChildren(wrap);

  let activeIndex = 0;
  let intervalId;

  function stopAutoAdvance() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  }

  function setActive(index, restartTimer = true) {
    activeIndex = index;
    tabEls.forEach((tab, i) => tab.classList.toggle('is-active', i === index));
    panelEls.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
    resetProgress(tabEls, tabEls[index]);
    if (restartTimer) {
      stopAutoAdvance();
      if (tabEls.length > 1) {
        intervalId = setInterval(() => {
          const nextIndex = (activeIndex + 1) % tabEls.length;
          setActive(nextIndex, false);
        }, AUTO_ADVANCE_MS);
      }
    }
  }

  function startAutoAdvance() {
    setActive(activeIndex, true);
  }

  tabEls.forEach((tab, index) => {
    tab.addEventListener('click', () => setActive(index));
  });

  wrap.addEventListener('mouseenter', stopAutoAdvance);
  wrap.addEventListener('mouseleave', startAutoAdvance);

  setActive(0);
}
