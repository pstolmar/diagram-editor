import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const rows = [...block.children];
  const [imageRow, labelRow, descRow] = rows;

  const [beforeImgDiv, afterImgDiv] = [...(imageRow ? imageRow.children : [])];
  const [beforeLabelDiv, afterLabelDiv] = [...(labelRow ? labelRow.children : [])];

  const beforeLabel = beforeLabelDiv ? beforeLabelDiv.textContent.trim() : 'Before';
  const afterLabel = afterLabelDiv ? afterLabelDiv.textContent.trim() : 'After';

  const container = document.createElement('div');
  container.className = 'image-compare-container';

  const beforeEl = document.createElement('div');
  beforeEl.className = 'image-compare-before';
  if (beforeImgDiv) {
    moveInstrumentation(beforeImgDiv, beforeEl);
    while (beforeImgDiv.firstChild) beforeEl.append(beforeImgDiv.firstChild);
  }

  const afterEl = document.createElement('div');
  afterEl.className = 'image-compare-after';
  afterEl.style.clipPath = 'inset(0 50% 0 0)';
  if (afterImgDiv) {
    moveInstrumentation(afterImgDiv, afterEl);
    while (afterImgDiv.firstChild) afterEl.append(afterImgDiv.firstChild);
  }

  const slider = document.createElement('div');
  slider.className = 'image-compare-slider';
  slider.setAttribute('role', 'slider');
  slider.setAttribute('aria-label', `${beforeLabel} / ${afterLabel} comparison`);
  slider.setAttribute('aria-valuenow', '50');
  slider.setAttribute('aria-valuemin', '0');
  slider.setAttribute('aria-valuemax', '100');
  slider.setAttribute('tabindex', '0');

  const handle = document.createElement('div');
  handle.className = 'image-compare-handle';
  handle.setAttribute('aria-hidden', 'true');
  slider.append(handle);

  const beforeBadge = document.createElement('span');
  beforeBadge.className = 'image-compare-badge image-compare-badge-before';
  beforeBadge.textContent = beforeLabel;

  const afterBadge = document.createElement('span');
  afterBadge.className = 'image-compare-badge image-compare-badge-after';
  afterBadge.textContent = afterLabel;

  container.append(beforeEl, afterEl, slider, beforeBadge, afterBadge);

  if (descRow) {
    const desc = document.createElement('p');
    desc.className = 'image-compare-description';
    desc.textContent = descRow.textContent.trim();
    block.replaceChildren(container, desc);
  } else {
    block.replaceChildren(container);
  }

  let dragging = false;

  function setPosition(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    slider.style.left = `${clamped}%`;
    afterEl.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    slider.setAttribute('aria-valuenow', String(Math.round(clamped)));
  }

  setPosition(50);

  container.addEventListener('mousedown', (e) => {
    dragging = true;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = container.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPosition(pct);
  });

  window.addEventListener('mouseup', () => { dragging = false; });

  container.addEventListener('touchstart', (e) => {
    dragging = true;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const rect = container.getBoundingClientRect();
    const pct = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
    setPosition(pct);
  }, { passive: true });

  window.addEventListener('touchend', () => { dragging = false; });

  slider.addEventListener('keydown', (e) => {
    const current = parseFloat(slider.getAttribute('aria-valuenow')) || 50;
    if (e.key === 'ArrowLeft') setPosition(current - 5);
    if (e.key === 'ArrowRight') setPosition(current + 5);
    if (e.key === 'Home') setPosition(0);
    if (e.key === 'End') setPosition(100);
  });
}
