/**
 * viz-quake-feed — Live USGS earthquake globe
 *
 * Fetches real USGS GeoJSON every 60s. Add ?demo or ?demo=usgs to the page URL
 * to use the fallback dataset with a cinematic "surprise quake" intro.
 *
 * Features:
 *  - Drag to rotate globe
 *  - Click/hover panel entry → spin globe to that quake + highlight node
 *  - Hover globe node → highlight panel entry
 *  - Demo mode: 5s after load a surprise M8.2 quake appears, globe spins to it
 *  - Live mode: auto-cycles top→bottom of list, loops, picks up new quakes
 *  - Ripples loop continuously
 *  - Shows "● Live USGS" or "◈ Demo" in panel header
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';
const USGS_API = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const GLOBE_RADIUS = 1;
const POLL_INTERVAL = 60000;
const RIPPLE_DURATION = 3000;
const RIPPLE_COUNT = 3;
const CYCLE_DELAY_MS = 5000; // pause before first auto-cycle step
const CYCLE_PAUSE_MS = 4000; // pause on each quake during cycle

// ─── Magnitude helpers ───────────────────────────────────────────────────
function getMagnitudeColor(mag) {
  if (mag < 2) return 0x808080;
  if (mag < 4) return 0x22c55e;
  if (mag < 6) return 0xf59e0b;
  return 0xef4444;
}
function getMagnitudeScale(mag) {
  return Math.max(0.025, Math.min(0.18, (mag - 1) * 0.025));
}

// ─── Three.js loader (deduped) ───────────────────────────────────────────
let threeReady = null;
function loadThreeJS() {
  if (!threeReady) {
    threeReady = new Promise((resolve, reject) => {
      if (window.THREE) { resolve(window.THREE); return; }
      const script = document.createElement('script');
      script.src = THREE_URL;
      script.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('THREE not found')));
      script.onerror = reject;
      document.head.append(script);
    });
  }
  return threeReady;
}

// ─── Terrain texture (procedural) ───────────────────────────────────────
function hash2(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function smooth(x, y) {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return hash2(ix, iy) * (1 - u) * (1 - v)
    + hash2(ix + 1, iy) * u * (1 - v)
    + hash2(ix, iy + 1) * (1 - u) * v
    + hash2(ix + 1, iy + 1) * u * v;
}
function fbm(x, y) {
  let val = 0; let amp = 0.5; let freq = 1;
  for (let i = 0; i < 5; i += 1) {
    val += smooth(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / 0.96875;
}
function createTerrainTexture(THREE) {
  const W = 1024; const H = 512;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let py = 0; py < H; py += 1) {
    const lat = 90 - (py / H) * 180;
    const absLat = Math.abs(lat);
    for (let px = 0; px < W; px += 1) {
      const lon = (px / W) * 360 - 180;
      const n = fbm(lon / 60 + 3.7, lat / 40 + 1.2);
      let r; let g; let b;
      if (absLat > 75) {
        const t = Math.min(1, (absLat - 75) / 12);
        r = Math.round(195 + t * 50);
        g = Math.round(210 + t * 40);
        b = Math.round(230 + t * 25);
      } else if (n > 0.52) {
        if (absLat > 50) {
          r = 85 + Math.round(n * 25); g = 115 + Math.round(n * 30); b = 75;
        } else if (absLat > 30) {
          r = 55 + Math.round(n * 35); g = 145 + Math.round(n * 25); b = 55;
        } else {
          r = 35 + Math.round(n * 30); g = 150 + Math.round(n * 22); b = 45;
        }
      } else {
        const depth = 0.55 + n * 0.45;
        const latN = absLat / 90;
        r = Math.round((8 + (1 - latN) * 18) * depth);
        g = Math.round((25 + (1 - latN) * 65) * depth);
        b = Math.round((95 + (1 - latN) * 85) * depth);
      }
      const idx = (py * W + px) * 4;
      d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cvs);
  tex.needsUpdate = true;
  return tex;
}

// ─── Parse block config ──────────────────────────────────────────────────
function parseBlock(block) {
  let cfg = {};
  block.querySelectorAll('div').forEach((row) => {
    const t = row.textContent.trim();
    if (t.startsWith('{')) {
      try { cfg = { ...cfg, ...JSON.parse(t) }; } catch { /* skip */ }
    } else if (!Number.isNaN(parseFloat(t))) {
      cfg.minMag = parseFloat(t);
    }
  });
  return cfg;
}

// ─── Demo mode check ─────────────────────────────────────────────────────
function isDemoMode() {
  const p = new URLSearchParams(window.location.search);
  return p.has('demo') || p.get('demo') === 'usgs';
}

// ─── Fetch USGS data ─────────────────────────────────────────────────────
async function fetchEarthquakes(signal, minMag = 1.0) {
  const res = await fetch(USGS_API, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.features || [])
    .map((f) => {
      const [lon, lat, depth] = f.geometry.coordinates;
      return {
        id: f.id,
        lon,
        lat,
        depth,
        mag: f.properties.mag ?? 1,
        place: f.properties.place ?? 'Unknown',
        time: f.properties.time,
        timestamp: new Date(f.properties.time),
      };
    })
    .filter((q) => q.mag >= minMag);
}

// ─── Demo fallback quakes ────────────────────────────────────────────────
function getDemoQuakes() {
  const raw = [
    {
      id: 'd1', lon: 139.8, lat: 35.7, depth: 40, mag: 4.2, place: '8km NE of Tokyo, Japan',
    },
    {
      id: 'd2', lon: -118.2, lat: 34.1, depth: 10, mag: 3.1, place: '12km SE of Los Angeles, CA',
    },
    {
      id: 'd3', lon: -122.4, lat: 37.8, depth: 15, mag: 2.8, place: '5km NW of San Francisco, CA',
    },
    {
      id: 'd4', lon: -77.0, lat: -12.1, depth: 60, mag: 5.3, place: '18km S of Lima, Peru',
    },
    {
      id: 'd5', lon: 28.9, lat: 41.0, depth: 8, mag: 3.6, place: '6km E of Istanbul, Turkey',
    },
    {
      id: 'd6', lon: 145.8, lat: -8.5, depth: 90, mag: 6.1, place: '45km NW of Lae, Papua New Guinea',
    },
    {
      id: 'd7', lon: -64.6, lat: 17.7, depth: 20, mag: 2.4, place: '3km NE of Charlotte Amalie, USVI',
    },
    {
      id: 'd8', lon: 14.5, lat: 40.8, depth: 5, mag: 3.8, place: '10km W of Naples, Italy',
    },
    {
      id: 'd9', lon: -150.5, lat: 61.2, depth: 35, mag: 2.9, place: '22km SW of Anchorage, Alaska',
    },
    {
      id: 'd10', lon: 103.8, lat: 1.4, depth: 12, mag: 3.4, place: '8km N of Singapore',
    },
  ];
  return raw.map((q) => ({
    ...q,
    time: Date.now() - (parseInt(q.id.slice(1), 10) * 300000),
    timestamp: new Date(),
  }));
}

// ─── Surprise quake for demo intro ───────────────────────────────────────
function makeSurpriseQuake() {
  return {
    id: 'surprise-8.2',
    lon: -121.5,
    lat: 36.6,
    depth: 18,
    mag: 8.2,
    place: '42km SW of Monterey, CA — MAJOR EVENT',
    time: Date.now(),
    timestamp: new Date(),
  };
}

// ─── Time ago ────────────────────────────────────────────────────────────
function timeAgo(time) {
  const diff = Date.now() - time;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ─── Render states ───────────────────────────────────────────────────────
function renderEmpty(block, message) {
  block.replaceChildren();
  const el = document.createElement('div');
  el.className = 'quake-empty-state';
  el.innerHTML = `
    <div class="quake-empty-icon">🌍</div>
    <div class="quake-empty-title">Data Unavailable</div>
    <div class="quake-empty-hint">${message}</div>
  `;
  block.append(el);
}
function renderLoadingSpinner() {
  const el = document.createElement('div');
  el.className = 'quake-spinner';
  el.innerHTML = '<div class="spinner-ring"></div><div class="spinner-text">Fetching earthquakes…</div>';
  return el;
}

// ─── Side panel ──────────────────────────────────────────────────────────
// newQuakeId: if set, that item gets 'quake-item-new' flash class
function buildPanel(quakes, demo, newQuakeId = null) {
  const panel = document.createElement('div');
  panel.className = 'quake-panel';
  panel.innerHTML = `
    <div class="quake-panel-header">
      <div class="quake-panel-title">Recent Earthquakes</div>
      <div class="quake-status ${demo ? 'demo' : 'live'}">${demo ? '◈ Demo' : '● Live USGS'}</div>
    </div>
    <div class="quake-list"></div>
  `;
  const list = panel.querySelector('.quake-list');
  const sorted = quakes.slice(0, 10).sort((a, b) => b.mag - a.mag);
  sorted.forEach((q) => {
    const item = document.createElement('div');
    item.className = 'quake-item';
    if (q.id === newQuakeId) item.classList.add('quake-item-new');
    item.dataset.quakeId = q.id;
    let cls = 'badge-grey';
    if (q.mag >= 6) cls = 'badge-red';
    else if (q.mag >= 4) cls = 'badge-amber';
    else if (q.mag >= 2) cls = 'badge-green';
    item.innerHTML = `
      <div class="quake-badge ${cls}">${q.mag.toFixed(1)}</div>
      <div class="quake-info">
        <div class="quake-place">${q.place}</div>
        <div class="quake-time">${timeAgo(q.time)}</div>
      </div>
    `;
    list.append(item);
  });
  return panel;
}

// ─── Main scene ──────────────────────────────────────────────────────────
async function initScene(wrapper, quakes, config) {
  const THREE = await loadThreeJS();

  const canvas = document.createElement('canvas');
  canvas.className = 'quake-canvas';
  wrapper.append(canvas);

  const w = wrapper.clientWidth || 700;
  const h = config.height ? parseInt(config.height, 10) : 600;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
  camera.position.set(0, 0, 2.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x07080d, 1);

  // Globe group (rotated by drag and spin-to)
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Globe sphere
  const sphereGeom = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 32);
  const sphereMat = new THREE.MeshPhongMaterial({
    map: createTerrainTexture(THREE),
    emissive: 0x0a0b14,
    specular: 0x1a1a2e,
    shininess: 5,
  });
  globeGroup.add(new THREE.Mesh(sphereGeom, sphereMat));

  const wfGeom = new THREE.IcosahedronGeometry(GLOBE_RADIUS + 0.002, 32);
  globeGroup.add(new THREE.Mesh(wfGeom, new THREE.MeshBasicMaterial({
    color: 0xffffff, wireframe: true, opacity: 0.08, transparent: true,
  })));

  const atmGeom = new THREE.IcosahedronGeometry(GLOBE_RADIUS + 0.04, 32);
  globeGroup.add(new THREE.Mesh(atmGeom, new THREE.MeshBasicMaterial({
    color: 0x38bdf8, opacity: 0.06, transparent: true,
  })));

  const pl = new THREE.PointLight(0xffffff, 0.8, 100);
  pl.position.set(2, 2, 2);
  scene.add(pl);
  scene.add(new THREE.AmbientLight(0x4a4a5e, 0.6));

  // ─── lat/lon → 3D point ───
  function latLonToPoint(lat, lon, r = GLOBE_RADIUS) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
  }

  // ─── Node + ripple state ───
  const nodeObjects = []; // { mesh, mat, quake, pos, baseColor }
  const activeRipples = [];

  function spawnRipples(pos, color) {
    const now = Date.now();
    for (let i = 0; i < RIPPLE_COUNT; i += 1) {
      const delay = (i * RIPPLE_DURATION) / RIPPLE_COUNT;
      const rGeom = new THREE.RingGeometry(0, 0.001, 32);
      const rMat = new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide, opacity: 0.8, transparent: true,
      });
      const ring = new THREE.Mesh(rGeom, rMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      globeGroup.add(ring);
      activeRipples.push({
        ring, rMat, startTime: now + delay, duration: RIPPLE_DURATION,
      });
    }
  }

  function createNode(quake) {
    const pos = latLonToPoint(quake.lat, quake.lon, GLOBE_RADIUS + 0.005);
    const color = getMagnitudeColor(quake.mag);
    const geo = new THREE.SphereGeometry(getMagnitudeScale(quake.mag), 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    globeGroup.add(mesh);
    spawnRipples(latLonToPoint(quake.lat, quake.lon, GLOBE_RADIUS + 0.001), color);
    nodeObjects.push({
      mesh, mat, quake, pos, baseColor: color,
    });
  }

  quakes.slice(0, 20).forEach(createNode);

  // ─── Highlight by quake ID ───
  // Pass null to clear all highlights
  function setHighlight(quakeId) {
    nodeObjects.forEach((obj) => {
      const active = obj.quake.id === quakeId;
      obj.mat.color.setHex(active ? 0xffffff : obj.baseColor);
      obj.mesh.scale.setScalar(active ? 1.8 : 1);
    });
    // Sync panel items via data-quake-id attribute
    wrapper.querySelectorAll('.quake-item').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.quakeId === quakeId);
    });
    // Scroll active item into view in the panel list
    const activeItem = wrapper.querySelector('.quake-item.is-active');
    if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ─── Spin to quake (corrected formula + shortest-path normalization) ───
  let targetY = 0; let targetX = 0; let spinning = false;

  function spinToQuake(quake) {
    // theta = (lon + 180) * π/180; facing camera requires rotation.y = π/2 - theta
    const theta = (quake.lon + 180) * (Math.PI / 180);
    const rawY = Math.PI / 2 - theta;
    // Normalize to shortest angular path from current rotation
    const curr = globeGroup.rotation.y;
    let diff = (rawY - curr) % (2 * Math.PI);
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    targetY = curr + diff;
    targetX = -((quake.lat * Math.PI) / 180) * 0.4;
    spinning = true;
  }

  // ─── Drag to rotate ───
  let dragging = false;
  let lastX = 0; let lastY = 0;
  let autoSpin = true;
  let autoSpinTimer = null;

  function resumeAutoSpin() {
    clearTimeout(autoSpinTimer);
    autoSpinTimer = setTimeout(() => { autoSpin = true; }, 3000);
  }

  canvas.addEventListener('mousedown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    autoSpin = false; spinning = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; const dy = e.clientY - lastY;
    globeGroup.rotation.y += dx * 0.005;
    globeGroup.rotation.x = Math.max(-0.8, Math.min(0.8, globeGroup.rotation.x + dy * 0.005));
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; resumeAutoSpin(); } });

  // Touch drag — passive:false only on touchmove so we can prevent page-scroll while dragging globe
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      autoSpin = false; spinning = false;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging || e.touches.length !== 1) return;
    e.preventDefault(); // prevent page scroll while rotating globe
    const dx = e.touches[0].clientX - lastX; const dy = e.touches[0].clientY - lastY;
    globeGroup.rotation.y += dx * 0.005;
    globeGroup.rotation.x = Math.max(-0.8, Math.min(0.8, globeGroup.rotation.x + dy * 0.005));
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: false });
  canvas.addEventListener('touchend', () => { dragging = false; resumeAutoSpin(); }, { passive: true });

  // ─── Raycaster for hover/click ───
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.05 };
  const mouse = new THREE.Vector2();

  function getHoveredQuakeId(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const meshes = nodeObjects.map((o) => o.mesh);
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      const idx = meshes.indexOf(hits[0].object);
      return nodeObjects[idx]?.quake.id ?? null;
    }
    return null;
  }

  canvas.addEventListener('mousemove', (e) => {
    if (dragging) return;
    const quakeId = getHoveredQuakeId(e);
    if (quakeId) setHighlight(quakeId);
    canvas.style.cursor = quakeId ? 'pointer' : 'grab';
  });
  canvas.addEventListener('click', (e) => {
    const quakeId = getHoveredQuakeId(e);
    if (quakeId) {
      const q = nodeObjects.find((n) => n.quake.id === quakeId)?.quake;
      setHighlight(quakeId);
      if (q) { spinToQuake(q); autoSpin = false; resumeAutoSpin(); }
    }
  });
  canvas.style.cursor = 'grab';

  // Panel hover / click
  function attachPanelListeners() {
    wrapper.querySelectorAll('.quake-item').forEach((item) => {
      const { quakeId } = item.dataset;
      const q = nodeObjects.find((n) => n.quake.id === quakeId)?.quake;
      item.addEventListener('mouseenter', () => { if (quakeId) setHighlight(quakeId); });
      item.addEventListener('click', () => {
        if (q) {
          setHighlight(quakeId);
          spinToQuake(q);
          autoSpin = false;
          resumeAutoSpin();
        }
      });
    });
  }

  // ─── Animation loop ───
  function animate() {
    requestAnimationFrame(animate);
    const now = Date.now();

    // Auto-spin when idle
    if (autoSpin && !dragging && !spinning) globeGroup.rotation.y += 0.0003;

    // Lerp to target when spinning
    if (spinning) {
      globeGroup.rotation.y += (targetY - globeGroup.rotation.y) * 0.05;
      globeGroup.rotation.x += (targetX - globeGroup.rotation.x) * 0.05;
      const doneY = Math.abs(targetY - globeGroup.rotation.y) < 0.001;
      const doneX = Math.abs(targetX - globeGroup.rotation.x) < 0.001;
      if (doneY && doneX) spinning = false;
    }

    // Ripples — loop by resetting when expired
    activeRipples.forEach((item) => {
      const elapsed = now - item.startTime;
      const cycle = item.duration + 500;
      const loopElapsed = ((elapsed % cycle) + cycle) % cycle;
      if (loopElapsed < item.duration) {
        const t = loopElapsed / item.duration;
        const radius = t * 0.38;
        const inner = Math.max(0, radius - 0.05);
        item.ring.geometry.dispose();
        item.ring.geometry = new THREE.RingGeometry(inner, radius, 32);
        item.rMat.opacity = Math.max(0, 0.75 * (1 - t));
        item.ring.visible = true;
      } else {
        item.ring.visible = false;
      }
    });

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    const nw = wrapper.clientWidth; const nh = wrapper.clientHeight;
    if (nw && nh) {
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
  });

  animate();

  return {
    addQuake: (q) => { createNode(q); },
    spinToQuake: (q) => spinToQuake(q),
    setHighlight: (quakeId) => setHighlight(quakeId),
    setAutoSpin: (val) => { autoSpin = val; },
    refreshPanel: () => attachPanelListeners(),
    dispose: () => renderer.dispose(),
  };
}

// ─── Main decorate ───────────────────────────────────────────────────────
export default async function decorate(block) {
  try {
    const blockConfig = parseBlock(block);
    const demo = isDemoMode();
    const config = {
      height: blockConfig.height || '600',
      minMag: blockConfig.minMag ?? 1.0,
      ...blockConfig,
    };

    block.replaceChildren();
    block.style.position = 'relative';
    block.style.minHeight = `${config.height}px`;
    block.append(renderLoadingSpinner());

    let quakes;
    if (demo) {
      quakes = getDemoQuakes().filter((q) => q.mag >= config.minMag);
    } else {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 8000);
      try {
        quakes = await fetchEarthquakes(ac.signal, config.minMag);
      } finally {
        clearTimeout(tid);
      }
    }

    if (!quakes?.length) {
      const msg = demo ? 'Demo data unavailable' : 'No earthquakes in the last hour';
      renderEmpty(block, msg);
      return;
    }

    block.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'quake-wrapper';
    block.append(wrapper);

    const ctrl = await initScene(wrapper, quakes, config);

    const replacePanel = (list, isDemo, newId = null) => {
      const old = wrapper.querySelector('.quake-panel');
      const next = buildPanel(list, isDemo, newId);
      if (old) old.replaceWith(next); else wrapper.append(next);
      ctrl.refreshPanel();
    };

    replacePanel(quakes, demo);

    // ── Demo mode: cinematic surprise quake intro, then auto-spin ──────────
    if (demo) {
      setTimeout(() => {
        const surprise = makeSurpriseQuake();
        quakes = [surprise, ...quakes];
        ctrl.addQuake(surprise);
        replacePanel(quakes, true, surprise.id);
        ctrl.spinToQuake(surprise);
        ctrl.setHighlight(surprise.id);
        // After pause, clear highlight and resume slow auto-spin
        setTimeout(() => {
          ctrl.setHighlight(null);
          ctrl.setAutoSpin(true);
        }, CYCLE_PAUSE_MS);
      }, CYCLE_DELAY_MS);
      return;
    }

    // ── Live mode: cycle top→bottom of panel list, loop ───────────────────
    let cycleIdx = 0;
    const getSorted = () => quakes.slice(0, 10).sort((a, b) => b.mag - a.mag);

    const doCycle = () => {
      const sorted = getSorted();
      if (!sorted.length) return;
      const q = sorted[cycleIdx % sorted.length];
      ctrl.spinToQuake(q);
      ctrl.setHighlight(q.id);
      cycleIdx += 1;
    };

    // Delay start, then repeat every CYCLE_PAUSE_MS
    let cycleHandle = null;
    const scheduleCycle = () => {
      cycleHandle = setTimeout(() => {
        doCycle();
        cycleHandle = setTimeout(function loop() {
          doCycle();
          cycleHandle = setTimeout(loop, CYCLE_PAUSE_MS);
        }, CYCLE_PAUSE_MS);
      }, CYCLE_DELAY_MS);
    };
    scheduleCycle();

    // ── Live polling ──────────────────────────────────────────────────────
    setInterval(async () => {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 5000);
        const fresh = await fetchEarthquakes(ac.signal, config.minMag);
        clearTimeout(t);
        if (!fresh?.length) return;

        const prevIds = new Set(quakes.map((q) => q.id));
        fresh.filter((q) => !prevIds.has(q.id)).forEach((q) => ctrl.addQuake(q));

        replacePanel(fresh, false);
        quakes = fresh;
      } catch { /* ignore poll errors */ }
    }, POLL_INTERVAL);

    // Clean up cycle on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimeout(cycleHandle);
      } else {
        scheduleCycle();
      }
    }, { once: false });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('viz-quake-feed initialization failed:', err);
    renderEmpty(block, `Error: ${err.message}`);
  }
}
