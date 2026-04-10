/**
 * m3d-photo-globe — Interactive 3D globe with clickable photo-location markers
 *
 * Drag to rotate. Click a marker to reveal a photo card popup.
 * Uses Three.js for the globe; demo data from m3d-photo-globe-demo.json.
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';
const GLOBE_RADIUS = 1;

let threeReady = null;
function loadThreeJS() {
  if (!threeReady) {
    threeReady = new Promise((resolve, reject) => {
      if (window.THREE) { resolve(window.THREE); return; }
      const s = document.createElement('script');
      s.src = THREE_URL;
      s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('THREE missing')));
      s.onerror = reject;
      document.head.append(s);
    });
  }
  return threeReady;
}

function latLonToVec3(THREE, lat, lon, r = GLOBE_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function buildGlobeTexture(THREE) {
  const W = 512; const H = 256;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  // Ocean gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b2a6b');
  grad.addColorStop(1, '#0d4080');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Landmass blobs (simplified procedural)
  ctx.fillStyle = '#2d5a27';
  const blobs = [
    [0.28, 0.42, 0.14, 0.22], // North America
    [0.28, 0.62, 0.06, 0.12], // South America
    [0.42, 0.38, 0.12, 0.20], // Europe/Africa
    [0.62, 0.38, 0.20, 0.24], // Asia
    [0.78, 0.62, 0.06, 0.07], // Australia
  ];
  blobs.forEach(([rx, ry, rw, rh]) => {
    ctx.beginPath();
    ctx.ellipse(rx * W, ry * H, rw * W, rh * H, 0.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ice caps
  ctx.fillStyle = '#c8daf0';
  ctx.beginPath();
  ctx.ellipse(W / 2, 0, W * 0.4, H * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W / 2, H, W * 0.3, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cvs);
  tex.needsUpdate = true;
  return tex;
}

function buildPopup(block, loc) {
  // Remove existing popup
  block.querySelector('.photo-globe-popup')?.remove();

  const popup = document.createElement('div');
  popup.className = 'photo-globe-popup';
  popup.style.cssText = `
    position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
    background:#0c1826; border:1px solid ${loc.color}; border-radius:8px;
    overflow:hidden; width:280px; z-index:30; box-shadow:0 8px 32px rgba(0,0,0,0.6);
    animation:popup-in 0.25s ease;
  `;
  popup.innerHTML = `
    <style>
      @keyframes popup-in { from { opacity:0; transform:translateX(-50%) translateY(12px); }
        to { opacity:1; transform:translateX(-50%) translateY(0); } }
    </style>
    <img src="${loc.imageUrl}" alt="${loc.label}"
      style="width:100%;height:140px;object-fit:cover;display:block;" loading="lazy"
      onerror="this.style.display='none'">
    <div style="padding:10px 12px;">
      <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${loc.color};margin-bottom:4px;">
        ${loc.label}
      </div>
      <div style="font-size:0.8rem;color:#94a3b8;line-height:1.4;">${loc.caption || ''}</div>
    </div>
    <button style="position:absolute;top:8px;right:8px;width:22px;height:22px;background:rgba(0,0,0,0.5);
      border:none;border-radius:50%;color:#fff;font-size:14px;cursor:pointer;line-height:1;padding:0;"
      aria-label="Close">✕</button>
  `;
  popup.querySelector('button').addEventListener('click', () => popup.remove());
  block.querySelector('.m3d-photo-globe-canvas-container').append(popup);
}

/**
 * Parse location rows authored in the block table.
 * Each row: | Label | lat,lon | Image URL | Caption | Color |
 * Returns null if the block has no authored rows.
 */
const LOCATION_COLORS = ['#ff4081', '#40c4ff', '#69f0ae', '#ffab40', '#ea80fc', '#ff6e40', '#b388ff'];

function parseBlockLocations(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return null;
  const locations = rows.map((row, i) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const label = cells[0]?.textContent.trim() || `Location ${i + 1}`;
    const latlon = (cells[1]?.textContent.trim() || '0,0').split(',');
    const lat = parseFloat(latlon[0]) || 0;
    const lon = parseFloat(latlon[1]) || 0;
    const imageUrl = cells[2]?.querySelector('img')?.src || cells[2]?.textContent.trim() || '';
    const caption = cells[3]?.textContent.trim() || '';
    const color = LOCATION_COLORS[i % LOCATION_COLORS.length];
    return {
      id: `loc-${i}`, lat, lon, label, caption, color, imageUrl,
    };
  }).filter((loc) => loc.label);
  return locations.length ? { locations } : null;
}

export default async function decorate(block) {
  // Prefer authored block content; fall back to demo JSON
  let data = parseBlockLocations(block);
  if (!data) {
    try {
      const url = new URL('./m3d-photo-globe-demo.json', import.meta.url).href;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      block.innerHTML = `<div class="m3d-photo-globe-empty">
        <div>🌍</div><div>Globe data unavailable: ${e.message}</div></div>`;
      return;
    }
  }

  const THREE = await loadThreeJS();

  block.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'm3d-photo-globe-canvas-container';

  const canvas = document.createElement('canvas');
  canvas.className = 'm3d-photo-globe-canvas';
  container.append(canvas);
  block.append(container);

  const size = container.clientWidth || 500;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 2.6);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x070c18, 1);

  const globe = new THREE.Group();
  scene.add(globe);

  // Sphere
  const geo = new THREE.SphereGeometry(GLOBE_RADIUS, 48, 32);
  globe.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    map: buildGlobeTexture(THREE),
    emissive: 0x050b1a,
    specular: 0x223355,
    shininess: 8,
  })));

  // Atmosphere
  const atmGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.04, 48, 32);
  globe.add(new THREE.Mesh(atmGeo, new THREE.MeshBasicMaterial({
    color: 0x4488ff, opacity: 0.06, transparent: true,
  })));

  // Lights
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(3, 2, 3);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x334466, 0.8));

  // Location markers
  const markerMeshes = [];
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  data.locations.forEach((loc) => {
    const pos = latLonToVec3(THREE, loc.lat, loc.lon, GLOBE_RADIUS + 0.025);
    const color = parseInt(loc.color.replace('#', ''), 16);

    // Pin sphere
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    pin.position.copy(pos);
    pin.userData = { loc };
    globe.add(pin);
    markerMeshes.push(pin);

    // Halo ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.045, 0.065, 16),
      new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide, opacity: 0.5, transparent: true,
      }),
    );
    ring.position.copy(pos);
    ring.lookAt(new THREE.Vector3(0, 0, 0));
    globe.add(ring);
  });

  // Drag rotation
  let dragging = false; let lastX = 0; let lastY = 0;
  canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    globe.rotation.y += (e.clientX - lastX) * 0.006;
    const dy = globe.rotation.x + (e.clientY - lastY) * 0.006;
    globe.rotation.x = Math.max(-0.8, Math.min(0.8, dy));
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging || e.touches.length !== 1) return;
    e.preventDefault();
    globe.rotation.y += (e.touches[0].clientX - lastX) * 0.006;
    const tdy = globe.rotation.x + (e.touches[0].clientY - lastY) * 0.006;
    globe.rotation.x = Math.max(-0.8, Math.min(0.8, tdy));
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: false });
  canvas.addEventListener('touchend', () => { dragging = false; }, { passive: true });

  // Click → popup
  canvas.style.cursor = 'grab';
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(markerMeshes);
    if (hits.length > 0) buildPopup(block, hits[0].object.userData.loc);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (dragging) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    canvas.style.cursor = raycaster.intersectObjects(markerMeshes).length > 0 ? 'pointer' : 'grab';
  });

  // Animate
  function animate() {
    requestAnimationFrame(animate);
    if (!dragging) globe.rotation.y += 0.0004;
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    const s = container.clientWidth || 500;
    renderer.setSize(s, s);
  });

  animate();
}
