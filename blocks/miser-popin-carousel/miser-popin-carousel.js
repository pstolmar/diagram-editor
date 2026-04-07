const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Parse "3x2", "3×2", or plain "3" into {cols, rows} */
function parseGridDims(row) {
  if (!row) return { cols: 4, rows: 2 };
  const text = row.textContent.trim();
  const match = text.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (match) {
    return {
      cols: clamp(parseInt(match[1], 10), 2, 6),
      rows: clamp(parseInt(match[2], 10), 1, 4),
    };
  }
  const n = clamp(parseInt(text, 10) || 3, 2, 5);
  return { cols: n, rows: n };
}

function parseEffectName(row) {
  if (!row) return 'sizzle';
  return row.textContent.trim() || 'sizzle';
}

function parseInterval(row) {
  if (!row) return 4;
  const parsed = parseFloat(row.textContent.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 4;
  return parsed;
}

/** Curated photo sets by category */
const PHOTO_SETS = {
  ocean: [
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600&h=450&fit=crop',
  ],
  balloons: [
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1553697388-94e804e2f0f6?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1548438294-1ad5d5f4f063?w=600&h=450&fit=crop',
  ],
  landscape: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&h=450&fit=crop',
  ],
};

function resolvePhotoCategory(row) {
  const qp = new URLSearchParams(window.location.search).get('photos');
  const rowVal = row ? row.textContent.trim().toLowerCase() : '';
  const cat = qp || rowVal;
  return PHOTO_SETS[cat] || null;
}

function collectImages(rows, photoCategory) {
  if (photoCategory) {
    return photoCategory.map((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.alt = 'carousel photo';
      return img;
    });
  }
  return rows.map((row) => row.querySelector('picture, img')).filter(Boolean);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/** Always sets --pc-delay so cycling slots never inherit a stale stagger value */
function applyEntrance(slot, delay) {
  slot.classList.remove('pc-enter');
  // Force reflow to restart animation
  // eslint-disable-next-line no-unused-expressions
  slot.offsetWidth;
  slot.style.setProperty('--pc-delay', delay !== undefined ? `${delay}s` : '0s');
  slot.classList.add('pc-enter');
}

export default async function decorate(block) {
  const rows = [...block.children];
  const dims = parseGridDims(rows[0]);
  const effectName = parseEffectName(rows[1]);
  const intervalSeconds = parseInterval(rows[2]);
  const photoCategory = resolvePhotoCategory(rows[3]);
  const imageRows = photoCategory ? [] : rows.slice(4);

  const { cols, rows: numRows } = dims;
  const slotCount = cols * numRows;
  const images = collectImages(imageRows, photoCategory);
  const overflow = images.slice(slotCount);

  const grid = document.createElement('div');
  grid.className = 'pc-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${numRows}, 1fr)`;
  grid.dataset.effect = effectName;

  const slots = [];
  for (let i = 0; i < slotCount; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'pc-slot';
    const img = images[i];
    if (img) slot.append(img);
    slots.push(slot);
    grid.append(slot);
  }

  block.replaceChildren(grid);

  let initialAnimDone = false;
  const slotTimers = new Map();
  let cycling = false;

  const scheduleSlot = (slot) => {
    if (!cycling) return;
    const delay = randomBetween(intervalSeconds * 1.0, intervalSeconds * 4.0) * 1000;
    const timeoutId = window.setTimeout(() => {
      if (!cycling) return;
      if (Math.random() < 0.35 || overflow.length === 0) {
        scheduleSlot(slot);
        return;
      }
      const next = overflow.shift();
      const current = slot.querySelector('picture, img');

      const doSwap = () => {
        if (current) overflow.push(current);
        if (next) {
          slot.replaceChildren(next);
          // Always set --pc-delay to 0s on cycle swaps — no stale stagger
          applyEntrance(slot, 0);
        }
        scheduleSlot(slot);
      };

      if (effectName === 'shatter' && current) {
        // Phase 1: animate out; Phase 2: swap in (animationend or 750ms fallback)
        let done = false;
        const once = () => { if (!done) { done = true; doSwap(); } };
        current.classList.add('pc-shatter-out');
        current.addEventListener('animationend', once, { once: true });
        window.setTimeout(once, 750);
      } else {
        doSwap();
      }
    }, delay);
    slotTimers.set(slot, timeoutId);
  };

  const startCycling = () => {
    if (cycling || overflow.length === 0) return;
    cycling = true;
    slots.forEach((slot) => scheduleSlot(slot));
  };

  const stopCycling = () => {
    cycling = false;
    slotTimers.forEach((timeoutId) => window.clearTimeout(timeoutId));
    slotTimers.clear();
  };

  const STAGGER_MS = 200;
  const ANIM_DURATION_MS = 1600;

  const playInitialEntrance = () => {
    if (initialAnimDone) return;
    initialAnimDone = true;
    slots.forEach((slot, i) => {
      applyEntrance(slot, (i * STAGGER_MS) / 1000);
    });
    window.setTimeout(startCycling, slots.length * STAGGER_MS + ANIM_DURATION_MS);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        playInitialEntrance();
      } else {
        stopCycling();
      }
    });
  }, { threshold: 0.1 });

  observer.observe(grid);
}
