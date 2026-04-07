/* m3d-scatter — THREE.js 3D scatter plot block
   CSV format: label,x,y,z,color  (header row skipped)
   Color column optional; auto-palette applied when absent.
*/

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';

// Scene scale: data maps to [0, S]³
const S = 2;
const TICKS = 5; // divisions per axis (ticks at 20 % intervals)
const TICK_LEN = 0.05;

const AUTO_PALETTE = [
  '#00c8f0', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8',
  '#ff9f43', '#54a0ff', '#ff6fd8', '#00d2d3', '#7bed9f',
];

// ─── THREE loader ────────────────────────────────────────────────────────────

function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = THREE_CDN;
    s.onload = () => resolve(window.THREE);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function fmtTick(v, span) {
  if (span >= 50) return Math.round(v).toString();
  if (span >= 5) return v.toFixed(1);
  return v.toFixed(2);
}

// ─── demo data ────────────────────────────────────────────────────────────────

function buildDemoData() {
  const clusters = [
    {
      pfx: 'Alpha', cx: 15, cy: 22, cz: 68, col: '#00c8f0',
    },
    {
      pfx: 'Beta', cx: 73, cy: 60, cz: 24, col: '#ff6b6b',
    },
    {
      pfx: 'Gamma', cx: 33, cy: 78, cz: 52, col: '#51cf66',
    },
    {
      pfx: 'Delta', cx: 84, cy: 38, cz: 82, col: '#ffd43b',
    },
    {
      pfx: 'Epsilon', cx: 50, cy: 55, cz: 30, col: '#cc5de8',
    },
  ];
  const rows = [];
  clusters.forEach((c) => {
    for (let i = 0; i < 10; i += 1) {
      rows.push({
        label: `${c.pfx}-${String(i + 1).padStart(2, '0')}`,
        x: clamp(c.cx + (Math.random() - 0.5) * 28, 0, 100),
        y: clamp(c.cy + (Math.random() - 0.5) * 28, 0, 100),
        z: clamp(c.cz + (Math.random() - 0.5) * 28, 0, 100),
        color: c.col,
      });
    }
  });
  return rows;
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const rows = lines.slice(1).map((line, idx) => {
    const p = line.split(',').map((s) => s.trim());
    if (p.length < 4) return null;
    const x = parseFloat(p[1]);
    const y = parseFloat(p[2]);
    const z = parseFloat(p[3]);
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return null;
    return {
      label: p[0] || `P${idx + 1}`, x, y, z, color: p[4] || null,
    };
  }).filter(Boolean);
  if (!rows.length) return null;
  // assign auto-palette if any point lacks a color
  if (rows.some((r) => !r.color)) {
    rows.forEach((r, i) => { r.color = r.color || AUTO_PALETTE[i % AUTO_PALETTE.length]; });
  }
  return rows;
}

// ─── canvas-texture sprite (axis labels & tick values) ───────────────────────

function makeSprite(THREE, text, { px = 20, color = '#3a6080' } = {}) {
  const font = `${px}px ui-monospace,"Cascadia Code",Menlo,Consolas,monospace`;
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(text).width) + 10;
  cvs.width = tw;
  cvs.height = px + 6;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, 5, px);
  const tex = new THREE.CanvasTexture(cvs);
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const unitH = 0.15 * (px / 20);
  sprite.scale.set(unitH * (cvs.width / cvs.height), unitH, 1);
  return sprite;
}

// ─── axes + ticks ─────────────────────────────────────────────────────────────

function buildAxes(THREE, scene, xRange, yRange, zRange) {
  const verts = [];
  const push = (...v) => verts.push(...v);

  // Three main axis lines from origin
  push(0, 0, 0, S, 0, 0); // X
  push(0, 0, 0, 0, S, 0); // Y
  push(0, 0, 0, 0, 0, S); // Z

  // Tick marks at each interval
  for (let t = 1; t <= TICKS; t += 1) {
    const f = (t / TICKS) * S;
    push(f, 0, 0, f, -TICK_LEN, 0); // X tick (drop)
    push(f, 0, 0, f, 0, TICK_LEN); // X tick (fwd)
    push(0, f, 0, -TICK_LEN, f, 0); // Y tick (left)
    push(0, 0, f, 0, -TICK_LEN, f); // Z tick (drop)
    push(0, 0, f, -TICK_LEN, 0, f); // Z tick (left)
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x1a3858, transparent: true, opacity: 0.85 });
  scene.add(new THREE.LineSegments(geo, mat));

  // Axis name labels (slightly beyond axis ends)
  [
    { text: 'X', pos: [S + 0.18, 0, 0] },
    { text: 'Y', pos: [0, S + 0.18, 0] },
    { text: 'Z', pos: [0, 0, S + 0.18] },
  ].forEach(({ text, pos }) => {
    const sp = makeSprite(THREE, text, { px: 24, color: '#3a7090' });
    sp.position.set(...pos);
    scene.add(sp);
  });

  // Tick value labels
  const ranges = [xRange, yRange, zRange];
  const positions = [
    (f) => [f, -0.14, 0], // X → below axis
    (f) => [-0.18, f, 0], // Y → left of axis
    (f) => [0, -0.14, f], // Z → below axis
  ];
  for (let t = 1; t <= TICKS; t += 1) {
    const f = (t / TICKS) * S;
    ranges.forEach((r, axis) => {
      const val = r.min + (t / TICKS) * r.span;
      const sp = makeSprite(THREE, fmtTick(val, r.span), { px: 16, color: '#28506a' });
      sp.position.set(...positions[axis](f));
      scene.add(sp);
    });
  }
}

// ─── compute data range ───────────────────────────────────────────────────────

function makeRange(arr) {
  const mn = Math.min(...arr);
  const mx = Math.max(...arr);
  const span = mx - mn || 1;
  return { min: mn, max: mx, span };
}

// ─── main decorate ────────────────────────────────────────────────────────────

export default async function decorate(block) {
  // Extract CSV from block (pre/code tag or raw text)
  let csvText = null;
  const pre = block.querySelector('pre, code');
  if (pre) {
    csvText = pre.textContent;
  } else {
    const raw = block.textContent.trim();
    if (raw.includes(',') && raw.includes('\n')) csvText = raw;
  }

  const data = (csvText && parseCSV(csvText)) || buildDemoData();

  const xRange = makeRange(data.map((r) => r.x));
  const yRange = makeRange(data.map((r) => r.y));
  const zRange = makeRange(data.map((r) => r.z));

  // ── DOM ──────────────────────────────────────────────────────────────────────
  block.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.className = 'm3d-scatter-canvas';
  block.appendChild(canvas);

  const tooltip = document.createElement('div');
  tooltip.className = 'm3d-scatter-tooltip';
  block.appendChild(tooltip);

  const loader = document.createElement('div');
  loader.className = 'm3d-scatter-loader';
  loader.textContent = 'initializing…';
  block.appendChild(loader);

  // ── THREE ─────────────────────────────────────────────────────────────────
  const THREE = await loadThree();
  loader.remove();

  const getSize = () => ({
    w: block.clientWidth || 800,
    h: block.clientHeight || 420,
  });
  const { w, h } = getSize();

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false); // false = don't overwrite CSS sizing
  renderer.setClearColor(0x060614, 1);

  // Scene + fog
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060614, 0.13);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 40);

  // Lighting (ambient warmth + key for specular depth)
  scene.add(new THREE.AmbientLight(0x102040, 4));
  const key = new THREE.DirectionalLight(0x3366aa, 2);
  key.position.set(3, 4, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x001030, 0.6);
  fill.position.set(-2, -1, -3);
  scene.add(fill);

  // ── axes ────────────────────────────────────────────────────────────────────
  buildAxes(THREE, scene, xRange, yRange, zRange);

  // ── point cloud ──────────────────────────────────────────────────────────────
  const positions = new Float32Array(data.length * 3);
  const colors = new Float32Array(data.length * 3);

  data.forEach((d, i) => {
    positions[i * 3] = ((d.x - xRange.min) / xRange.span) * S;
    positions[i * 3 + 1] = ((d.y - yRange.min) / yRange.span) * S;
    positions[i * 3 + 2] = ((d.z - zRange.min) / zRange.span) * S;
    const c = new THREE.Color(d.color);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  });

  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ptGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const ptMat = new THREE.PointsMaterial({
    size: 0.075,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const cloud = new THREE.Points(ptGeo, ptMat);
  scene.add(cloud);

  // ── orbit state ───────────────────────────────────────────────────────────────
  const orbit = {
    theta: Math.PI * 0.22,
    phi: Math.PI * 0.33,
    radius: 5.0,
    dragging: false,
    px: 0,
    py: 0,
    target: new THREE.Vector3(S / 2, S / 2, S / 2),
  };

  function syncCamera() {
    const sp = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sp * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * Math.cos(orbit.phi),
      orbit.target.z + orbit.radius * sp * Math.cos(orbit.theta),
    );
    camera.lookAt(orbit.target);
  }
  syncCamera();

  // ── mouse interaction ─────────────────────────────────────────────────────────
  canvas.addEventListener('mousedown', (e) => {
    orbit.dragging = true;
    orbit.px = e.clientX;
    orbit.py = e.clientY;
    canvas.classList.add('is-dragging');
  });
  window.addEventListener('mouseup', () => {
    orbit.dragging = false;
    canvas.classList.remove('is-dragging');
  });
  window.addEventListener('mousemove', (e) => {
    if (!orbit.dragging) return;
    orbit.theta -= (e.clientX - orbit.px) * 0.007;
    orbit.phi = clamp(orbit.phi - (e.clientY - orbit.py) * 0.007, 0.05, Math.PI - 0.05);
    orbit.px = e.clientX;
    orbit.py = e.clientY;
    syncCamera();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.radius = clamp(orbit.radius * (1 + e.deltaY * 0.001), 1.5, 12);
    syncCamera();
  }, { passive: false });

  // touch orbit
  canvas.addEventListener('touchstart', (e) => {
    const [touch] = e.touches;
    orbit.dragging = true;
    orbit.px = touch.clientX;
    orbit.py = touch.clientY;
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!orbit.dragging || !e.touches[0]) return;
    orbit.theta -= (e.touches[0].clientX - orbit.px) * 0.007;
    orbit.phi = clamp(orbit.phi - (e.touches[0].clientY - orbit.py) * 0.007, 0.05, Math.PI - 0.05);
    orbit.px = e.touches[0].clientX;
    orbit.py = e.touches[0].clientY;
    syncCamera();
  }, { passive: true });
  canvas.addEventListener('touchend', () => { orbit.dragging = false; }, { passive: true });

  // ── raycasting / hover ────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.06;
  const mouse = new THREE.Vector2();
  let hovered = -1;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(cloud);
    if (hits.length) {
      const idx = hits[0].index;
      if (idx !== hovered) {
        hovered = idx;
        const d = data[idx];
        tooltip.innerHTML = `<span class="tt-name">${d.label}</span>`
          + `X&thinsp;${d.x.toFixed(2)}&emsp;Y&thinsp;${d.y.toFixed(2)}&emsp;Z&thinsp;${d.z.toFixed(2)}`;
      }
      tooltip.style.opacity = '1';
      tooltip.style.left = `${e.clientX - rect.left + 14}px`;
      tooltip.style.top = `${e.clientY - rect.top - 10}px`;
    } else {
      hovered = -1;
      tooltip.style.opacity = '0';
    }
  });
  canvas.addEventListener('mouseleave', () => {
    hovered = -1;
    tooltip.style.opacity = '0';
  });

  // ── resize ────────────────────────────────────────────────────────────────────
  const ro = new ResizeObserver(() => {
    const nw = block.clientWidth;
    const nh = block.clientHeight;
    if (!nw || !nh) return;
    renderer.setSize(nw, nh, false);
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
  });
  ro.observe(block);

  // ── render loop ───────────────────────────────────────────────────────────────
  let raf;
  function render() {
    raf = requestAnimationFrame(render);
    // gentle auto-rotate when idle
    if (!orbit.dragging) {
      orbit.theta += 0.0007;
      syncCamera();
    }
    renderer.render(scene, camera);
  }
  render();

  // cleanup when block is removed from DOM
  const cleanObs = new MutationObserver(() => {
    if (!document.body.contains(block)) {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cleanObs.disconnect();
      renderer.dispose();
    }
  });
  cleanObs.observe(document.body, { childList: true, subtree: true });
}
