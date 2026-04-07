import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';
const MAP_W = 4.0;
const MAP_H = 2.0;

const STATUS_COLORS = {
  'on-time': 0x00d4aa,
  delayed: 0xf59e0b,
  disrupted: 0xef4444,
};

const TYPE_EMOJI = { factory: '⚙', dc: '🏭', market: '🏪' };

const TYPE_RING = { factory: '#60a5fa', dc: '#a78bfa', market: '#34d399' };

const TYPE_BG = {
  factory: 'rgba(26, 58, 106, 0.92)',
  dc: 'rgba(42, 26, 90, 0.92)',
  market: 'rgba(10, 58, 42, 0.92)',
};

const DEFAULT_DATA = {
  nodes: [
    {
      id: 'sh', label: 'Shanghai', type: 'factory', lat: 31.2, lon: 121.5, output: 5000,
    },
    {
      id: 'gz', label: 'Guangzhou', type: 'factory', lat: 23.1, lon: 113.3, output: 4200,
    },
    {
      id: 'tp', label: 'Taipei', type: 'factory', lat: 25.0, lon: 120.2, output: 3100,
    },
    {
      id: 'la', label: 'Los Angeles DC', type: 'dc', lat: 34.0, lon: -118.2, output: 0,
    },
    {
      id: 'nj', label: 'Newark DC', type: 'dc', lat: 40.7, lon: -74.0, output: 0,
    },
    {
      id: 'ro', label: 'Rotterdam DC', type: 'dc', lat: 51.9, lon: 4.5, output: 0,
    },
    {
      id: 'sin', label: 'Singapore DC', type: 'dc', lat: 1.3, lon: 103.8, output: 0,
    },
    {
      id: 'nyc', label: 'New York', type: 'market', lat: 40.7, lon: -73.9, output: 0,
    },
    {
      id: 'chi', label: 'Chicago', type: 'market', lat: 41.9, lon: -87.6, output: 0,
    },
    {
      id: 'lon', label: 'London', type: 'market', lat: 51.5, lon: -0.1, output: 0,
    },
    {
      id: 'par', label: 'Paris', type: 'market', lat: 48.9, lon: 2.3, output: 0,
    },
    {
      id: 'syd', label: 'Sydney', type: 'market', lat: -33.9, lon: 151.2, output: 0,
    },
  ],
  routes: [
    {
      from: 'sh', to: 'la', volume: 800, eta: '2d', status: 'on-time',
    },
    {
      from: 'sh', to: 'nj', volume: 600, eta: '3d', status: 'delayed',
    },
    {
      from: 'gz', to: 'ro', volume: 500, eta: '5d', status: 'on-time',
    },
    {
      from: 'gz', to: 'sin', volume: 300, eta: '1d', status: 'on-time',
    },
    {
      from: 'tp', to: 'la', volume: 400, eta: '2d', status: 'disrupted',
    },
    {
      from: 'tp', to: 'ro', volume: 350, eta: '6d', status: 'on-time',
    },
    {
      from: 'la', to: 'nyc', volume: 700, eta: '2d', status: 'on-time',
    },
    {
      from: 'la', to: 'chi', volume: 500, eta: '1d', status: 'delayed',
    },
    {
      from: 'nj', to: 'nyc', volume: 600, eta: '1d', status: 'on-time',
    },
    {
      from: 'ro', to: 'lon', volume: 450, eta: '1d', status: 'on-time',
    },
    {
      from: 'ro', to: 'par', volume: 400, eta: '1d', status: 'on-time',
    },
    {
      from: 'sin', to: 'syd', volume: 280, eta: '2d', status: 'disrupted',
    },
  ],
};

// ─── Procedural world map texture ─────────────────────────────────────────────

// Approximate continent blobs: [centerLon, centerLat, lonRadius, latRadius, noiseWeight]
const CONTINENTS = [
  [-98, 53, 42, 22, 0.38], // North America
  [-58, -14, 20, 30, 0.32], // South America
  [17, 50, 26, 16, 0.28], // Europe
  [22, 3, 30, 40, 0.35], // Africa
  [95, 42, 68, 34, 0.30], // Asia
  [134, -26, 20, 16, 0.30], // Australia
  [0, -84, 180, 8, 0.15], // Antarctica
];

function hash2(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function smooth2(x, y) {
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

function fbm2(x, y) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    val += smooth2(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val;
}

function checkIsLand(lon, lat) {
  const n = (fbm2(lon * 0.06 + 1.2, lat * 0.07 + 0.8) - 0.5) * 2;
  for (let i = 0; i < CONTINENTS.length; i += 1) {
    const [cx, cy, rx, ry, irr] = CONTINENTS[i];
    const dx = (lon - cx) / rx;
    const dy = (lat - cy) / ry;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.82 + n * irr) return true;
  }
  return false;
}

function createMapTexture(THREE) {
  const W = 2048;
  const H = 1024;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let py = 0; py < H; py += 1) {
    const lat = 90 - (py / H) * 180;
    for (let px = 0; px < W; px += 1) {
      const lon = (px / W) * 360 - 180;
      const land = checkIsLand(lon, lat);
      const idx = (py * W + px) * 4;
      const noise = fbm2(lon * 0.1, lat * 0.12);
      const absLat = Math.abs(lat);

      if (land) {
        if (absLat > 75) {
          const t = Math.min(1, (absLat - 75) / 15);
          d[idx] = Math.round(55 + t * 95);
          d[idx + 1] = Math.round(70 + t * 90);
          d[idx + 2] = Math.round(68 + t * 88);
        } else if (absLat > 55) {
          d[idx] = Math.round(22 + noise * 16);
          d[idx + 1] = Math.round(40 + noise * 18);
          d[idx + 2] = Math.round(26 + noise * 10);
        } else if (absLat < 20) {
          d[idx] = Math.round(15 + noise * 14);
          d[idx + 1] = Math.round(48 + noise * 20);
          d[idx + 2] = Math.round(20 + noise * 10);
        } else {
          d[idx] = Math.round(20 + noise * 15);
          d[idx + 1] = Math.round(46 + noise * 19);
          d[idx + 2] = Math.round(24 + noise * 11);
        }
      } else {
        const latN = absLat / 90;
        const depthN = 0.4 + noise * 0.6;
        d[idx] = Math.round((4 + (1 - latN) * 8) * depthN);
        d[idx + 1] = Math.round((10 + (1 - latN) * 26) * depthN);
        d[idx + 2] = Math.round((32 + (1 - latN) * 52) * depthN);
      }
      d[idx + 3] = 255;
    }
  }

  // Grid lines every 30°
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const lat = 90 - (py / H) * 180;
      const lon = (px / W) * 360 - 180;
      const latRem = Math.abs(lat % 30);
      const lonRem = Math.abs(lon % 30);
      if (latRem < 0.45 || lonRem < 0.45) {
        const idx = (py * W + px) * 4;
        d[idx] = Math.min(255, d[idx] + 10);
        d[idx + 1] = Math.min(255, d[idx + 1] + 18);
        d[idx + 2] = Math.min(255, d[idx + 2] + 22);
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cvs);
  tex.needsUpdate = true;
  return tex;
}

// ─── Node sprites ──────────────────────────────────────────────────────────────

function createNodeSprite(THREE, type) {
  const size = 128;
  const cvs = document.createElement('canvas');
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const r = 40;
  const ringColor = TYPE_RING[type] || '#60a5fa';
  const bgColor = TYPE_BG[type] || 'rgba(10, 20, 40, 0.92)';

  // Outer glow
  const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.6);
  grad.addColorStop(0, `${ringColor}50`);
  grad.addColorStop(1, `${ringColor}00`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Background disc
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Glowing ring
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Icon
  const emoji = TYPE_EMOJI[type] || '●';
  ctx.font = '34px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(emoji, cx, cy);

  const tex = new THREE.CanvasTexture(cvs);
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.19, 0.19, 1);
  return sprite;
}

// ─── Label sprites ─────────────────────────────────────────────────────────────

function createLabelSprite(THREE, text, type) {
  const ringColor = TYPE_RING[type] || '#60a5fa';
  const fontSize = 24;
  const pad = 14;

  // Measure text first on a temp canvas
  const tmp = document.createElement('canvas');
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.font = `${fontSize}px 'Courier New', monospace`;
  const textW = Math.ceil(tmpCtx.measureText(text).width);

  const w = textW + pad * 2;
  const h = fontSize + pad;
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d');
  ctx.font = `${fontSize}px 'Courier New', monospace`;

  // Background
  ctx.fillStyle = 'rgba(4, 12, 28, 0.90)';
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  // Text
  ctx.fillStyle = ringColor;
  ctx.fillText(text, pad, fontSize);

  const tex = new THREE.CanvasTexture(cvs);
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  // Scale so label is readable
  sprite.scale.set((w / 512) * 2.0, (h / 512) * 2.0, 1);
  return sprite;
}

// ─── Animated dash shader ──────────────────────────────────────────────────────

// Dashes travel from source → destination over time
const DASH_VERT = `
  attribute float lineDistance;
  varying float vLineDist;
  void main() {
    vLineDist = lineDistance;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DASH_FRAG = `
  uniform float time;
  uniform float dashSize;
  uniform float gapSize;
  uniform vec3 color;
  varying float vLineDist;
  void main() {
    float total = dashSize + gapSize;
    float d = mod(vLineDist - time * 0.38, total);
    if (d > dashSize) discard;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function buildArcGeometry(THREE, curve) {
  const pts = curve.getPoints(90);
  const positions = new Float32Array(pts.length * 3);
  const lineDists = new Float32Array(pts.length);
  let cumDist = 0;
  for (let i = 0; i < pts.length; i += 1) {
    positions[i * 3] = pts[i].x;
    positions[i * 3 + 1] = pts[i].y;
    positions[i * 3 + 2] = pts[i].z;
    if (i > 0) cumDist += pts[i].distanceTo(pts[i - 1]);
    lineDists[i] = cumDist;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('lineDistance', new THREE.BufferAttribute(lineDists, 1));
  return geo;
}

function makeRouteArc(THREE, fromNode, toNode) {
  const p1 = new THREE.Vector3(
    (fromNode.lon / 180) * (MAP_W / 2),
    (fromNode.lat / 90) * (MAP_H / 2),
    0.03,
  );
  const p2 = new THREE.Vector3(
    (toNode.lon / 180) * (MAP_W / 2),
    (toNode.lat / 90) * (MAP_H / 2),
    0.03,
  );
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const dist = p1.distanceTo(p2);
  const arcH = Math.max(0.12, dist * 0.30);
  const ctrl = new THREE.Vector3(midX, midY, arcH + 0.03);
  return new THREE.CatmullRomCurve3([p1, ctrl, p2]);
}

function createRouteLine(THREE, curve, statusColor, timeUniforms) {
  const geo = buildArcGeometry(THREE, curve);
  const c = new THREE.Color(statusColor);
  const mat = new THREE.ShaderMaterial({
    vertexShader: DASH_VERT,
    fragmentShader: DASH_FRAG,
    uniforms: {
      time: { value: 0 },
      dashSize: { value: 0.10 },
      gapSize: { value: 0.07 },
      color: { value: new THREE.Vector3(c.r, c.g, c.b) },
    },
    transparent: true,
    depthWrite: false,
    blending: 2, // THREE.AdditiveBlending
  });
  timeUniforms.push(mat.uniforms.time);
  return new THREE.Line(geo, mat);
}

// ─── Shipment dots ─────────────────────────────────────────────────────────────

function createShipmentDots(THREE, curve, route, maxVolume) {
  const statusColor = STATUS_COLORS[route.status] || STATUS_COLORS['on-time'];
  const dotCount = Math.max(1, Math.min(4, Math.floor(route.volume / 240)));
  const speed = 0.10 + (route.volume / maxVolume) * 0.22;
  const dots = [];

  for (let i = 0; i < dotCount; i += 1) {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 6, 4),
      new THREE.MeshBasicMaterial({ color: statusColor }),
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.030, 6, 4),
      new THREE.MeshBasicMaterial({
        color: statusColor,
        transparent: true,
        opacity: 0.28,
        blending: 2, // AdditiveBlending
        depthWrite: false,
      }),
    );
    core.add(glow);
    dots.push({
      mesh: core,
      offset: i / dotCount,
      speed,
      curve,
    });
  }
  return dots;
}

// ─── Side panel ────────────────────────────────────────────────────────────────

function buildPanelHTML(data) {
  const totalVolume = data.routes.reduce((s, r) => s + r.volume, 0);
  const onTimeCount = data.routes.filter((r) => r.status === 'on-time').length;
  const onTimePct = Math.round((onTimeCount / data.routes.length) * 100);
  const disruptions = data.routes.filter((r) => r.status === 'disrupted');
  const nodeMap = Object.fromEntries(data.nodes.map((n) => [n.id, n]));

  const alertsHtml = disruptions.length
    ? disruptions.map((r) => {
      const fn = nodeMap[r.from];
      const tn = nodeMap[r.to];
      return `<div class="scv-alert-item">
        <span class="scv-alert-dot"></span>
        <span class="scv-alert-text">${fn ? fn.label : r.from} → ${tn ? tn.label : r.to}</span>
      </div>`;
    }).join('')
    : '<div class="scv-no-alerts">ALL SYSTEMS NOMINAL</div>';

  return `
    <div class="scv-panel-header">
      <span class="scv-panel-title">SUPPLY CHAIN STATUS</span>
      <span class="scv-live-dot"></span>
    </div>
    <div class="scv-stats">
      <div class="scv-stat">
        <div class="scv-stat-value">${totalVolume.toLocaleString()}</div>
        <div class="scv-stat-label">UNITS IN TRANSIT</div>
      </div>
      <div class="scv-stat">
        <div class="scv-stat-value scv-v-teal">${onTimePct}%</div>
        <div class="scv-stat-label">ON-TIME DELIVERY</div>
      </div>
      <div class="scv-stat">
        <div class="scv-stat-value ${disruptions.length ? 'scv-v-red' : 'scv-v-teal'}">${disruptions.length}</div>
        <div class="scv-stat-label">ACTIVE DISRUPTIONS</div>
      </div>
    </div>
    <div class="scv-rule"></div>
    <div class="scv-section-lbl">DISRUPTION ALERTS</div>
    <div class="scv-alerts">${alertsHtml}</div>
    <div class="scv-rule"></div>
    <div class="scv-section-lbl">ROUTE STATUS KEY</div>
    <div class="scv-legend">
      <div class="scv-legend-row">
        <span class="scv-legend-pip" style="background:#00d4aa;box-shadow:0 0 6px #00d4aa80"></span>On Time
      </div>
      <div class="scv-legend-row">
        <span class="scv-legend-pip" style="background:#f59e0b;box-shadow:0 0 6px #f59e0b80"></span>Delayed
      </div>
      <div class="scv-legend-row">
        <span class="scv-legend-pip" style="background:#ef4444;box-shadow:0 0 6px #ef444480"></span>Disrupted
      </div>
    </div>
  `;
}

// ─── Config parsing ────────────────────────────────────────────────────────────

function parseConfig(block) {
  const rows = [...block.children];
  const cell = (row) => {
    if (!row) return '';
    const cells = [...row.children];
    return (cells.length > 1 ? cells[1] : cells[0])?.textContent.trim() || '';
  };
  return {
    dataUrl: cell(rows[0]),
    inlineData: cell(rows[1]),
    height: cell(rows[2]) || '520',
    showLabels: cell(rows[3]) || 'hover',
  };
}

async function resolveData(config) {
  if (config.dataUrl) {
    try {
      const res = await fetch(config.dataUrl);
      if (res.ok) return res.json();
    } catch (_) { /* fall through */ }
  }
  if (config.inlineData) {
    try { return JSON.parse(config.inlineData); } catch (_) { /* fall through */ }
  }
  return DEFAULT_DATA;
}

let threeReady = null;
function ensureThree() {
  if (!threeReady) threeReady = loadScript(THREE_URL);
  return threeReady;
}

// ─── Main decorate ─────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const config = parseConfig(block);
  const [data] = await Promise.all([resolveData(config), ensureThree()]);
  const { THREE } = window;
  if (!THREE) return;

  const canvasH = Math.max(200, parseInt(config.height, 10) || 520);
  const showLabels = (config.showLabels || 'hover').toLowerCase().trim();

  // Clear authoring HTML
  while (block.firstChild) block.removeChild(block.firstChild);

  // DOM structure
  const wrapper = document.createElement('div');
  wrapper.className = 'scv-wrapper';
  wrapper.style.height = `${canvasH}px`;

  const canvas = document.createElement('canvas');
  canvas.className = 'scv-canvas';

  const panel = document.createElement('div');
  panel.className = 'scv-panel';
  panel.innerHTML = buildPanelHTML(data);

  wrapper.append(canvas, panel);
  block.append(wrapper);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030a15);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, -0.35, 4.2);
  const camTarget = new THREE.Vector3(0, 0.15, 0);
  camera.lookAt(camTarget);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dl = new THREE.DirectionalLight(0x88ccff, 0.4);
  dl.position.set(0, 5, 5);
  scene.add(dl);

  // Map plane
  const mapTex = createMapTexture(THREE);
  const mapGeo = new THREE.PlaneGeometry(MAP_W, MAP_H);
  scene.add(new THREE.Mesh(mapGeo, new THREE.MeshBasicMaterial({ map: mapTex })));

  // Node index
  const nodeMap = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  const maxVolume = Math.max(...data.routes.map((r) => r.volume));

  // Nodes
  const nodeSprites = [];
  const labelEntries = []; // { labelSprite, visible }

  data.nodes.forEach((node) => {
    const sprite = createNodeSprite(THREE, node.type);
    sprite.position.set(
      (node.lon / 180) * (MAP_W / 2),
      (node.lat / 90) * (MAP_H / 2),
      0.05,
    );
    sprite.userData.node = node;
    scene.add(sprite);
    nodeSprites.push(sprite);

    if (showLabels !== 'never') {
      const lbl = createLabelSprite(THREE, node.label, node.type);
      lbl.position.set(
        sprite.position.x,
        sprite.position.y + 0.15,
        0.06,
      );
      lbl.visible = showLabels === 'always';
      scene.add(lbl);
      labelEntries.push(lbl);
    } else {
      labelEntries.push(null);
    }
  });

  // Routes
  const timeUniforms = [];
  const shipmentDots = [];

  data.routes.forEach((route) => {
    const fromNode = nodeMap[route.from];
    const toNode = nodeMap[route.to];
    if (!fromNode || !toNode) return;

    const statusColor = STATUS_COLORS[route.status] || STATUS_COLORS['on-time'];
    const curve = makeRouteArc(THREE, fromNode, toNode);
    scene.add(createRouteLine(THREE, curve, statusColor, timeUniforms));

    const dots = createShipmentDots(THREE, curve, route, maxVolume);
    dots.forEach((dot) => {
      scene.add(dot.mesh);
      shipmentDots.push(dot);
    });
  });

  // Resize
  const resize = () => {
    const w = Math.max(1, canvas.clientWidth || (wrapper.clientWidth - 260));
    const h = Math.max(1, canvasH);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(wrapper);
  resize();

  // Pan + zoom
  let isDragging = false;
  let prevMouse = { x: 0, y: 0 };

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
    const factor = camera.position.z * 0.004;
    camera.position.x -= dx * factor;
    camera.position.y += dy * factor;
    camTarget.x -= dx * factor;
    camTarget.y += dy * factor;
    camera.lookAt(camTarget);
  });

  canvas.addEventListener('pointerup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });

  canvas.style.cursor = 'grab';

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.005;
    camera.position.z = Math.max(1.5, Math.min(8, camera.position.z));
  }, { passive: false });

  // Hover labels
  if (showLabels === 'hover') {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredIdx = -1;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (hoveredIdx >= 0 && labelEntries[hoveredIdx]) {
        labelEntries[hoveredIdx].visible = false;
        hoveredIdx = -1;
      }
      const hits = raycaster.intersectObjects(nodeSprites);
      if (hits.length) {
        const idx = nodeSprites.indexOf(hits[0].object);
        if (idx >= 0 && labelEntries[idx]) {
          labelEntries[idx].visible = true;
          hoveredIdx = idx;
        }
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (hoveredIdx >= 0 && labelEntries[hoveredIdx]) {
        labelEntries[hoveredIdx].visible = false;
        hoveredIdx = -1;
      }
    });
  }

  // Animation loop
  let running = false;
  let frameId = 0;
  let elapsed = 0;

  const animate = () => {
    if (!running) return;
    frameId = requestAnimationFrame(animate);
    elapsed += 0.016;

    // Advance animated dash uniforms
    timeUniforms.forEach((u) => { u.value = elapsed; });

    // Move shipment dots along arcs
    shipmentDots.forEach((dot) => {
      const t = (elapsed * dot.speed + dot.offset) % 1;
      const pos = dot.curve.getPoint(t);
      dot.mesh.position.copy(pos);
    });

    // Subtle pulse on node icons
    const pulse = 1 + Math.sin(elapsed * 2.8) * 0.045;
    nodeSprites.forEach((s) => { s.scale.set(0.19 * pulse, 0.19 * pulse, 1); });

    renderer.render(scene, camera);
  };

  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((en) => en.isIntersecting);
    if (visible && !running) {
      running = true;
      animate();
    } else if (!visible && running) {
      running = false;
      cancelAnimationFrame(frameId);
    }
  }, { threshold: 0.1 });
  io.observe(block);

  block.dispatchEvent(new CustomEvent('diagram:render', { bubbles: true }));
}
