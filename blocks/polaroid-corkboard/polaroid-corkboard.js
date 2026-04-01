// polaroid-corkboard block
// AEM EDS block: table rows = polaroid photos
// Row columns: image | caption | state (aged/faded/cracked) | interaction (hover/click/both)
//
// Interaction types:
//   hover-reveal  — mouseenter reveals color, mouseleave restores mono; subtle zoom on hover
//   click-zoom    — click zooms toward camera; click again dismisses
//   both          — hover reveals AND click zooms

const MONO_FILTER = {
  aged: 'grayscale(1) contrast(1.22) brightness(.72) sepia(.15)',
  faded: 'grayscale(.82) contrast(.9) brightness(1.04) sepia(.28) saturate(.28)',
  cracked: 'grayscale(1) contrast(1.38) brightness(.64)',
};

// Default photos if no block content — demo fallback
const DEFAULT_PHOTOS = [
  {
    caption: 'Campaign 01 · 2024', state: 'aged', rot: -4, sw: 3.8, sd: 0, mt: 0, ix: 'both', bg: '#1a4a8a', ac: '#45c2c2', ic: '◈',
  },
  {
    caption: 'Brand Shoot 12', state: 'faded', rot: 2, sw: 4.2, sd: -1.1, mt: 0, ix: 'click-zoom', bg: '#8a1a5a', ac: '#c1188b', ic: '◉',
  },
  {
    caption: 'Event 2023 ✦', state: 'cracked', rot: -1, sw: 3.1, sd: -0.7, mt: -18, ix: 'hover-reveal', bg: '#1a5a3a', ac: '#45c2c2', ic: '✦',
  },
  {
    caption: 'Partner Day · Q3', state: 'aged', rot: 5, sw: 4.5, sd: -2.0, mt: 8, ix: 'hover-reveal', bg: '#5a3a10', ac: '#e8a020', ic: '◈',
  },
  {
    caption: 'Leadership Summit', state: 'faded', rot: -6, sw: 3.6, sd: -0.3, mt: -8, ix: 'click-zoom', bg: '#1a1a7a', ac: '#7788dd', ic: '◎',
  },
  {
    caption: 'Innovation Lab', state: 'aged', rot: 3, sw: 4.0, sd: -1.8, mt: 0, ix: 'both', bg: '#5a1a1a', ac: '#c1188b', ic: '◉',
  },
];

function parseBoardData(block) {
  const photos = [];
  const rows = [...block.children];

  // First row may be a label row (single cell, no image)
  let labelText = 'Archive · Brand Photography';
  let startRow = 0;

  if (rows.length > 0) {
    const firstCells = [...rows[0].children];
    const hasImage = firstCells.some((c) => c.querySelector('img'));
    if (!hasImage && firstCells[0] && firstCells[0].textContent.trim()) {
      labelText = firstCells[0].textContent.trim();
      startRow = 1;
    }
  }

  for (let i = startRow; i < rows.length; i += 1) {
    const cells = [...rows[i].children];
    const img = cells[0] ? cells[0].querySelector('img') : null;
    const caption = cells[1] ? cells[1].textContent.trim() : '';
    const state = (cells[2] ? cells[2].textContent.trim() : 'aged') || 'aged';
    const ix = (cells[3] ? cells[3].textContent.trim() : 'both') || 'both';

    // Deterministic rotation from index: varies between -7 and +7
    const rot = ((i * 37 + 11) % 15) - 7;
    const sw = 3.5 + (i % 5) * 0.22;
    const sd = -(i % 7) * 0.31;
    const mt = i % 3 === 0 ? 0 : ((i % 5) - 2) * 9;

    photos.push({
      img, caption, state, ix, rot, sw, sd, mt,
    });
  }

  return { labelText, photos };
}

function buildPhoto(data, idx) {
  const {
    img, caption, state, ix, rot, sw, sd, mt,
  } = data;

  const pol = document.createElement('div');
  const stateClass = ['aged', 'faded', 'cracked'].includes(state) ? state : 'aged';
  pol.className = `polaroid-photo ${stateClass} swaying`;
  if (ix === 'hover-reveal' || ix === 'both') pol.classList.add('hover-reveal');
  if (ix === 'click-zoom' || ix === 'both') pol.classList.add('click-zoom');
  if (ix === 'hover-reveal') pol.classList.add('hover-zoom');

  const mono = MONO_FILTER[stateClass] || MONO_FILTER.aged;
  const fallAnim = rot >= 0 ? 'polaroid-fall-cw' : 'polaroid-fall-ccw';

  pol.style.cssText = [
    `--base-r:rotate(${rot}deg)`,
    `--sway-a:rotate(${rot - 1.5}deg)`,
    `--sway-b:rotate(${rot + 1.5}deg)`,
    `--rot:${rot}deg`,
    `--sw:${sw}s`,
    `--sd:${sd}s`,
    `--fall-anim:${fallAnim}`,
    `--fall-delay:${idx * 0.14}s`,
    `--mono:${mono}`,
    '--color:none',
    mt ? `margin-top:${mt}px` : '',
  ].filter(Boolean).join(';');

  // Photo area
  const imgWrap = document.createElement('div');
  imgWrap.className = 'polaroid-photo-img-wrap';

  const inner = document.createElement('div');
  inner.className = 'polaroid-photo-inner';

  if (img) {
    const pic = img.cloneNode(true);
    pic.loading = 'lazy';
    inner.appendChild(pic);
  } else {
    // CSS gradient placeholder (demo fallback)
    const defaults = DEFAULT_PHOTOS[idx % DEFAULT_PHOTOS.length];
    const ph = document.createElement('div');
    ph.className = 'polaroid-photo-img-placeholder';
    ph.style.background = `linear-gradient(135deg, ${defaults.bg} 0%, ${defaults.ac}55 100%)`;
    ph.textContent = defaults.ic;
    inner.appendChild(ph);
  }

  imgWrap.appendChild(inner);
  pol.appendChild(imgWrap);

  if (caption) {
    const cap = document.createElement('div');
    cap.className = 'polaroid-photo-caption';
    cap.textContent = caption;
    pol.appendChild(cap);
  }

  return pol;
}

function wireInteractions(grid, originalData) {
  const allPhotos = () => [...grid.querySelectorAll('.polaroid-photo')];

  // Hover reveal
  grid.querySelectorAll('.polaroid-photo.hover-reveal').forEach((p, i) => {
    const state = originalData[i] ? originalData[i].state : 'aged';
    p.addEventListener('mouseenter', () => {
      p.classList.remove('aged', 'faded', 'cracked');
      p.classList.add('revealed');
    });
    p.addEventListener('mouseleave', () => {
      if (!p.classList.contains('zoomed')) {
        p.classList.remove('revealed');
        p.classList.add(state);
      }
    });
  });

  // Click zoom
  grid.querySelectorAll('.polaroid-photo.click-zoom').forEach((p) => {
    p.addEventListener('click', (e) => {
      e.stopPropagation();
      const isZoomed = p.classList.contains('zoomed');
      allPhotos().forEach((q) => q.classList.remove('zoomed'));
      document.body.classList.remove('polaroid-has-zoom');
      if (!isZoomed) {
        p.classList.remove('aged', 'faded', 'cracked');
        p.classList.add('revealed', 'zoomed');
        document.body.classList.add('polaroid-has-zoom');
      }
    });
  });

  // Dismiss zoom on body click
  document.addEventListener('click', () => {
    allPhotos().forEach((p) => p.classList.remove('zoomed'));
    document.body.classList.remove('polaroid-has-zoom');
  });
}

function dropPhotos(sceneEl) {
  sceneEl.querySelectorAll('.polaroid-photo').forEach((p) => {
    p.classList.remove(
      'aged',
      'faded',
      'cracked',
      'swaying',
      'revealed',
      'hover-reveal',
      'click-zoom',
      'hover-zoom',
      'zoomed',
    );
    p.classList.add('falling');
  });
}

function tipScene(sceneEl) {
  sceneEl.classList.add('tipped');
  setTimeout(() => dropPhotos(sceneEl), 450);
}

function resetScene(sceneEl, originalData) {
  sceneEl.classList.remove('tipped');
  sceneEl.querySelectorAll('.polaroid-photo').forEach((p, i) => {
    p.classList.remove('falling', 'revealed', 'zoomed');
    const d = originalData[i];
    if (!d) return;
    p.classList.add(d.state, 'swaying');
    if (d.ix === 'hover-reveal' || d.ix === 'both') p.classList.add('hover-reveal');
    if (d.ix === 'click-zoom' || d.ix === 'both') p.classList.add('click-zoom');
    if (d.ix === 'hover-reveal') p.classList.add('hover-zoom');
  });
  document.body.classList.remove('polaroid-has-zoom');
}

export default function decorate(block) {
  const { labelText, photos: parsedPhotos } = parseBoardData(block);

  // Use default data if no photos authored
  const photos = parsedPhotos.length ? parsedPhotos : DEFAULT_PHOTOS.map((d) => ({
    img: null,
    caption: d.caption,
    state: d.state,
    ix: d.ix,
    rot: d.rot,
    sw: d.sw,
    sd: d.sd,
    mt: d.mt,
  }));

  // Clear block content
  block.textContent = '';

  // Floor
  const floor = document.createElement('div');
  floor.className = 'polaroid-corkboard-floor';

  // 3-D plane
  const plane = document.createElement('div');
  plane.className = 'polaroid-corkboard-plane';

  // Cork board
  const board = document.createElement('div');
  board.className = 'polaroid-corkboard-board';

  const label = document.createElement('div');
  label.className = 'polaroid-corkboard-label';
  label.textContent = labelText;

  const grid = document.createElement('div');
  grid.className = 'polaroid-corkboard-grid';

  photos.forEach((data, idx) => {
    grid.appendChild(buildPhoto(data, idx));
  });

  board.appendChild(label);
  board.appendChild(grid);
  plane.appendChild(board);

  block.appendChild(floor);
  block.appendChild(plane);

  wireInteractions(grid, photos);

  // Scroll-triggered tip + drop
  let tipped = false;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!tipped && !entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
        tipped = true;
        tipScene(block);
      }
      if (tipped && entry.isIntersecting && entry.intersectionRatio > 0.5) {
        tipped = false;
        resetScene(block, photos);
      }
    },
    { threshold: [0, 0.5] },
  );
  observer.observe(block);

  // Demo URL params
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo');
  if (demo === 'corkboard' || demo === 'new') {
    setTimeout(() => block.scrollIntoView({ behavior: 'smooth' }), 100);
  }
  if (demo === 'fallen') {
    setTimeout(() => {
      block.scrollIntoView();
      tipped = true;
      tipScene(block);
    }, 200);
  }
}
