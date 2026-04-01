// filmstrip block — cellulose film aesthetic horizontal scroll loop
// AEM EDS block: receives a table with image rows, renders as looping filmstrip
//
// URL demo params:
//   ?demo=approval  — stops scroll, shows ✓/✗ per frame
//                     dispatches filmstrip:approve / filmstrip:reject events
//                     corkboard listens and reveals or stamps the corresponding polaroid

function ripFrame(frameEl, idx, primary = true) {
  const rect = frameEl.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const tearY = 0.51; // 51% down

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${w}px;height:${h}px;pointer-events:none;z-index:9999;overflow:hidden;border-radius:2px;`;

  const topClip = `polygon(0 0,100% 0,100% ${tearY * 100}%,0 ${tearY * 100}%)`;
  const botClip = `polygon(0 ${tearY * 100}%,100% ${tearY * 100}%,100% 100%,0 100%)`;

  [topClip, botClip].forEach((clip, i) => {
    const half = document.createElement('div');
    half.style.cssText = `position:absolute;inset:0;overflow:hidden;clip-path:${clip};`;
    const origImg = frameEl.querySelector('img');
    if (origImg) {
      const img = origImg.cloneNode(true);
      img.style.cssText = `width:${w}px;height:${h}px;object-fit:cover;position:absolute;top:0;left:0;filter:sepia(0.4) saturate(0.8) brightness(1.15) contrast(0.9);`;
      half.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'filmstrip-img-placeholder';
      ph.style.cssText = `width:${w}px;height:${h}px;position:absolute;top:0;left:0;`;
      half.appendChild(ph);
    }
    overlay.appendChild(half);

    const target = i === 0
      ? { transform: `translate(-${w * 0.32}px,-${h * 0.6}px) rotate(-13deg)`, opacity: 0 }
      : { transform: `translate(${w * 0.28}px,${h * 0.6}px) rotate(11deg)`, opacity: 0 };
    half.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, target], {
      duration: 520, easing: 'cubic-bezier(0.55,0,1,0.45)', fill: 'forwards',
    });
  });

  document.body.appendChild(overlay);
  frameEl.style.visibility = 'hidden';

  setTimeout(() => {
    overlay.remove();
    frameEl.style.visibility = '';
    frameEl.classList.add('filmstrip-rejected');
    frameEl.querySelector('.filmstrip-approval-bar')?.remove();
    if (primary) document.dispatchEvent(new CustomEvent('filmstrip:reject', { detail: { index: idx } }));
  }, 510);
}

function approveFrame(frameEl, idx, primary = true) {
  frameEl.classList.add('filmstrip-approved');
  frameEl.querySelector('.filmstrip-approval-bar')?.remove();

  const badge = document.createElement('div');
  badge.className = 'filmstrip-approved-badge';
  badge.textContent = '✓ APPROVED';
  frameEl.appendChild(badge);

  if (primary) document.dispatchEvent(new CustomEvent('filmstrip:approve', { detail: { index: idx } }));
}

function initApprovalMode(block, frames, strip) {
  block.classList.add('approval-mode');

  // Add buttons to ALL frame elements (originals + loop clones).
  // Both sets share the same logical index (mod frames.length) so a decision
  // on either set marks its twin too and fires the corkboard event once.
  const acted = new Set();

  [...strip.querySelectorAll('.filmstrip-frame')].forEach((frameEl, pos) => {
    const idx = pos % frames.length;
    frameEl.dataset.frameIdx = idx;

    const bar = document.createElement('div');
    bar.className = 'filmstrip-approval-bar';

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'filmstrip-btn filmstrip-btn-reject';
    rejectBtn.setAttribute('aria-label', 'Reject');
    rejectBtn.textContent = '✗';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'filmstrip-btn filmstrip-btn-approve';
    approveBtn.setAttribute('aria-label', 'Approve');
    approveBtn.textContent = '✓';

    rejectBtn.addEventListener('click', () => {
      if (acted.has(idx)) return;
      acted.add(idx);
      // Mark all frames with the same logical index
      [...strip.querySelectorAll(`[data-frame-idx="${idx}"]`)]
        .forEach((el) => ripFrame(el, idx, el === frameEl));
    });

    approveBtn.addEventListener('click', () => {
      if (acted.has(idx)) return;
      acted.add(idx);
      [...strip.querySelectorAll(`[data-frame-idx="${idx}"]`)]
        .forEach((el) => approveFrame(el, idx, el === frameEl));
    });

    bar.append(rejectBtn, approveBtn);
    frameEl.appendChild(bar);
  });

  document.dispatchEvent(new CustomEvent('filmstrip:approvalmode'));
}

export default function decorate(block) {
  // Collect all images + optional captions from block rows
  const frames = [];
  [...block.children].forEach((row, rowIdx) => {
    const img = row.querySelector('img');
    const captionEl = [...row.querySelectorAll('p, div')].find((el) => !el.querySelector('img'));
    const caption = captionEl ? captionEl.textContent.trim() : '';

    frames.push({
      src: img ? img.src : null,
      alt: img ? img.alt : `Frame ${rowIdx + 1}`,
      caption,
      index: rowIdx + 1,
    });
  });

  if (!frames.length) {
    block.textContent = '';
    return;
  }

  block.textContent = '';

  const strip = document.createElement('div');
  strip.className = 'filmstrip-track';

  // Render frames twice for seamless CSS loop
  [frames, frames].forEach((set, setIdx) => {
    set.forEach((frame, idx) => {
      const el = document.createElement('div');
      el.className = 'filmstrip-frame';
      el.dataset.frame = String(frame.index).padStart(3, '0');
      el.dataset.code = `EXP-${String((setIdx * set.length + idx + 1) * 7 + 13).padStart(4, '0')}`;

      if (frame.src) {
        const img = document.createElement('img');
        img.src = frame.src;
        img.alt = frame.alt;
        img.loading = 'lazy';
        el.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'filmstrip-img-placeholder';
        el.appendChild(placeholder);
      }

      if (frame.caption) {
        const cap = document.createElement('div');
        cap.className = 'filmstrip-caption';
        cap.textContent = frame.caption;
        el.appendChild(cap);
      }

      strip.appendChild(el);
    });
  });

  const vigLeft = document.createElement('div');
  vigLeft.className = 'filmstrip-vignette filmstrip-vignette-left';
  const vigRight = document.createElement('div');
  vigRight.className = 'filmstrip-vignette filmstrip-vignette-right';

  block.appendChild(vigLeft);
  block.appendChild(strip);
  block.appendChild(vigRight);

  const baseDuration = 28;
  const duration = Math.max(baseDuration, frames.length * 4.5);
  strip.style.animationDuration = `${duration}s`;

  // Demo URL param: approval mode
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === 'approval') {
    initApprovalMode(block, frames, strip);
  }
}
