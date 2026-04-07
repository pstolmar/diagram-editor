import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';

// Degree-to-color gradient: low → cool blue, high → warm orange-red
const COLOR_LOW = [0.18, 0.52, 0.96];
const COLOR_HIGH = [0.96, 0.42, 0.12];

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function parseData(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const nodeMap = new Map();
  const links = [];

  lines.forEach((line) => {
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) return;
    const [src, tgt, w] = parts;
    const weight = Number.isFinite(Number(w)) && Number(w) > 0 ? Number(w) : 1;
    if (!nodeMap.has(src)) nodeMap.set(src, { id: src, degree: 0 });
    if (!nodeMap.has(tgt)) nodeMap.set(tgt, { id: tgt, degree: 0 });
    nodeMap.get(src).degree += weight;
    nodeMap.get(tgt).degree += weight;
    links.push({ source: src, target: tgt, weight });
  });

  return { nodes: [...nodeMap.values()], links };
}

/**
 * Fruchterman-Reingold spring layout in 3D.
 * Runs `iterations` steps then freezes — no ongoing simulation.
 */
function springLayout(nodes, links, iterations) {
  const n = nodes.length;
  if (!n) return;

  const spread = Math.max(3, Math.cbrt(n) * 2.8);

  nodes.forEach((nd) => {
    nd.x = (Math.random() - 0.5) * spread;
    nd.y = (Math.random() - 0.5) * spread;
    nd.z = (Math.random() - 0.5) * spread;
  });

  const nodeById = new Map(nodes.map((nd) => [nd.id, nd]));
  const k = spread / Math.sqrt(n);
  const k2 = k * k;

  for (let iter = 0; iter < iterations; iter += 1) {
    const cool = (1 - iter / iterations) ** 1.5;
    const temp = spread * 0.15 * cool;

    nodes.forEach((nd) => { nd.dx = 0; nd.dy = 0; nd.dz = 0; });

    // Repulsion between every pair
    for (let i = 0; i < n - 1; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dz = a.z - b.z;
        const dist2 = (dx * dx + dy * dy + dz * dz) || 1e-4;
        const dist = Math.sqrt(dist2);
        const force = k2 / dist2;
        dx /= dist; dy /= dist; dz /= dist;
        a.dx += dx * force; a.dy += dy * force; a.dz += dz * force;
        b.dx -= dx * force; b.dy -= dy * force; b.dz -= dz * force;
      }
    }

    // Attraction along edges
    links.forEach(({ source, target, weight }) => {
      const a = nodeById.get(source);
      const b = nodeById.get(target);
      if (!a || !b) return;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
      const force = (dist / k) * weight;
      dx /= dist; dy /= dist; dz /= dist;
      a.dx += dx * force; a.dy += dy * force; a.dz += dz * force;
      b.dx -= dx * force; b.dy -= dy * force; b.dz -= dz * force;
    });

    // Clamp displacement to temperature
    nodes.forEach((nd) => {
      const disp = Math.sqrt(nd.dx * nd.dx + nd.dy * nd.dy + nd.dz * nd.dz) || 1e-4;
      const scale = Math.min(disp, temp) / disp;
      nd.x += nd.dx * scale;
      nd.y += nd.dy * scale;
      nd.z += nd.dz * scale;
    });
  }
}

function normalizeHeight(value) {
  if (!value) return '';
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

function readRowValue(row) {
  if (!row) return '';
  const cells = [...row.children];
  return cells.length > 1 ? cells[1].textContent.trim() : row.textContent.trim();
}

export default async function decorate(block) {
  const rows = [...block.children];

  const rawData = readRowValue(rows[0]);
  const rawIter = readRowValue(rows[1]);
  const rawHeight = readRowValue(rows[2]);

  rows.forEach((r) => r.remove());

  const iterations = Math.max(10, Math.min(500, parseInt(rawIter, 10) || 150));
  const heightCss = normalizeHeight(rawHeight) || '420px';

  block.style.height = heightCss;
  block.style.minHeight = heightCss;

  const canvas = document.createElement('canvas');
  canvas.className = 'fg-canvas';
  block.append(canvas);

  if (!rawData) return;

  const { nodes, links } = parseData(rawData);
  if (!nodes.length) return;

  // Run layout synchronously before loading Three.js (pure math)
  springLayout(nodes, links, iterations);

  await loadScript(THREE_URL);
  const { THREE } = window;
  if (!THREE) return;

  // ── Scene setup ──────────────────────────────────────────────────
  const scene = new THREE.Scene();

  const spread = Math.max(3, Math.cbrt(nodes.length) * 2.8);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.z = spread * 2.4;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // All graph objects live inside this group so rotation is unified
  const group = new THREE.Group();
  scene.add(group);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(3, 4, 5);
  scene.add(sun);

  // ── Nodes (colored spheres by degree) ────────────────────────────
  const degrees = nodes.map((nd) => nd.degree);
  const minDeg = Math.min(...degrees);
  const maxDeg = Math.max(...degrees);
  const degRange = maxDeg - minDeg || 1;

  const sphereGeo = new THREE.SphereGeometry(0.18, 16, 10);
  const nodeObjects = new Map();

  nodes.forEach((nd) => {
    const t = (nd.degree - minDeg) / degRange;
    const [r, g, b] = lerp3(COLOR_LOW, COLOR_HIGH, t);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      roughness: 0.3,
      metalness: 0.5,
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.position.set(nd.x, nd.y, nd.z);
    group.add(mesh);
    nodeObjects.set(nd.id, mesh);
  });

  // ── Links (THREE.Line) ────────────────────────────────────────────
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.5,
  });

  links.forEach(({ source, target }) => {
    const a = nodeObjects.get(source);
    const b = nodeObjects.get(target);
    if (!a || !b) return;
    const geo = new THREE.BufferGeometry().setFromPoints([a.position, b.position]);
    group.add(new THREE.Line(geo, lineMat));
  });

  // ── Inline orbit controls (mouse drag rotates group) ─────────────
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  const onMouseMove = (e) => {
    if (!dragging) return;
    group.rotation.y += (e.clientX - lastX) * 0.01;
    group.rotation.x += (e.clientY - lastY) * 0.01;
    lastX = e.clientX;
    lastY = e.clientY;
  };

  const onMouseUp = () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    group.rotation.y += (e.touches[0].clientX - lastX) * 0.01;
    group.rotation.x += (e.touches[0].clientY - lastY) * 0.01;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }, { passive: true });

  canvas.style.cursor = 'grab';

  // ── Resize ───────────────────────────────────────────────────────
  const resize = () => {
    const { width, height } = block.getBoundingClientRect();
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  new ResizeObserver(resize).observe(block);
  resize();

  // ── Render loop (visibility-gated) ───────────────────────────────
  let running = false;
  let raf = 0;

  const animate = () => {
    if (!running) return;
    raf = requestAnimationFrame(animate);
    if (!dragging) {
      group.rotation.y += 0.003;
    }
    renderer.render(scene, camera);
  };

  new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !running) {
        running = true;
        animate();
      } else if (!visible && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    },
    { threshold: 0.1 },
  ).observe(block);
}
