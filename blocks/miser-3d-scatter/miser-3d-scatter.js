import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';
const DEFAULT_COLOR = '#0070f3';
const DEFAULT_POINT_SIZE = 6;
const DEFAULT_HEIGHT = 420;
const FOV_DEG = 50;
const AXIS_COLOR = 0x94a3b8;

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((s) => s.trim());
    return {
      label: parts[0] || '',
      x: parseFloat(parts[1]),
      y: parseFloat(parts[2]),
      z: parseFloat(parts[3]),
      color: parts[4] || DEFAULT_COLOR,
    };
  }).filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y) && !Number.isNaN(p.z));
}

function getRange(vals) {
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const span = mx - mn || 1;
  return { min: mn - span * 0.05, max: mx + span * 0.05 };
}

function normVal(v, min, max) {
  return ((v - min) / (max - min)) * 2 - 1;
}

function hexToRgb(hex) {
  const s = hex.replace('#', '').padEnd(6, '0');
  return {
    r: parseInt(s.slice(0, 2), 16) / 255,
    g: parseInt(s.slice(2, 4), 16) / 255,
    b: parseInt(s.slice(4, 6), 16) / 255,
  };
}

function buildAxes(THREE, xr, yr, zr) {
  const verts = [];
  const ext = 1.15;
  const tk = 0.05;

  // Main axes
  verts.push(-ext, 0, 0, ext, 0, 0); // X
  verts.push(0, -ext, 0, 0, ext, 0); // Y
  verts.push(0, 0, -ext, 0, 0, ext); // Z

  // Ticks at 0%, 20%, 40%, 60%, 80%, 100% of each axis range
  for (let t = 0; t <= 5; t += 1) {
    const frac = t / 5;
    const xv = normVal(xr.min + frac * (xr.max - xr.min), xr.min, xr.max);
    verts.push(xv, -tk, 0, xv, tk, 0);
    const yv = normVal(yr.min + frac * (yr.max - yr.min), yr.min, yr.max);
    verts.push(-tk, yv, 0, tk, yv, 0);
    const zv = normVal(zr.min + frac * (zr.max - zr.min), zr.min, zr.max);
    verts.push(0, -tk, zv, 0, tk, zv);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: AXIS_COLOR }));
}

export default async function decorate(block) {
  let csvText = '';
  let pointSize = DEFAULT_POINT_SIZE;
  let height = DEFAULT_HEIGHT;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = (cells[0]?.textContent || '').trim().toLowerCase().replace(/\s/g, '');
    const val = cells.length > 1 ? (cells[1]?.textContent || '').trim() : '';

    if (key === 'pointsize') {
      pointSize = parseFloat(val) || DEFAULT_POINT_SIZE;
    } else if (key === 'height') {
      height = parseFloat(val) || DEFAULT_HEIGHT;
    } else {
      const rowText = row.textContent.trim();
      if (rowText) csvText += (csvText ? '\n' : '') + rowText;
    }
  });

  block.innerHTML = '';
  block.style.height = `${height}px`;

  const canvas = document.createElement('canvas');
  canvas.className = 'scatter-canvas';
  block.appendChild(canvas);

  const tooltip = document.createElement('div');
  tooltip.className = 'miser-3d-scatter-tooltip';
  block.appendChild(tooltip);

  const points = parseCsv(csvText);
  if (!points.length) return;

  await loadScript(THREE_URL);
  const { THREE } = window;
  if (!THREE) return;

  const xr = getRange(points.map((p) => p.x));
  const yr = getRange(points.map((p) => p.y));
  const zr = getRange(points.map((p) => p.z));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene.add(buildAxes(THREE, xr, yr, zr));

  // Build point cloud with per-vertex colors
  const posBuf = new Float32Array(points.length * 3);
  const colBuf = new Float32Array(points.length * 3);

  points.forEach((p, i) => {
    posBuf[i * 3] = normVal(p.x, xr.min, xr.max);
    posBuf[i * 3 + 1] = normVal(p.y, yr.min, yr.max);
    posBuf[i * 3 + 2] = normVal(p.z, zr.min, zr.max);
    const c = hexToRgb(p.color);
    colBuf[i * 3] = c.r;
    colBuf[i * 3 + 1] = c.g;
    colBuf[i * 3 + 2] = c.b;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posBuf, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colBuf, 3));

  const mat = new THREE.PointsMaterial({ vertexColors: true, sizeAttenuation: true });
  const pointsMesh = new THREE.Points(geo, mat);
  scene.add(pointsMesh);

  // Orbit state in spherical coordinates
  let camR = 3.5;
  let theta = Math.PI / 5;
  let phi = Math.PI / 3;
  let dragging = false;
  let prevX = 0;
  let prevY = 0;

  const raycaster = new THREE.Raycaster();

  const placeCamera = () => {
    camera.position.set(
      camR * Math.sin(phi) * Math.sin(theta),
      camR * Math.cos(phi),
      camR * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(0, 0, 0);
  };
  placeCamera();

  // Sync point world-size and raycast threshold to current zoom + canvas height
  const syncPointSize = (canvasH) => {
    const worldH = 2 * camR * Math.tan((FOV_DEG / 2) * (Math.PI / 180));
    mat.size = (pointSize / canvasH) * worldH;
    raycaster.params.Points.threshold = mat.size * 1.5;
  };

  const resize = () => {
    const rect = block.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    syncPointSize(h);
  };
  new ResizeObserver(resize).observe(block);
  resize();

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('mousemove', (e) => {
    if (dragging) {
      theta -= (e.clientX - prevX) * 0.008;
      phi = Math.max(0.08, Math.min(Math.PI - 0.08, phi + (e.clientY - prevY) * 0.008));
      prevX = e.clientX;
      prevY = e.clientY;
      placeCamera();
      syncPointSize(block.getBoundingClientRect().height || DEFAULT_HEIGHT);
    }

    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(pointsMesh);
    if (hits.length) {
      const pt = points[hits[0].index];
      tooltip.innerHTML = `<strong>${pt.label}</strong><br>${pt.x}, ${pt.y}, ${pt.z}`;
      tooltip.classList.add('visible');
      tooltip.style.left = `${e.clientX - rect.left + 14}px`;
      tooltip.style.top = `${e.clientY - rect.top - 10}px`;
    } else {
      tooltip.classList.remove('visible');
    }
  });

  canvas.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camR = Math.max(1, Math.min(10, camR + e.deltaY * 0.01));
    placeCamera();
    syncPointSize(block.getBoundingClientRect().height || DEFAULT_HEIGHT);
  }, { passive: false });

  canvas.style.cursor = 'grab';

  // Render loop — only runs when visible in viewport
  let running = false;
  let frame = 0;
  const renderLoop = () => {
    if (!running) return;
    frame = requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  };

  new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (visible && !running) {
      running = true;
      renderLoop();
    } else if (!visible && running) {
      running = false;
      cancelAnimationFrame(frame);
    }
  }, { threshold: 0.1 }).observe(block);
}
