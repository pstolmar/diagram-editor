export default function decorate(block) {
  const rows = [...block.children];
  const imgs = rows[0] ? [...rows[0].children].map((c) => c.querySelector('img')) : [];
  const labels = rows[1] ? [...rows[1].children].map((c) => c.textContent.trim()) : ['Before', 'After'];
  const caption = rows[2] ? rows[2].children[0]?.textContent.trim() : '';

  const before = imgs[0];
  const after = imgs[1];

  if (!before || !after) return;
  before.draggable = false;
  after.draggable = false;

  block.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'ic-tm-wrap';

  const clip = document.createElement('div');
  clip.className = 'ic-tm-clip';

  const imgBefore = document.createElement('div');
  imgBefore.className = 'ic-tm-before';
  imgBefore.append(before);

  const imgAfter = document.createElement('div');
  imgAfter.className = 'ic-tm-after';
  imgAfter.append(after);

  const handle = document.createElement('div');
  handle.className = 'ic-tm-handle';
  handle.setAttribute('role', 'slider');
  handle.setAttribute('aria-label', 'Compare slider');
  handle.setAttribute('aria-valuenow', '50');
  handle.setAttribute('aria-valuemin', '0');
  handle.setAttribute('aria-valuemax', '100');
  handle.tabIndex = 0;

  const pill = document.createElement('div');
  pill.className = 'ic-tm-pill';
  pill.textContent = '⟷';
  handle.append(pill);

  const labelBefore = document.createElement('span');
  labelBefore.className = 'ic-tm-label ic-tm-label-before';
  labelBefore.textContent = labels[0] || 'Before';

  const labelAfter = document.createElement('span');
  labelAfter.className = 'ic-tm-label ic-tm-label-after';
  labelAfter.textContent = labels[1] || 'After';

  clip.append(imgAfter, imgBefore, handle, labelBefore, labelAfter);
  wrap.append(clip);

  if (caption) {
    const cap = document.createElement('p');
    cap.className = 'ic-tm-caption';
    cap.textContent = caption;
    wrap.append(cap);
  }

  block.append(wrap);

  let pct = 50;

  function updatePosition(x) {
    const rect = clip.getBoundingClientRect();
    pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
    imgBefore.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    handle.style.left = `${pct}%`;
    handle.setAttribute('aria-valuenow', Math.round(pct));
  }

  updatePosition(clip.getBoundingClientRect().left + clip.getBoundingClientRect().width / 2);

  let dragging = false;

  clip.addEventListener('mousedown', (e) => {
    dragging = true;
    updatePosition(e.clientX);
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) updatePosition(e.clientX);
  });

  window.addEventListener('mouseup', () => { dragging = false; });

  clip.addEventListener('touchstart', (e) => {
    dragging = true;
    updatePosition(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (dragging) updatePosition(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchend', () => { dragging = false; });

  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      pct = Math.max(0, pct - 2);
    } else if (e.key === 'ArrowRight') {
      pct = Math.min(100, pct + 2);
    } else {
      return;
    }
    imgBefore.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    handle.style.left = `${pct}%`;
    handle.setAttribute('aria-valuenow', Math.round(pct));
  });
}
