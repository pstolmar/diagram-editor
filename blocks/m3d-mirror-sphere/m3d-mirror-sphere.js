const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';

let threeReady = null;
async function loadThreeJS() {
  if (!threeReady) {
    threeReady = new Promise((resolve, reject) => {
      if (window.THREE) { resolve(window.THREE); return; }
      const script = document.createElement('script');
      script.src = THREE_URL;
      script.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('Three.js not on window')));
      script.onerror = reject;
      document.head.append(script);
    });
  }
  return threeReady;
}

/**
 * Parse data from block rows
 * Row 0: image URL (equirectangular env map)
 * Row 1: caption text
 */
function parseBlock(block) {
  const rows = [...block.querySelectorAll('div')];
  let imageUrl = '';
  let caption = '';

  if (rows[0]) {
    imageUrl = rows[0].textContent.trim();
  }
  if (rows[1]) {
    caption = rows[1].textContent.trim();
  }

  return { imageUrl, caption };
}

/**
 * Render an empty state message
 */
function renderEmpty(block, message = 'No image URL provided') {
  const empty = document.createElement('div');
  empty.className = 'mirror-sphere-empty-state';
  empty.innerHTML = `
    <div class="mirror-sphere-empty-icon">🔮</div>
    <div class="mirror-sphere-empty-title">Mirror Sphere Unavailable</div>
    <div class="mirror-sphere-empty-hint">${message}</div>
    <div class="mirror-sphere-empty-instructions">Provide an equirectangular image URL in the first block row</div>
  `;
  block.replaceChildren(empty);
}

/**
 * Create and render the Three.js mirror sphere scene
 */
async function initScene(block, imageUrl) {
  // Load Three.js
  const THREE = await loadThreeJS();

  // Setup canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'mirror-sphere-canvas';
  canvas.className = 'mirror-sphere-canvas';
  block.append(canvas);

  // Scene setup
  const scene = new THREE.Scene();
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 600;
  const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setClearColor(0x0a0a0a, 1);
  camera.position.z = 3;

  // Texture loader
  const textureLoader = new THREE.TextureLoader();
  let envMapTexture;

  try {
    envMapTexture = await new Promise((resolve, reject) => {
      textureLoader.load(
        imageUrl,
        (texture) => resolve(texture),
        undefined,
        (error) => reject(error),
      );
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load environment map:', error);
    renderEmpty(block, `Failed to load image: ${error.message}`);
    return;
  }

  // Create PMREM from equirectangular texture
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromEquirectangular(envMapTexture);
  pmremGenerator.dispose();

  // Create chrome sphere with metalness:1, roughness:0
  const sphereGeom = new THREE.IcosahedronGeometry(2, 32);
  const sphereMat = new THREE.MeshStandardMaterial({
    metalness: 1,
    roughness: 0,
    envMap: envMap.texture,
  });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  scene.add(sphere);

  // Background: same env map at 20% opacity
  scene.background = envMapTexture;
  scene.backgroundIntensity = 0.2;

  // Lighting (minimal, since sphere is fully reflective)
  const light = new THREE.DirectionalLight(0xffffff, 0.5);
  light.position.set(5, 5, 5);
  scene.add(light);
  const ambLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambLight);

  // Camera orbit state
  let azimuth = 0;
  let elevation = Math.PI / 6; // 30 degrees
  const orbitRadius = 3;
  let isAutoOrbiting = false;
  let autoOrbitTimer = null;

  /**
   * Update camera position based on azimuth and elevation
   */
  function updateCameraPosition() {
    const x = orbitRadius * Math.cos(elevation) * Math.sin(azimuth);
    const y = orbitRadius * Math.sin(elevation);
    const z = orbitRadius * Math.cos(elevation) * Math.cos(azimuth);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  }

  /**
   * Start auto-orbit after 5s of inactivity
   */
  function resetAutoOrbitTimer() {
    if (autoOrbitTimer) clearTimeout(autoOrbitTimer);
    isAutoOrbiting = false;

    autoOrbitTimer = setTimeout(() => {
      isAutoOrbiting = true;
    }, 5000);
  }

  // Mouse interaction: drag to rotate
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    resetAutoOrbitTimer();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    azimuth -= deltaX * 0.01;
    elevation += deltaY * 0.01;

    // Clamp elevation to prevent sphere from flipping
    elevation = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, elevation));

    updateCameraPosition();
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  // Touch interaction: drag to rotate
  let isTouching = false;
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isTouching = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      resetAutoOrbitTimer();
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!isTouching || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    azimuth -= deltaX * 0.01;
    elevation += deltaY * 0.01;

    elevation = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, elevation));

    updateCameraPosition();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });

  canvas.addEventListener('touchend', () => {
    isTouching = false;
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Auto-orbit when idle
    if (isAutoOrbiting && !isDragging && !isTouching) {
      azimuth += 0.0005;
      updateCameraPosition();
    }

    renderer.render(scene, camera);
  }

  // Handle resize
  window.addEventListener('resize', () => {
    const newW = canvas.clientWidth;
    const newH = canvas.clientHeight;
    if (newW && newH) {
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    }
  });

  updateCameraPosition();
  animate();
}

/**
 * Main block decoration function
 */
export default async function decorate(block) {
  try {
    // Parse block content
    const { imageUrl, caption } = parseBlock(block);

    // Validate image URL
    if (!imageUrl) {
      renderEmpty(block, 'No image URL provided in first block row');
      return;
    }

    // Clear block and setup container
    block.replaceChildren();
    block.className = 'mirror-sphere';
    block.style.position = 'relative';
    block.style.minHeight = '600px';

    // Initialize Three.js scene
    await initScene(block, imageUrl);

    // Render caption below canvas if provided
    if (caption) {
      const captionEl = document.createElement('div');
      captionEl.className = 'mirror-sphere-caption';
      captionEl.textContent = caption;
      block.append(captionEl);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('m3d-mirror-sphere initialization failed:', error);
    renderEmpty(block, `Error: ${error.message}`);
  }
}
