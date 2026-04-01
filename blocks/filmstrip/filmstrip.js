// filmstrip block — cellulose film aesthetic horizontal scroll loop
// AEM EDS block: receives a table with image rows, renders as looping filmstrip

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

  // Need at least 1 frame; duplicate set for seamless loop
  if (!frames.length) {
    block.textContent = '';
    return;
  }

  // Build DOM
  block.textContent = '';

  const strip = document.createElement('div');
  strip.className = 'filmstrip-track';

  // Render frames twice (original + clone) for seamless CSS loop
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

  // Vignettes
  const vigLeft = document.createElement('div');
  vigLeft.className = 'filmstrip-vignette filmstrip-vignette-left';
  const vigRight = document.createElement('div');
  vigRight.className = 'filmstrip-vignette filmstrip-vignette-right';

  block.appendChild(vigLeft);
  block.appendChild(strip);
  block.appendChild(vigRight);

  // Adjust animation duration based on frame count (more frames = slower)
  const baseDuration = 28;
  const duration = Math.max(baseDuration, frames.length * 4.5);
  strip.style.animationDuration = `${duration}s`;
}
