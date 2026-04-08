import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';

const NODE_COLORS = {
  supplier: 0x06b6d4, // cyan
  manufacturer: 0x3b82f6, // blue
  distribution: 0xf59e0b, // amber
  customer: 0x22c55e, // green
  transit: 0x6b7280, // grey
};

const STATUS_COLORS = {
  ok: 0x22c55e,
  warn: 0xf59e0b,
  error: 0xef4444,
};

// ── Perlin noise utilities (reuse from m3d-globe pattern) ────────────────

function hash2(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function smooth(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return (
    hash2(ix, iy) * (1 - u) * (1 - v)
    + hash2(ix + 1, iy) * u * (1 - v)
    + hash2(ix, iy + 1) * (1 - u) * v
    + hash2(ix + 1, iy + 1) * u * v
  );
}

function fbm(x, y) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 5; i += 1) {
    val += smooth(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / 0.96875;
}

// ── Procedural Mercator texture (equirectangular canvas) ──────────────────

function createMercatorTexture(THREE) {
  const W = 1024;
  const H = 512;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let py = 0; py < H; py += 1) {
    const lat = 90 - (py / H) * 180;
    const absLat = Math.abs(lat);

    for (let px = 0; px < W; px += 1) {
      const lon = (px / W) * 360 - 180;
      const nx = lon / 60 + 3.7;
      const ny = lat / 40 + 1.2;
      const n = fbm(nx, ny);

      let r; let g; let b;

      if (absLat > 75) {
        // Polar ice
        const t = Math.min(1, (absLat - 75) / 12);
        r = Math.round(195 + t * 50);
        g = Math.round(210 + t * 40);
        b = Math.round(230 + t * 25);
      } else if (absLat > 62 && n > 0.46) {
        // Tundra
        r = 140 + Math.round(n * 30);
        g = 145 + Math.round(n * 25);
        b = 130;
      } else {
        const isLand = n > 0.52;
        if (isLand) {
          if (absLat > 50) {
            r = 85 + Math.round(n * 25);
            g = 115 + Math.round(n * 30);
            b = 75;
          } else if (absLat > 30) {
            if (n > 0.70) {
              r = 125; g = 128; b = 118;
            } else {
              r = 55 + Math.round(n * 35);
              g = 145 + Math.round(n * 25);
              b = 55;
            }
          } else if (absLat > 10) {
            r = 40 + Math.round(n * 30);
            g = 155 + Math.round(n * 25);
            b = 50;
          } else {
            r = 30 + Math.round(n * 30);
            g = 148 + Math.round(n * 20);
            b = 42;
          }
        } else {
          // Ocean
          const latN = absLat / 90;
          const depth = 0.55 + n * 0.45;
          r = Math.round((8 + (1 - latN) * 18) * depth);
          g = Math.round((25 + (1 - latN) * 65) * depth);
          b = Math.round((95 + (1 - latN) * 85) * depth);
        }
      }

      const idx = (py * W + px) * 4;
      d[idx] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cvs);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ── Lat/lon to UV conversion (equirectangular) ────────────────────────────

function latLonToUV(lat, lon) {
  const u = (lon + 180) / 360;
  const v = 1 - ((lat + 90) / 180);
  return { u, v };
}

// ── Lat/lon to 3D position on flat plane ──────────────────────────────────

function latLonToPos(lat, lon, mapW = 4, mapH = 2) {
  const { u, v } = latLonToUV(lat, lon);
  const x = (u - 0.5) * mapW;
  const z = (v - 0.5) * mapH;
  return { x, y: 0, z };
}

// ── Billboard label class ─────────────────────────────────────────────────

// Node types that always show labels (major hubs only — reduces overlap)
const ALWAYS_LABEL = new Set(['cdn', 'manufacturer', 'distribution', 'customer']);

class Billboard {
  constructor(text, THREE) {
    this.text = text;
    const cvs = document.createElement('canvas');
    cvs.width = 192;
    cvs.height = 48;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = 'rgba(11,17,32,0.72)';
    ctx.roundRect(0, 0, 192, 48, 6);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 96, 24);
    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const geo = new THREE.PlaneGeometry(0.55, 0.14);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
  }

  update(pos, camera) {
    this.mesh.position.copy(pos);
    this.mesh.position.y = 0.16;
    this.mesh.quaternion.copy(camera.quaternion);
  }
}

// ── Create node square mesh ───────────────────────────────────────────────

function createNodeMesh(nodeType, THREE) {
  const geo = new THREE.PlaneGeometry(0.12, 0.12);
  const color = NODE_COLORS[nodeType] || 0xffffff;
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 0.01;
  return mesh;
}

// ── Create status ring (wireframe circle) ─────────────────────────────────

function createStatusRing(status, THREE) {
  const geo = new THREE.BufferGeometry();
  const radius = 0.08;
  const segments = 32;
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      Math.cos(angle) * radius,
      0.001,
      Math.sin(angle) * radius,
    );
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
  const color = STATUS_COLORS[status] || 0xffffff;
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const line = new THREE.Line(geo, mat);
  return line;
}

// ── Animated route curve with dots ───────────────────────────────────────

function createRouteMesh(from, to, THREE) {
  const points = [
    new THREE.Vector3(from.x, from.y + 0.15, from.z),
    new THREE.Vector3((from.x + to.x) / 2 - 0.2, 0.35, (from.z + to.z) / 2),
    new THREE.Vector3((from.x + to.x) / 2 + 0.2, 0.35, (from.z + to.z) / 2),
    new THREE.Vector3(to.x, to.y + 0.15, to.z),
  ];

  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.BufferGeometry();
  const curvePoints = curve.getPoints(64);
  geo.setFromPoints(curvePoints);

  const mat = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1.5 });
  const line = new THREE.Line(geo, mat);
  return { line, curve };
}

// ── Animated dots along route ────────────────────────────────────────────

function createRouteDots(curve, unitsPerDay, THREE) {
  const dotGeo = new THREE.BufferGeometry();
  const dotMat = new THREE.PointsMaterial({ color: 0xfbbf24, size: 0.04 });
  const dots = new THREE.Points(dotGeo, dotMat);

  const positions = [];
  const numDots = Math.max(1, Math.min(5, Math.floor(unitsPerDay / 10000)));
  for (let i = 0; i < numDots; i += 1) {
    positions.push(0, 0.2, 0);
  }
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

  return { dots, numDots, curve };
}

// ── Parse block data ──────────────────────────────────────────────────────

function getBlockData(block) {
  const dataStr = block.querySelector('pre')?.textContent || '{}';
  try {
    return JSON.parse(dataStr);
  } catch {
    return { nodes: [], edges: [] };
  }
}

// ── Main decorate function ────────────────────────────────────────────────

export default async function decorate(block) {
  await loadScript(THREE_URL);
  const { THREE } = window;

  if (!THREE) {
    block.textContent = 'Three.js failed to load';
    return;
  }

  let data = getBlockData(block);
  if (!data.nodes?.length) {
    try {
      const res = await fetch(new URL('./viz-supply-chain-demo.json', import.meta.url).href);
      if (res.ok) data = await res.json();
    } catch { /* use empty */ }
  }
  const { nodes = [], edges = [] } = data;

  // ── Scene setup ────────────────────────────────────────────────────────

  const w = block.offsetWidth;
  const h = block.offsetHeight || 520;
  const container = document.createElement('div');
  container.id = 'viz-supply-container';
  container.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%;';
  block.appendChild(container);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1120);

  const camera = new THREE.PerspectiveCamera(75, w / h, 0.01, 100);
  camera.position.set(0, 2.5, 1.8);
  camera.lookAt(0, 0, 0);
  camera.rotateX((-15 * Math.PI) / 180);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // ── Mercator map plane ─────────────────────────────────────────────────

  const mapTex = createMercatorTexture(THREE);
  const mapGeo = new THREE.PlaneGeometry(4, 2, 1, 1);
  const mapMat = new THREE.MeshBasicMaterial({ map: mapTex });
  const mapMesh = new THREE.Mesh(mapGeo, mapMat);
  mapMesh.rotation.x = -Math.PI / 2;
  scene.add(mapMesh);

  // ── Create nodes ───────────────────────────────────────────────────────

  const nodeMap = new Map();
  const nodeMeshes = [];

  nodes.forEach((node) => {
    const pos = latLonToPos(node.lat, node.lon);
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);

    // Node square
    const square = createNodeMesh(node.type, THREE);
    group.add(square);

    // Status ring
    const ring = createStatusRing(node.status, THREE);
    group.add(ring);

    // Billboard label — only for major hub types to avoid overlap
    const billboard = new Billboard(node.label, THREE);
    if (ALWAYS_LABEL.has(node.type)) group.add(billboard.mesh);

    // Pulsing alert halo (for nodes with alert field)
    if (node.alert) {
      const haloGeo = new THREE.BufferGeometry();
      const r = 0.2;
      const pts = [];
      for (let i = 0; i <= 32; i += 1) {
        const angle = (i / 32) * Math.PI * 2;
        pts.push(Math.cos(angle) * r, 0.005, Math.sin(angle) * r);
      }
      haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      const haloMat = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
      const halo = new THREE.Line(haloGeo, haloMat);
      halo.userData.isPulsing = true;
      group.add(halo);
    }

    scene.add(group);
    nodeMap.set(node.id, { node, group, billboard });
    nodeMeshes.push(group);
  });

  // ── Create routes ──────────────────────────────────────────────────────

  const routeMeshes = [];

  edges.forEach((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) return;

    const from = latLonToPos(fromNode.node.lat, fromNode.node.lon);
    const to = latLonToPos(toNode.node.lat, toNode.node.lon);

    const { line, curve } = createRouteMesh(from, to, THREE);
    const { dots, numDots } = createRouteDots(curve, edge.unitsPerDay, THREE);

    // Color line by width
    const maxUnits = Math.max(...edges.map((e) => e.unitsPerDay));
    const lineWidth = 1 + (edge.unitsPerDay / maxUnits) * 2;
    line.material.linewidth = lineWidth;

    scene.add(line);
    scene.add(dots);
    routeMeshes.push({
      edge, curve, dots, numDots, line,
    });
  });

  // ── Orbit controls ─────────────────────────────────────────────────────

  let isDragging = false;
  let previousMousePosition = {
    x: 0, y: 0,
  };

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = {
      x: e.clientX, y: e.clientY,
    };
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    previousMousePosition = {
      x: e.clientX, y: e.clientY,
    };

    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.005);
    const qy = new THREE.Quaternion();
    qy.setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.005);
    camera.quaternion.multiplyQuaternions(qx, camera.quaternion);
    camera.quaternion.multiplyQuaternions(qy, camera.quaternion);
  });

  container.addEventListener('mouseup', () => {
    isDragging = false;
  });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = camera.position.clone().normalize();
    const dist = camera.position.length();
    const newDist = dist + e.deltaY * 0.005;
    const clamped = Math.max(1.5, Math.min(8, newDist));
    camera.position.copy(dir.multiplyScalar(clamped));
  });

  // ── Right panel (In Transit summary, on-time %, alerts) ────────────────

  const panel = document.createElement('div');
  panel.className = 'sc-side-panel';
  block.appendChild(panel);

  function updatePanel() {
    const inTransit = edges.length;
    const onTime = edges.filter((e) => !e.status || e.status === 'ok').length;
    const alerts = nodes.filter((n) => n.alert).length;
    const onTimePercent = inTransit > 0 ? Math.round((onTime / inTransit) * 100) : 0;

    panel.innerHTML = `
      <h3 class="sc-panel-title">In Transit</h3>
      <div class="sc-kpi">
        <span class="sc-kpi-label">Shipments</span>
        <span class="sc-kpi-value">${inTransit}</span>
      </div>
      <div class="sc-kpi">
        <span class="sc-kpi-label">On-Time %</span>
        <span class="sc-kpi-value on-time">${onTimePercent}%</span>
      </div>
      <div class="sc-kpi">
        <span class="sc-kpi-label">Alerts</span>
        <span class="sc-kpi-value alerts">${alerts}</span>
      </div>
    `;
  }
  updatePanel();

  // ── Legend ─────────────────────────────────────────────────────────────

  const legend = document.createElement('div');
  legend.className = 'sc-legend';
  legend.innerHTML = `
    <div class="sc-legend-item">
      <span class="sc-legend-dot on-time"></span> On Time
    </div>
    <div class="sc-legend-item">
      <span class="sc-legend-dot delayed"></span> Delayed
    </div>
    <div class="sc-legend-item">
      <span class="sc-legend-dot disrupted"></span> Disrupted
    </div>
  `;
  block.appendChild(legend);

  // ── Animation loop ─────────────────────────────────────────────────────

  const startTime = Date.now();

  function animate() {
    requestAnimationFrame(animate);

    const elapsed = (Date.now() - startTime) / 1000;

    // Update billboard labels (only for meshes that were added to a group)
    nodeMap.forEach(({ billboard, group }) => {
      if (billboard.mesh.parent) billboard.update(group.position, camera);
    });

    // Animate route dots
    routeMeshes.forEach(({ curve, dots, numDots }) => {
      const positions = [];
      for (let i = 0; i < numDots; i += 1) {
        const t = (elapsed * 0.3 + i / numDots) % 1;
        const pt = curve.getPoint(t);
        positions.push(pt.x, pt.y, pt.z);
      }
      dots.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      dots.geometry.attributes.position.needsUpdate = true;
    });

    // Pulse alert halos
    nodeMeshes.forEach((group) => {
      group.children.forEach((child) => {
        if (child.userData.isPulsing) {
          const pulse = Math.sin(elapsed * 3) * 0.5 + 0.5;
          child.material.opacity = 0.3 + pulse * 0.4;
        }
      });
    });

    renderer.render(scene, camera);
  }

  animate();

  // ── Cleanup on resize ──────────────────────────────────────────────────

  const resizeObserver = new ResizeObserver(() => {
    const newW = block.offsetWidth;
    const newH = block.offsetHeight || 520;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
  });
  resizeObserver.observe(block);
}
