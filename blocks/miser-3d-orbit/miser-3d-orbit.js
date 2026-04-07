import { loadScript } from '../../scripts/aem.js';

// ---------------------------------------------------------------------------
// Parse block rows into satellite configs + height
// Row format: label|radius|speed|size|color  (pipe-delimited)
// A bare number row (e.g. "520") sets canvas height in px.
// ---------------------------------------------------------------------------
function parseRows(block) {
  const rows = [...block.children];
  const satellites = [];
  let height = 420;

  rows.forEach((row) => {
    const text = (row.querySelector('div, p') || row).textContent.trim();
    if (text.includes('|')) {
      const [rawLabel, rawRadius, rawSpeed, rawSize, rawColor] = text.split('|').map((s) => s.trim());
      const speedVal = rawSpeed !== '' && rawSpeed != null ? parseFloat(rawSpeed) : 1.0;
      satellites.push({
        label: rawLabel || '',
        radius: Math.max(0.5, parseFloat(rawRadius) || 2.5),
        speed: Number.isNaN(speedVal) ? 1.0 : speedVal,
        size: Math.max(0.04, parseFloat(rawSize) || 0.18),
        color: rawColor || '#60a5fa',
      });
    } else if (/^\d+(\.\d+)?(px)?$/.test(text)) {
      height = parseInt(text, 10) || height;
    }
  });

  rows.forEach((r) => r.remove());
  return { satellites, height };
}

// ---------------------------------------------------------------------------
// Build a starfield point cloud
// ---------------------------------------------------------------------------
function buildStarfield(THREE, count = 600, spread = 90) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.08, color: 0xffffff, transparent: true, opacity: 0.45,
    }),
  );
}

// ---------------------------------------------------------------------------
// Main block decorator
// ---------------------------------------------------------------------------
export default async function decorate(block) {
  const { satellites, height } = parseRows(block);

  block.style.height = `${height}px`;

  // DOM structure
  const canvas = document.createElement('canvas');
  canvas.className = 'orbit-canvas';
  block.append(canvas);

  const labelsEl = document.createElement('div');
  labelsEl.className = 'orbit-labels';
  block.append(labelsEl);

  // Load Three.js
  await loadScript('https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js');
  const { THREE } = window;
  if (!THREE) return;

  // -----------------------------------------------------------------------
  // Scene + camera + renderer
  // -----------------------------------------------------------------------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 5, 16);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // -----------------------------------------------------------------------
  // Environment: stars + lighting
  // -----------------------------------------------------------------------
  scene.add(buildStarfield(THREE));
  scene.add(new THREE.AmbientLight(0x0d0d2b, 1.0));

  const sunLight = new THREE.PointLight(0xfff4c2, 3.0, 80);
  scene.add(sunLight); // placed at origin — illuminates all satellites

  // -----------------------------------------------------------------------
  // Central star / core
  // -----------------------------------------------------------------------
  const coreMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffee88,
      emissive: 0xffcc33,
      emissiveIntensity: 1.6,
      roughness: 0.35,
      metalness: 0.0,
    }),
  );
  scene.add(coreMesh);

  // Soft corona halo
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffee66, transparent: true, opacity: 0.07 }),
  ));

  // -----------------------------------------------------------------------
  // Orbital group (drag + auto-rotate applied here)
  // -----------------------------------------------------------------------
  const orbGroup = new THREE.Group();
  scene.add(orbGroup);

  // -----------------------------------------------------------------------
  // Build rings + satellites
  // -----------------------------------------------------------------------
  const satData = satellites.map((cfg, idx) => {
    const color = new THREE.Color(cfg.color);

    // Each ring tilts a little more than the last — creates visual depth
    const ringTilt = Math.PI / 2 + idx * 0.22;

    // Orbital ring (TorusGeometry)
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.radius, 0.013, 6, 120),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      }),
    );
    ringMesh.rotation.x = ringTilt;
    orbGroup.add(ringMesh);

    // Pivot — satellite travels in pivot's local XY plane; pivot rotation
    // matches the ring tilt so the satellite rides the ring correctly.
    const pivot = new THREE.Object3D();
    pivot.rotation.x = ringTilt;
    orbGroup.add(pivot);

    // Satellite sphere
    const satMesh = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.size, 20, 20),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.65,
        roughness: 0.22,
        metalness: 0.45,
      }),
    );
    pivot.add(satMesh);

    // HUD label element
    const labelEl = document.createElement('div');
    labelEl.className = 'orbit-label';
    labelEl.textContent = cfg.label;
    labelEl.style.setProperty('--lc', cfg.color);
    labelsEl.append(labelEl);

    return {
      pivot,
      satMesh,
      labelEl,
      radius: cfg.radius,
      speed: cfg.speed,
      angle: (idx * Math.PI * 2) / Math.max(satellites.length, 1),
    };
  });

  // -----------------------------------------------------------------------
  // Resize handler
  // -----------------------------------------------------------------------
  const resize = () => {
    const rect = block.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(block);
  resize();

  // -----------------------------------------------------------------------
  // Drag interaction (mouse + touch)
  // -----------------------------------------------------------------------
  let isDragging = false;
  let dragLastX = 0;
  let dragLastY = 0;
  let dragRotY = 0;
  let dragRotX = 0;

  const onDragStart = (x, y) => { isDragging = true; dragLastX = x; dragLastY = y; };
  const onDragEnd = () => { isDragging = false; };
  const onDragMove = (x, y) => {
    if (!isDragging) return;
    dragRotY += (x - dragLastX) * 0.008;
    dragRotX += (y - dragLastY) * 0.004;
    dragRotX = Math.max(-1.1, Math.min(1.1, dragRotX));
    dragLastX = x;
    dragLastY = y;
  };

  canvas.addEventListener('mousedown', (e) => onDragStart(e.clientX, e.clientY));
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));

  canvas.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  window.addEventListener('touchend', onDragEnd);
  window.addEventListener('touchmove', (e) => {
    if (isDragging) onDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // -----------------------------------------------------------------------
  // Scroll zoom
  // -----------------------------------------------------------------------
  let targetZ = camera.position.z;
  block.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZ = Math.max(4, Math.min(40, targetZ + e.deltaY * 0.025));
  }, { passive: false });

  // -----------------------------------------------------------------------
  // Label projection helper
  // -----------------------------------------------------------------------
  const projVec = new THREE.Vector3();
  const worldPos = new THREE.Vector3();

  const projectLabel = (pos3D) => {
    const rect = block.getBoundingClientRect();
    projVec.copy(pos3D).project(camera);
    return {
      x: (projVec.x * 0.5 + 0.5) * rect.width,
      y: (-projVec.y * 0.5 + 0.5) * rect.height,
      // z > 1 → behind camera / beyond far plane
      opacity: projVec.z > 1 ? 0 : Math.max(0, 1 - projVec.z * 0.6),
    };
  };

  // -----------------------------------------------------------------------
  // Animation loop
  // -----------------------------------------------------------------------
  let running = false;
  let frameId = 0;
  let autoAngle = 0;

  const animate = () => {
    if (!running) return;
    frameId = window.requestAnimationFrame(animate);

    autoAngle += 0.0025;
    orbGroup.rotation.y = autoAngle + dragRotY;
    orbGroup.rotation.x = dragRotX;
    coreMesh.rotation.y += 0.004;

    // Smooth camera zoom
    camera.position.z += (targetZ - camera.position.z) * 0.07;

    // Update each satellite position + label
    satData.forEach((sd) => {
      sd.angle += sd.speed * 0.008;

      // Satellite travels in pivot's local XY plane → follows the torus ring
      sd.satMesh.position.set(
        Math.cos(sd.angle) * sd.radius,
        Math.sin(sd.angle) * sd.radius,
        0,
      );

      // Project world position to screen for label placement
      sd.satMesh.getWorldPosition(worldPos);
      const { x, y, opacity } = projectLabel(worldPos);

      if (opacity <= 0) {
        sd.labelEl.style.opacity = '0';
      } else {
        sd.labelEl.style.opacity = String(opacity);
        // Offset label 10px right of satellite, vertically centered
        sd.labelEl.style.transform = `translate(calc(${x + 10}px), calc(${y}px - 50%))`;
      }
    });

    renderer.render(scene, camera);
  };

  // Only run when visible
  new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible && !running) {
      running = true;
      animate();
    } else if (!visible && running) {
      running = false;
      window.cancelAnimationFrame(frameId);
    }
  }, { threshold: 0.1 }).observe(block);
}
