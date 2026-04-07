import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';

const BAR_SCALE = 5; // max bar height in world units
const ANIM_DURATION = 1400; // ms total for all bars to grow
const ANIM_STAGGER = 120; // ms between each bar starting

const DEFAULT_BARS = `category,value,color
Solar,15,#f59e0b
Terra,28,#10b981
Aqua,42,#0ea5e9
Ignis,35,#ef4444
Aether,55,#a855f7
Nexus,68,#00c8a0
Flux,45,#f97316`;

const DEFAULT_GRID = `row,col,value
0,0,18
0,1,45
0,2,72
0,3,38
1,0,60
1,1,91
1,2,55
1,3,28
2,0,35
2,1,48
2,2,83
2,3,65
3,0,70
3,1,22
3,2,58
3,3,90`;

// ─── helpers ────────────────────────────────────────────────────────────────

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function lightenHex(THREE, hexStr, amount) {
  const col = new THREE.Color(hexStr);
  const hsl = {};
  col.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.max(0, hsl.s - 0.1), Math.min(1, hsl.l + amount));
}

function heatColor(THREE, t) {
  const stops = [
    [0, '#1e3a8a'],
    [0.25, '#0ea5e9'],
    [0.5, '#10b981'],
    [0.75, '#f59e0b'],
    [1, '#ef4444'],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const lT = (t - lo[0]) / ((hi[0] - lo[0]) || 1);
  return new THREE.Color(lo[1]).lerp(new THREE.Color(hi[1]), lT);
}

function readRowValue(row) {
  if (!row) return '';
  const cells = [...row.children];
  return cells.length > 1 ? cells[1].textContent.trim() : row.textContent.trim();
}

function parseBarsCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const firstNum = parseFloat((lines[0] || '').split(',')[1]);
  const start = Number.isNaN(firstNum) ? 1 : 0;
  return lines.slice(start).map((line) => {
    const [cat, val, col] = line.split(',').map((s) => s.trim());
    return { category: cat || '', value: parseFloat(val) || 0, color: col || '' };
  }).filter((d) => d.category);
}

function parseGridCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const firstNum = parseFloat((lines[0] || '').split(',')[2]);
  const start = Number.isNaN(firstNum) ? 1 : 0;
  return lines.slice(start).map((line) => {
    const [r, c, v] = line.split(',').map((s) => s.trim());
    return { row: parseInt(r, 10) || 0, col: parseInt(c, 10) || 0, value: parseFloat(v) || 0 };
  });
}

// ─── scene building ─────────────────────────────────────────────────────────

function buildScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080c14');
  scene.fog = new THREE.FogExp2('#080c14', 0.028);
  return scene;
}

function buildLighting(THREE, scene) {
  // Soft hemisphere fill
  const hemi = new THREE.HemisphereLight('#c8deff', '#0a0f1e', 0.6);
  scene.add(hemi);

  // Main key – warm overhead
  const key = new THREE.DirectionalLight('#fff4e0', 1.35);
  key.position.set(10, 18, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  key.shadow.bias = -0.0003;
  scene.add(key);

  // Cool rim from rear-left
  const rim = new THREE.DirectionalLight('#2563eb', 0.45);
  rim.position.set(-10, 6, -8);
  scene.add(rim);

  // Subtle fill from front-right
  const fill = new THREE.DirectionalLight('#e0f0ff', 0.22);
  fill.position.set(6, 2, 12);
  scene.add(fill);
}

function buildFloor(THREE, scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshStandardMaterial({
      color: '#0d1526',
      roughness: 0.92,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  // Two-tone grid: major + minor
  const gridMinor = new THREE.GridHelper(30, 30, 0x1a2540, 0x1a2540);
  gridMinor.position.y = 0.001;
  scene.add(gridMinor);

  const gridMajor = new THREE.GridHelper(30, 6, 0x253660, 0x1a2540);
  gridMajor.position.y = 0.002;
  scene.add(gridMajor);
}

// ─── bar factory ────────────────────────────────────────────────────────────

const DEFAULT_COLORS = ['#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#a855f7', '#00c8a0', '#f97316', '#e879f9', '#84cc16'];

function createBar(THREE, scene, x, z, targetH, colorHex, barW, barD) {
  const sideColor = new THREE.Color(colorHex);
  const capColor = lightenHex(THREE, colorHex, 0.3);

  const sideMat = new THREE.MeshStandardMaterial({
    color: sideColor,
    roughness: 0.42,
    metalness: 0.22,
  });

  const capMat = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.18,
    metalness: 0.38,
    emissive: capColor,
    emissiveIntensity: 0.14,
  });

  const capH = Math.max(0.06, targetH * 0.045 + 0.04);

  // Bar starts at height=0, grows via animate
  const barGeo = new THREE.BoxGeometry(barW, 1, barD); // Y=1 unit, we scale it
  const barMesh = new THREE.Mesh(barGeo, sideMat);
  barMesh.castShadow = true;
  barMesh.receiveShadow = false;
  // Pivot at bottom: shift geometry up by 0.5 so scale grows upward
  barGeo.translate(0, 0.5, 0);
  barMesh.position.set(x, 0, z);
  barMesh.scale.y = 0; // starts flat (animated to targetH)
  scene.add(barMesh);

  // Cap: rides on top of the bar
  const capMesh = new THREE.Mesh(new THREE.BoxGeometry(barW, capH, barD), capMat);
  capMesh.position.set(x, 0, z); // updated each frame
  scene.add(capMesh);

  return {
    barMesh, capMesh, targetH, capH,
  };
}

// ─── labels ─────────────────────────────────────────────────────────────────

function addLabel(labelLayer, labelData, THREE, text, worldX, worldY, worldZ, type) {
  const el = document.createElement('span');
  el.className = `m3d-bars-label m3d-bars-label-${type}`;
  el.textContent = text;
  el.style.opacity = '0';
  labelLayer.append(el);
  labelData.push({ el, pos: new THREE.Vector3(worldX, worldY, worldZ), type });
  return el;
}

// ─── main export ────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const blockRows = [...block.children];
  const variant = (readRowValue(blockRows[0]) || 'bars').toLowerCase();
  const heightRaw = readRowValue(blockRows[1]) || '420';
  const csvRaw = readRowValue(blockRows[2]);

  const isGrid = variant === 'grid';
  const heightPx = Math.max(200, parseInt(heightRaw, 10) || 420);
  const csvText = csvRaw || (isGrid ? DEFAULT_GRID : DEFAULT_BARS);

  const barsData = isGrid ? null : parseBarsCsv(csvText);
  const gridData = isGrid ? parseGridCsv(csvText) : null;

  blockRows.forEach((r) => r.remove());

  // ── DOM structure
  const container = document.createElement('div');
  container.className = 'm3d-bars-container';
  container.style.height = `${heightPx}px`;

  const canvas = document.createElement('canvas');
  canvas.className = 'm3d-bars-canvas';

  const labelLayer = document.createElement('div');
  labelLayer.className = 'm3d-bars-labels';
  labelLayer.setAttribute('aria-hidden', 'true');

  container.append(canvas, labelLayer);
  block.append(container);

  await loadScript(THREE_URL);
  const { THREE } = window;
  if (!THREE) return;

  // ── Scene, camera, renderer
  const scene = buildScene(THREE);

  const FRUSTUM = 13;
  const getAsp = () => Math.max(0.1, container.offsetWidth / Math.max(1, container.offsetHeight));
  let asp = getAsp();

  const camera = new THREE.OrthographicCamera(
    -(FRUSTUM * asp) / 2,
    (FRUSTUM * asp) / 2,
    FRUSTUM / 2,
    -FRUSTUM / 2,
    0.1,
    220,
  );

  let theta = Math.PI * 0.28;
  let phi = Math.PI / 6;
  const ORBIT_R = 22;

  const updateCamera = () => {
    camera.position.set(
      ORBIT_R * Math.cos(phi) * Math.sin(theta),
      ORBIT_R * Math.sin(phi),
      ORBIT_R * Math.cos(phi) * Math.cos(theta),
    );
    camera.lookAt(0, BAR_SCALE * 0.4, 0);
    camera.updateProjectionMatrix();
  };
  updateCamera();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  buildLighting(THREE, scene);
  buildFloor(THREE, scene);

  // ── Build bars / grid
  const bars = []; // { barMesh, capMesh, targetH, capH, startTime }
  const labelData = [];

  let animStart = null; // set when first render begins

  if (!isGrid && barsData && barsData.length) {
    const maxVal = Math.max(...barsData.map((d) => d.value), 1);
    const spacing = 1.9;
    const barW = 1.05;
    const barD = 1.05;
    const ox = -((barsData.length - 1) * spacing) / 2;

    barsData.forEach(({ category, value, color }, i) => {
      const x = ox + i * spacing;
      const colorHex = color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const targetH = maxVal > 0 ? (value / maxVal) * BAR_SCALE : 0.08;
      const bar = createBar(THREE, scene, x, 0, targetH, colorHex, barW, barD);
      bar.startDelay = i * ANIM_STAGGER;
      bars.push(bar);

      // value label – will fade in after bar reaches full height
      const valEl = addLabel(labelLayer, labelData, THREE, String(Math.round(value)), x, targetH + 0.55, 0, 'value');
      bar.valEl = valEl;

      // axis label on front edge
      addLabel(labelLayer, labelData, THREE, category, x, 0, barD / 2 + 0.85, 'axis');
    });
  } else if (isGrid && gridData && gridData.length) {
    const maxVal = Math.max(...gridData.map((d) => d.value), 1);
    const colKeys = [...new Set(gridData.map((d) => d.col))].sort((a, b) => a - b);
    const rowKeys = [...new Set(gridData.map((d) => d.row))].sort((a, b) => a - b);
    const spacing = 1.55;
    const ox = -((colKeys.length - 1) * spacing) / 2;
    const oz = -((rowKeys.length - 1) * spacing) / 2;
    let idx = 0;

    gridData.forEach(({ row, col, value }) => {
      const ci = colKeys.indexOf(col);
      const ri = rowKeys.indexOf(row);
      const x = ox + ci * spacing;
      const z = oz + ri * spacing;
      const t = value / maxVal;
      const colorHex = `#${heatColor(THREE, t).getHexString()}`;
      const targetH = Math.max(0.08, t * BAR_SCALE);
      const bar = createBar(THREE, scene, x, z, targetH, colorHex, 1.1, 1.1);
      bar.startDelay = idx * (ANIM_STAGGER * 0.6);
      bars.push(bar);

      const valEl = addLabel(labelLayer, labelData, THREE, String(Math.round(value)), x, targetH + 0.5, z, 'value');
      bar.valEl = valEl;
      idx += 1;
    });

    colKeys.forEach((col, ci) => {
      addLabel(labelLayer, labelData, THREE, `C${col}`, ox + ci * spacing, 0, oz + rowKeys.length * spacing * 0.5 + 0.6, 'axis');
    });
    rowKeys.forEach((row, ri) => {
      addLabel(labelLayer, labelData, THREE, `R${row}`, ox - 1.3, 0, oz + ri * spacing, 'axis');
    });
  }

  // ── Resize
  const resize = () => {
    const w = Math.max(1, container.offsetWidth);
    const h = Math.max(1, container.offsetHeight);
    renderer.setSize(w, h, false);
    asp = w / h;
    camera.left = -(FRUSTUM * asp) / 2;
    camera.right = (FRUSTUM * asp) / 2;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ── Label projection
  const tmpV = new THREE.Vector3();
  const syncLabels = () => {
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    labelData.forEach(({ el, pos }) => {
      tmpV.copy(pos).project(camera);
      const px = (tmpV.x * 0.5 + 0.5) * w;
      const py = (-tmpV.y * 0.5 + 0.5) * h;
      const onScreen = tmpV.z <= 1 && px > -40 && px < w + 40 && py > -25 && py < h + 25;
      el.style.display = onScreen ? 'block' : 'none';
      if (onScreen) {
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
      }
    });
  };

  // ── Drag / zoom
  let dragging = false;
  let dragX = 0;
  let dragY = 0;

  const startDrag = (cx, cy) => {
    dragging = true; dragX = cx; dragY = cy;
    container.classList.add('is-dragging');
  };
  const moveDrag = (cx, cy) => {
    if (!dragging) return;
    theta -= (cx - dragX) * 0.011;
    phi = Math.max(0.04, Math.min(1.5, phi + (cy - dragY) * 0.008));
    dragX = cx; dragY = cy;
    updateCamera();
  };
  const endDrag = () => {
    dragging = false;
    container.classList.remove('is-dragging');
  };

  canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);
  canvas.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', endDrag, { passive: true });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.zoom = Math.max(0.25, Math.min(6, camera.zoom * (e.deltaY > 0 ? 0.94 : 1.06)));
    camera.updateProjectionMatrix();
  }, { passive: false });

  // ── Render loop
  let running = false;
  let frameId = 0;

  const animate = (ts) => {
    if (!running) return;
    frameId = window.requestAnimationFrame(animate);

    // Init animation start time on first frame
    if (animStart === null) animStart = ts;
    const elapsed = ts - animStart;

    // Grow bars
    bars.forEach((bar) => {
      const barElapsed = elapsed - bar.startDelay;
      if (barElapsed <= 0) return;

      const progress = Math.min(1, barElapsed / ANIM_DURATION);
      const eased = easeOutCubic(progress);
      const curH = eased * bar.targetH;

      bar.barMesh.scale.y = Math.max(0.001, curH);
      bar.capMesh.position.y = curH + bar.capH / 2;

      // Fade in value label once bar is mostly grown
      if (bar.valEl && progress > 0.8) {
        bar.valEl.style.opacity = String(Math.min(1, (progress - 0.8) / 0.2));
      }
    });

    renderer.render(scene, camera);
    syncLabels();
  };

  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible && !running) {
      running = true;
      window.requestAnimationFrame(animate);
    } else if (!visible && running) {
      running = false;
      window.cancelAnimationFrame(frameId);
    }
  }, { threshold: 0.1 });
  io.observe(block);
}
