/* m3d-orbit — THREE.js orbital system block */

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';
const BASE_SPEED = 0.25; // radians/sec at speed=1.0

const DEMO_CSV = `label,radius,speed,size,color
Sun,0,0,0.38,#FFD000
Mercury,1,1.5,0.055,#A8A8A8
Venus,1.5,1.2,0.092,#E8D5A3
Earth,2,1.0,0.100,#4B9CD3
Mars,2.5,0.8,0.068,#C1440E
Jupiter,3.5,0.5,0.240,#C88B3A
Saturn,4.5,0.3,0.200,#E4D191
Uranus,5.5,0.2,0.140,#7EC8C8
Neptune,6.5,0.1,0.130,#3B7BBF`;

// ── helpers ──────────────────────────────────────────────────────────────────

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

function parseCSV(text) {
  const lines = text.trim().split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    const o = {};
    headers.forEach((h, i) => { o[h] = vals[i] ?? ''; });
    return {
      label: o.label || '',
      radius: parseFloat(o.radius) || 0,
      speed: parseFloat(o.speed) || 0,
      size: parseFloat(o.size) || 0.1,
      color: o.color || '#ffffff',
    };
  });
  return rows.length ? rows : null;
}

function readBlockCSV(block) {
  const pre = block.querySelector('pre');
  if (pre) return pre.textContent;
  // Single-cell table row pattern (EDS authoring)
  const td = block.querySelector('td');
  if (td) return td.textContent;
  return block.textContent.trim();
}

// ── scene builders ────────────────────────────────────────────────────────────

function buildStars(THREE, scene) {
  const N = 2400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i += 1) pos[i] = (Math.random() - 0.5) * 400;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.25, sizeAttenuation: true, transparent: true, opacity: 0.75,
  });
  scene.add(new THREE.Points(geo, mat));
}

function buildBody(THREE, scene, body, initAngle) {
  const color = new THREE.Color(body.color);

  if (body.radius === 0) {
    // Central body — emissive sun
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.0,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.size, 40, 40), mat);
    scene.add(mesh);
    return null; // no satellite entry needed
  }

  // Orbital ring (torus in XZ plane)
  const ringGeo = new THREE.TorusGeometry(body.radius, 0.007, 6, 180);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x1e3050, transparent: true, opacity: 0.45,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  // Planet
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.size, 22, 22), mat);
  mesh.position.set(
    Math.cos(initAngle) * body.radius,
    0,
    Math.sin(initAngle) * body.radius,
  );
  scene.add(mesh);

  return { mesh, body, angle: initAngle };
}

// ── main ──────────────────────────────────────────────────────────────────────

export default async function decorate(block) {
  const csvText = readBlockCSV(block);
  const bodies = parseCSV(csvText) || parseCSV(DEMO_CSV);

  // DOM setup
  block.innerHTML = '';

  const canvas = document.createElement('canvas');

  const labelLayer = document.createElement('div');
  labelLayer.className = 'm3d-orbit-labels';

  block.appendChild(canvas);
  block.appendChild(labelLayer);

  // Load THREE
  const THREE = await loadThree();
  if (!THREE) return;

  const getSize = () => ({
    w: block.clientWidth || 700,
    h: block.clientHeight || 420,
  });
  let { w, h } = getSize();

  // Scene
  const scene = new THREE.Scene();

  // Lights
  scene.add(new THREE.AmbientLight(0x102040, 4));
  const sunLight = new THREE.PointLight(0xfff4e0, 3.5, 80);
  scene.add(sunLight);

  // Camera
  const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 600);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);

  // Stars + bodies
  buildStars(THREE, scene);
  const satellites = [];

  bodies.forEach((body, i) => {
    const initAngle = (i / Math.max(bodies.length - 1, 1)) * Math.PI * 2;
    const sat = buildBody(THREE, scene, body, initAngle);
    if (sat) {
      // Label
      const div = document.createElement('div');
      div.className = 'm3d-orbit-label';
      div.textContent = body.label;
      labelLayer.appendChild(div);
      sat.div = div;
      satellites.push(sat);
    }
  });

  // ── orbit state
  let ORBIT_R = 18;
  let theta = 0.85; // azimuth
  let phi = 0.52; // elevation

  const updateCamera = () => {
    camera.position.set(
      ORBIT_R * Math.cos(phi) * Math.sin(theta),
      ORBIT_R * Math.sin(phi),
      ORBIT_R * Math.cos(phi) * Math.cos(theta),
    );
    camera.lookAt(0, 0, 0);
  };
  updateCamera();

  // ── drag controls
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let lastInteraction = 0;

  const startDrag = (cx, cy) => {
    dragging = true;
    dragX = cx;
    dragY = cy;
    lastInteraction = performance.now();
    block.classList.add('is-dragging');
  };
  const moveDrag = (cx, cy) => {
    if (!dragging) return;
    theta -= (cx - dragX) * 0.012;
    phi = Math.max(0.05, Math.min(1.48, phi - (cy - dragY) * 0.009));
    dragX = cx;
    dragY = cy;
    lastInteraction = performance.now();
    updateCamera();
  };
  const endDrag = () => {
    dragging = false;
    block.classList.remove('is-dragging');
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
    ORBIT_R = Math.max(6, Math.min(45, ORBIT_R * (e.deltaY > 0 ? 1.07 : 0.935)));
    lastInteraction = performance.now();
    updateCamera();
  }, { passive: false });

  // ── resize
  const ro = new ResizeObserver(() => {
    ({ w, h } = getSize());
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(block);

  // ── animate
  let raf;
  let last = performance.now();

  const animate = (now) => {
    raf = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // Slow auto-rotate when idle (pause 1.5s after interaction)
    if (!dragging && now - lastInteraction > 1500) {
      theta += 0.004;
      updateCamera();
    }

    // Advance orbits
    satellites.forEach((sat) => {
      sat.angle += sat.body.speed * BASE_SPEED * dt;
      sat.mesh.position.set(
        Math.cos(sat.angle) * sat.body.radius,
        0,
        Math.sin(sat.angle) * sat.body.radius,
      );
    });

    renderer.render(scene, camera);

    // Update label screen positions
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    satellites.forEach(({ mesh, body, div }) => {
      const p = mesh.position.clone();
      p.y += body.size + 0.2;
      p.project(camera);

      if (p.z >= 1) {
        div.style.display = 'none';
        return;
      }
      div.style.display = '';
      div.style.left = `${(p.x * 0.5 + 0.5) * cw}px`;
      div.style.top = `${(-p.y * 0.5 + 0.5) * ch}px`;
    });
  };

  animate(performance.now());

  // Cleanup
  block.addEventListener('m3d:destroy', () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('mousemove', moveDrag);
    window.removeEventListener('mouseup', endDrag);
    renderer.dispose();
  });
}
