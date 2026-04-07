import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';
const BAR_SCALE = 4; // max bar height in world units

const DEFAULT_BARS = `category,value,color
Alpha,85,#00c8a0
Beta,62,#4f8ef7
Gamma,93,#f7724f
Delta,41,#f7c24f
Epsilon,78,#a855f7`;

const DEFAULT_GRID = `row,col,value
0,0,45
0,1,72
0,2,38
0,3,91
1,0,60
1,1,85
1,2,55
1,3,70
2,0,30
2,1,48
2,2,95
2,3,65`;

function lightenColor(THREE, hexStr, amount) {
  const col = new THREE.Color(hexStr);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.9, Math.min(1, hsl.l + amount));
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
  const localT = (t - lo[0]) / ((hi[0] - lo[0]) || 1);
  return new THREE.Color(lo[1]).lerp(new THREE.Color(hi[1]), localT);
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

  // DOM structure
  const container = document.createElement('div');
  container.className = 'miser-3d-bars-container';
  container.style.height = `${heightPx}px`;

  const canvas = document.createElement('canvas');
  canvas.className = 'miser-3d-bars-canvas';

  const labelLayer = document.createElement('div');
  labelLayer.className = 'miser-3d-bars-labels';
  labelLayer.setAttribute('aria-hidden', 'true');

  container.append(canvas, labelLayer);
  block.append(container);

  await loadScript(THREE_URL);
  const { THREE } = window;
  if (!THREE) return;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1117');

  // Orthographic camera for isometric look
  const FRUSTUM = 12;
  const getAsp = () => Math.max(0.1, container.offsetWidth / Math.max(1, container.offsetHeight));
  let asp = getAsp();

  const camera = new THREE.OrthographicCamera(
    -(FRUSTUM * asp) / 2,
    (FRUSTUM * asp) / 2,
    FRUSTUM / 2,
    -FRUSTUM / 2,
    0.1,
    200,
  );

  // Spherical orbit state
  let theta = Math.PI * 0.3;
  let phi = Math.PI / 5.5;
  const ORBIT_R = 20;

  const updateCamera = () => {
    camera.position.set(
      ORBIT_R * Math.cos(phi) * Math.sin(theta),
      ORBIT_R * Math.sin(phi),
      ORBIT_R * Math.cos(phi) * Math.cos(theta),
    );
    camera.lookAt(0, BAR_SCALE * 0.35, 0);
    camera.updateProjectionMatrix();
  };
  updateCamera();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
  scene.add(new THREE.AmbientLight(0xd0dff0, 0.55));
  const sunLight = new THREE.DirectionalLight(0xfff8f0, 1.1);
  sunLight.position.set(10, 14, 8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 60;
  sunLight.shadow.camera.left = -15;
  sunLight.shadow.camera.right = 15;
  sunLight.shadow.camera.top = 15;
  sunLight.shadow.camera.bottom = -15;
  scene.add(sunLight);
  const rimLight = new THREE.DirectionalLight(0x4080ff, 0.35);
  rimLight.position.set(-8, 6, -6);
  scene.add(rimLight);

  // Floor (receives shadows)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.95, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  // Subtle grid
  scene.add(new THREE.GridHelper(22, 22, 0x1c2d42, 0x1c2d42));

  // Label tracking
  const labelData = [];

  const addBar = (x, z, value, maxValue, colorHex, barW, barD) => {
    const barH = maxValue > 0 ? (value / maxValue) * BAR_SCALE : 0.05;
    const capH = Math.max(0.05, barH * 0.04 + 0.035);

    const sideColor = new THREE.Color(colorHex);
    const capColor = lightenColor(THREE, colorHex, 0.28);

    const sideMat = new THREE.MeshStandardMaterial({
      color: sideColor, roughness: 0.5, metalness: 0.15,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: capColor,
      roughness: 0.3,
      metalness: 0.25,
      emissive: capColor,
      emissiveIntensity: 0.08,
    });

    const barMesh = new THREE.Mesh(new THREE.BoxGeometry(barW, barH, barD), sideMat);
    barMesh.position.set(x, barH / 2, z);
    barMesh.castShadow = true;
    scene.add(barMesh);

    const capMesh = new THREE.Mesh(new THREE.BoxGeometry(barW, capH, barD), capMat);
    capMesh.position.set(x, barH + capH / 2, z);
    scene.add(capMesh);

    return barH;
  };

  const addLabel = (text, worldX, worldY, worldZ, type) => {
    const el = document.createElement('span');
    el.className = `miser-3d-bars-label miser-3d-bars-label-${type}`;
    el.textContent = text;
    labelLayer.append(el);
    labelData.push({ el, pos: new THREE.Vector3(worldX, worldY, worldZ) });
  };

  const DEFAULT_COLORS = ['#00c8a0', '#4f8ef7', '#f7724f', '#f7c24f', '#a855f7', '#22d3ee', '#fb7185', '#84cc16'];

  if (isGrid && gridData && gridData.length) {
    const maxVal = Math.max(...gridData.map((d) => d.value), 1);
    const colKeys = [...new Set(gridData.map((d) => d.col))].sort((a, b) => a - b);
    const rowKeys = [...new Set(gridData.map((d) => d.row))].sort((a, b) => a - b);
    const spacing = 1.5;
    const ox = -((colKeys.length - 1) * spacing) / 2;
    const oz = -((rowKeys.length - 1) * spacing) / 2;

    gridData.forEach(({ row, col, value }) => {
      const ci = colKeys.indexOf(col);
      const ri = rowKeys.indexOf(row);
      const x = ox + ci * spacing;
      const z = oz + ri * spacing;
      const color = `#${heatColor(THREE, value / maxVal).getHexString()}`;
      const barH = addBar(x, z, value, maxVal, color, 1.1, 1.1);
      addLabel(String(Math.round(value)), x, barH + 0.45, z, 'value');
    });

    colKeys.forEach((col, ci) => {
      addLabel(`C${col}`, ox + ci * spacing, 0, oz + rowKeys.length * spacing * 0.5 + 0.5, 'axis');
    });
    rowKeys.forEach((row, ri) => {
      addLabel(`R${row}`, ox - 1.1, 0, oz + ri * spacing, 'axis');
    });
  } else if (!isGrid && barsData && barsData.length) {
    const maxVal = Math.max(...barsData.map((d) => d.value), 1);
    const spacing = 1.8;
    const barW = 1.0;
    const barD = 1.0;
    const ox = -((barsData.length - 1) * spacing) / 2;

    barsData.forEach(({ category, value, color }, i) => {
      const x = ox + i * spacing;
      const colorHex = color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const barH = addBar(x, 0, value, maxVal, colorHex, barW, barD);
      addLabel(String(Math.round(value)), x, barH + 0.45, 0, 'value');
      addLabel(category, x, 0, barD / 2 + 0.75, 'axis');
    });
  }

  // Resize
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

  // Label projection
  const tmpV = new THREE.Vector3();
  const syncLabels = () => {
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    labelData.forEach(({ el, pos }) => {
      tmpV.copy(pos).project(camera);
      const px = (tmpV.x * 0.5 + 0.5) * w;
      const py = (-tmpV.y * 0.5 + 0.5) * h;
      const onScreen = tmpV.z <= 1 && px > -30 && px < w + 30 && py > -20 && py < h + 20;
      el.style.display = onScreen ? 'block' : 'none';
      if (onScreen) {
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
      }
    });
  };

  // Drag interaction
  let dragging = false;
  let dragX = 0;
  let dragY = 0;

  const startDrag = (cx, cy) => {
    dragging = true;
    dragX = cx;
    dragY = cy;
    container.classList.add('is-dragging');
  };

  const moveDrag = (cx, cy) => {
    if (!dragging) return;
    theta -= (cx - dragX) * 0.012;
    phi = Math.max(0.05, Math.min(1.45, phi + (cy - dragY) * 0.009));
    dragX = cx;
    dragY = cy;
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
    camera.zoom = Math.max(0.3, Math.min(5, camera.zoom * (e.deltaY > 0 ? 0.95 : 1.05)));
    camera.updateProjectionMatrix();
  }, { passive: false });

  // Render loop
  let running = false;
  let frameId = 0;

  const animate = () => {
    if (!running) return;
    frameId = window.requestAnimationFrame(animate);
    renderer.render(scene, camera);
    syncLabels();
  };

  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (visible && !running) {
      running = true;
      animate();
    } else if (!visible && running) {
      running = false;
      window.cancelAnimationFrame(frameId);
    }
  }, { threshold: 0.1 });
  io.observe(block);
}
