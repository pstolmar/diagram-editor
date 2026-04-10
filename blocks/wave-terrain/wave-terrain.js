import { loadScript } from '../../scripts/aem.js';

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';

function parseBlock(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const params = {};
  rows.forEach((row) => {
    const [keyCell, valCell] = row.querySelectorAll(':scope > div');
    if (!keyCell || !valCell) return;
    const key = keyCell.textContent.trim().toLowerCase();
    const val = valCell.textContent.trim();
    params[key] = val;
  });
  return params;
}

function showEmptyState(block) {
  block.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'viz-empty-state';
  msg.textContent = 'Wave Terrain requires WebGL';
  block.appendChild(msg);
}

export default async function decorate(block) {
  // Load Three.js
  try {
    await loadScript(THREE_CDN);
  } catch {
    showEmptyState(block);
    return;
  }

  if (!window.THREE) {
    showEmptyState(block);
    return;
  }

  // Parse params from block table
  let params = parseBlock(block);
  const hasContent = Object.keys(params).length > 0;

  if (!hasContent) {
    try {
      const demoUrl = new URL('wave-terrain-demo.json', import.meta.url);
      const resp = await fetch(demoUrl);
      if (resp.ok) {
        params = await resp.json();
      }
    } catch {
      // silently ignore; use defaults
    }
  }

  const color = params.color || '#00aaff';
  const speed = parseFloat(params.speed) || 1.0;
  const segments = parseInt(params.segments, 10) || 60;
  const mousFollow = (params.mousfollow !== 'false'); // default true
  block.dataset.mousFollow = mousFollow;

  const { THREE } = window;

  // Check WebGL support
  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
  if (!gl) {
    showEmptyState(block);
    return;
  }

  // Clear block content and build canvas wrapper
  block.innerHTML = '';
  block.style.display = 'block';

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '400px';
  block.appendChild(canvas);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);

  function getSize() {
    return {
      width: block.offsetWidth || canvas.clientWidth || 800,
      height: 400,
    };
  }

  function updateRendererSize() {
    const { width, height } = getSize();
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(window.devicePixelRatio);
  }
  updateRendererSize();

  // Scene & camera
  const scene = new THREE.Scene();
  const { width: w, height: h } = getSize();
  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 0, 0);

  // Geometry – plane in XZ, rotated
  const geometry = new THREE.PlaneGeometry(10, 10, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  // Store original XZ positions for animation
  const posAttr = geometry.attributes.position;
  const { count } = posAttr;
  const baseXZ = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    baseXZ[i * 2] = posAttr.getX(i);
    baseXZ[i * 2 + 1] = posAttr.getZ(i);
  }

  // Filled semi-transparent mesh
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    wireframe: false,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const fillMesh = new THREE.Mesh(geometry, fillMaterial);
  scene.add(fillMesh);

  // Wireframe overlay
  const wireframeGeo = new THREE.WireframeGeometry(geometry);
  const wireMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: false,
    opacity: 1.0,
  });
  const wireLines = new THREE.LineSegments(wireframeGeo, wireMaterial);
  scene.add(wireLines);

  // Mouse / camera tilt state
  let targetTiltX = 0; // ±0.5 tilt offset on X
  let targetTiltY = 4; // Y between 3–5
  let currentTiltX = 0;
  let currentTiltY = 4;

  // Global mouse tracking (NDC)
  let mouseNDCX = 0;
  let mouseNDCY = 0;
  let inView = false;

  function onMouseMove(e) {
    // Convert to NDC regardless of cursor position
    mouseNDCX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDCY = -(e.clientY / window.innerHeight) * 2 + 1;

    if (mousFollow) {
      targetTiltX = mouseNDCX * 0.5;
      targetTiltY = 4 - mouseNDCY * 1;
      targetTiltY = Math.max(3, Math.min(5, targetTiltY));
    }
  }

  document.addEventListener('mousemove', onMouseMove);

  // IntersectionObserver for in-view detection
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      inView = entry.isIntersecting;
    });
  }, { threshold: 0.1 });
  io.observe(block);

  // Sparkle particles setup
  const sparkleCount = 150;
  const sparkleGeometry = new THREE.BufferGeometry();
  const sparklePositions = new Float32Array(sparkleCount * 3);
  const sparkleVelocities = new Float32Array(sparkleCount * 3);
  const sparkleColors = new Float32Array(sparkleCount * 3);
  const baseColor = new THREE.Color(color);

  // Initialize sparkle positions and velocities
  for (let i = 0; i < sparkleCount; i += 1) {
    const x = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 10;
    const y = Math.random() * 1.5;
    sparklePositions[i * 3] = x;
    sparklePositions[i * 3 + 1] = y;
    sparklePositions[i * 3 + 2] = z;

    sparkleVelocities[i * 3] = 0;
    sparkleVelocities[i * 3 + 1] = 0.01 + Math.random() * 0.02;
    sparkleVelocities[i * 3 + 2] = 0;

    const col = baseColor.clone();
    col.offsetHSL(0, 0, 0.3);
    sparkleColors[i * 3] = col.r;
    sparkleColors[i * 3 + 1] = col.g;
    sparkleColors[i * 3 + 2] = col.b;
  }

  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  sparkleGeometry.setAttribute('color', new THREE.BufferAttribute(sparkleColors, 3));

  const sparkleMaterial = new THREE.PointsMaterial({
    size: 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });
  const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
  scene.add(sparkles);

  // Animation
  let animId = null;
  let time = 0;
  const clock = new THREE.Clock();

  function updateGeometry() {
    // Mouse world position
    const mouseWorldX = mouseNDCX * 5;
    const mouseWorldZ = mouseNDCY * 5;

    for (let i = 0; i < count; i += 1) {
      const x = baseXZ[i * 2];
      const z = baseXZ[i * 2 + 1];
      let y = Math.sin(x * 1.5 + time * speed) * Math.cos(z * 1.5 + time * speed) * 0.5;

      // Ripple term (only when in view)
      if (inView) {
        const dx = x - mouseWorldX;
        const dz = z - mouseWorldZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const ripple = Math.sin(dist * 2 - time * speed * 2) / (1 + dist);
        y += ripple * 0.3;
      }

      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  function updateSparkles() {
    if (!inView) return;

    const posArray = sparkleGeometry.attributes.position.array;
    const mouseWorldX = mouseNDCX * 5;
    const mouseWorldZ = mouseNDCY * 5;

    for (let i = 0; i < sparkleCount; i += 1) {
      let x = posArray[i * 3];
      let y = posArray[i * 3 + 1];
      let z = posArray[i * 3 + 2];

      // Drift Y
      y += sparkleVelocities[i * 3 + 1];

      // Reset if above Y=1.5
      if (y > 1.5) {
        y = Math.random() * 0.2;
        sparkleVelocities[i * 3 + 1] = 0.01 + Math.random() * 0.02;

        if (i < sparkleCount * 0.4) {
          // ~40% clustered within radius 2 of mouse
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.random() * 2;
          x = mouseWorldX + Math.cos(angle) * rad;
          z = mouseWorldZ + Math.sin(angle) * rad;
        } else {
          // Non-clustered particles spawn randomly
          x = (Math.random() - 0.5) * 10;
          z = (Math.random() - 0.5) * 10;
        }
      }

      posArray[i * 3] = x;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = z;
    }

    sparkleGeometry.attributes.position.needsUpdate = true;
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    time += delta;

    updateGeometry();
    updateSparkles();

    // Rebuild wireframe geometry each frame so it tracks vertex displacement
    wireframeGeo.copy(new THREE.WireframeGeometry(geometry));

    // Lerp camera
    const lf = 0.05;
    currentTiltX += (targetTiltX - currentTiltX) * lf;
    currentTiltY += (targetTiltY - currentTiltY) * lf;

    camera.position.set(currentTiltX, currentTiltY, 8);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  // Resize observer
  const ro = new ResizeObserver(() => {
    updateRendererSize();
    const { width: rw, height: rh } = getSize();
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
  });
  ro.observe(block);

  // Cleanup on block removal
  const mo = new MutationObserver(() => {
    if (!document.contains(block)) {
      cancelAnimationFrame(animId);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      geometry.dispose();
      wireframeGeo.dispose();
      sparkleGeometry.dispose();
      fillMaterial.dispose();
      wireMaterial.dispose();
      sparkleMaterial.dispose();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
