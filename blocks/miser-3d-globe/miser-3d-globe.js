import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';

const PALETTES = {
  blue: {
    globe: 0x0a1628,
    wire: 0x1e4d8c,
    pinLow: 0x3b82f6,
    pinHigh: 0x60efff,
    ambient: 0x0d2040,
    key: 0x4488ff,
  },
  green: {
    globe: 0x091a12,
    wire: 0x145a32,
    pinLow: 0x22c55e,
    pinHigh: 0xa3ffb0,
    ambient: 0x0a2010,
    key: 0x30d158,
  },
  amber: {
    globe: 0x1a1000,
    wire: 0x5a3a00,
    pinLow: 0xf59e0b,
    pinHigh: 0xfde68a,
    ambient: 0x201500,
    key: 0xf0a020,
  },
  purple: {
    globe: 0x0d0a1a,
    wire: 0x3d1f6e,
    pinLow: 0xa855f7,
    pinHigh: 0xe4b8ff,
    ambient: 0x120a28,
    key: 0xb070f8,
  },
};

function parseRows(block) {
  const rows = [...block.children];
  const readCell = (row, idx = 1) => {
    const cells = [...row.children];
    if (cells.length > idx) return cells[idx].textContent.trim();
    return cells[0]?.textContent.trim() || '';
  };

  // Collect all text from all paragraphs in data cell (row 0)
  const dataRow = rows[0];
  let dataText = '';
  if (dataRow) {
    const dataCell = dataRow.children.length > 1 ? dataRow.children[1] : dataRow.children[0];
    if (dataCell) {
      dataText = [...dataCell.querySelectorAll('p')]
        .map((p) => p.textContent.trim())
        .filter(Boolean)
        .join('\n');
      if (!dataText) dataText = dataCell.textContent.trim();
    }
  }

  const color = rows[1] ? readCell(rows[1]) : '';
  const height = rows[2] ? readCell(rows[2]) : '';

  return { dataText, color, height };
}

function parseMarkers(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((parts) => parts.length >= 4)
    .map(([label, lat, lon, value]) => {
      const latN = Number(lat);
      const lonN = Number(lon);
      const valN = Number(value);
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null;
      return {
        label, lat: latN, lon: lonN, value: Number.isFinite(valN) ? valN : 0,
      };
    })
    .filter(Boolean);
}

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

function normalizeValues(markers) {
  if (!markers.length) return markers;
  const vals = markers.map((m) => m.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  return markers.map((m) => ({ ...m, norm: (m.value - min) / range }));
}

let threeReady = null;
function ensureThree() {
  if (!threeReady) threeReady = loadScript(THREE_URL);
  return threeReady;
}

export default async function decorate(block) {
  const { dataText, color, height } = parseRows(block);

  while (block.firstChild) block.removeChild(block.firstChild);

  // Apply height
  const heightValue = height.trim();
  let canvasHeight = 420;
  if (heightValue) {
    const numeric = parseInt(heightValue, 10);
    if (numeric > 0) canvasHeight = numeric;
  }
  block.style.setProperty('--globe-height', `${canvasHeight}px`);

  const canvas = document.createElement('canvas');
  canvas.className = 'miser-3d-globe-canvas';
  canvas.style.height = `${canvasHeight}px`;

  const tooltip = document.createElement('div');
  tooltip.className = 'miser-3d-globe-tooltip';
  tooltip.style.display = 'none';

  block.append(canvas, tooltip);

  await ensureThree();
  const { THREE } = window;
  if (!THREE) return;

  const paletteKey = (color || 'blue').toLowerCase().trim();
  const palette = PALETTES[paletteKey] || PALETTES.blue;

  const markers = normalizeValues(parseMarkers(dataText));

  const GLOBE_RADIUS = 2;

  // Scene
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 6.5);

  // Lighting
  scene.add(new THREE.AmbientLight(palette.ambient, 0.8));
  const key = new THREE.DirectionalLight(palette.key, 1.4);
  key.position.set(4, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-3, -2, -2);
  scene.add(fill);

  // Globe group (dragged by user)
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Solid globe
  const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48);
  const globeMat = new THREE.MeshStandardMaterial({
    color: palette.globe,
    metalness: 0.3,
    roughness: 0.65,
  });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  globeGroup.add(globe);

  // Wireframe overlay
  const wireGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.012, 36, 24);
  const wireFrameGeo = new THREE.WireframeGeometry(wireGeo);
  const wireMat = new THREE.LineBasicMaterial({
    color: palette.wire,
    transparent: true,
    opacity: 0.45,
  });
  const wireframe = new THREE.LineSegments(wireFrameGeo, wireMat);
  globeGroup.add(wireframe);

  // Marker pins
  const pinObjects = []; // { mesh, marker }

  markers.forEach((m) => {
    const { norm } = m;
    const pinRadius = 0.045 + norm * 0.07;
    const pinColor = new THREE.Color(palette.pinLow).lerp(new THREE.Color(palette.pinHigh), norm);

    const pos = latLonToVec3(m.lat, m.lon, GLOBE_RADIUS + pinRadius);

    // Glow halo (larger, more transparent)
    const haloR = pinRadius * (2.2 + norm * 1.8);
    const haloGeo = new THREE.SphereGeometry(haloR, 8, 6);
    const haloMat = new THREE.MeshBasicMaterial({
      color: pinColor,
      transparent: true,
      opacity: 0.22 + norm * 0.25,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(pos.x, pos.y, pos.z);
    globeGroup.add(halo);

    // Solid pin core
    const pinGeo = new THREE.SphereGeometry(pinRadius, 10, 8);
    const pinMat = new THREE.MeshStandardMaterial({
      color: pinColor,
      emissive: pinColor,
      emissiveIntensity: 0.7 + norm * 0.5,
      metalness: 0.1,
      roughness: 0.3,
    });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(pos.x, pos.y, pos.z);
    globeGroup.add(pin);

    pinObjects.push({ mesh: pin, marker: m });
  });

  // Resize handling
  const resize = () => {
    const rect = block.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, canvasHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(block);
  resize();

  // Auto-rotation state
  let autoRotY = 0;

  // Drag state
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };
  let dragRotX = 0;
  let dragRotY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    prevMouse = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    prevMouse = { x: e.clientX, y: e.clientY };
    dragRotY += dx * 0.008;
    dragRotX += dy * 0.008;
    dragRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, dragRotX));
  });

  canvas.addEventListener('pointerup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });

  canvas.style.cursor = 'grab';

  // Zoom via scroll
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.01;
    camera.position.z = Math.max(3.5, Math.min(10, camera.position.z));
  }, { passive: false });

  // Tooltip / click via raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const getMouseNDC = (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  canvas.addEventListener('click', (e) => {
    getMouseNDC(e);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pinObjects.map((p) => p.mesh));
    if (!hits.length) {
      tooltip.style.display = 'none';
      return;
    }
    const hit = hits[0];
    const found = pinObjects.find((p) => p.mesh === hit.object);
    if (!found) return;
    const { marker } = found;
    const rect = block.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    tooltip.textContent = `${marker.label}: ${marker.value}`;
    tooltip.style.display = 'block';
    tooltip.style.left = `${cx + 12}px`;
    tooltip.style.top = `${cy - 8}px`;
  });

  // Hide tooltip on globe click-miss
  canvas.addEventListener('mousemove', (e) => {
    getMouseNDC(e);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pinObjects.map((p) => p.mesh));
    let cursor = isDragging ? 'grabbing' : 'grab';
    if (hits.length) cursor = 'pointer';
    canvas.style.cursor = cursor;
  });

  // Animate
  let running = false;
  let frame = 0;

  const animate = () => {
    if (!running) return;
    frame = requestAnimationFrame(animate);

    if (!isDragging) autoRotY += 0.0025;

    globeGroup.rotation.y = autoRotY + dragRotY;
    globeGroup.rotation.x = dragRotX;

    renderer.render(scene, camera);
  };

  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((en) => en.isIntersecting);
    if (visible && !running) {
      running = true;
      animate();
    } else if (!visible && running) {
      running = false;
      cancelAnimationFrame(frame);
    }
  }, { threshold: 0.1 });
  io.observe(block);
}
