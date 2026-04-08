/* =============================================================================
   m3d-image-cube — Interactive 3D image cube with unbox animation & lightbox
   Loads 6 images into PlaneGeometry faces, auto-rotates, click to unbox/lightbox
   =========================================================================== */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@r128/build/three.min.js';

/**
 * Load Three.js library from CDN
 */
async function loadThreeJS() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = THREE_URL;
    script.onload = () => {
      if (window.THREE) {
        resolve(window.THREE);
      } else {
        reject(new Error('Three.js failed to load'));
      }
    };
    script.onerror = reject;
    document.head.append(script);
  });
}

/**
 * Create a simple dark placeholder canvas (dark gray + '+' symbol)
 */
function createPlaceholder() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 512, 512);

  // Light border
  ctx.strokeStyle = '#3a3a4e';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 512, 512);

  // '+' symbol
  ctx.strokeStyle = '#6a6a7e';
  ctx.lineWidth = 8;
  const centerX = 256;
  const centerY = 256;
  const len = 80;

  ctx.beginPath();
  ctx.moveTo(centerX - len, centerY);
  ctx.lineTo(centerX + len, centerY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - len);
  ctx.lineTo(centerX, centerY + len);
  ctx.stroke();

  return canvas;
}

/**
 * Load image async and convert to texture
 */
function loadImageAsTexture(THREE, url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 512, 512);

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      resolve(texture);
    };
    img.onerror = () => {
      const placeholder = createPlaceholder();
      const texture = new THREE.CanvasTexture(placeholder);
      resolve(texture);
    };
    img.src = url;
  });
}

/**
 * Parse block rows to extract image URLs
 * Expected: rows 0-5, each with cell[2] = URL
 */
function parseImageUrls(block) {
  const rows = [...block.querySelectorAll('div')];
  const urls = [];

  rows.slice(0, 6).forEach((row) => {
    const cells = row.querySelectorAll('div, p');
    if (cells[2]) {
      const url = cells[2].textContent.trim();
      urls.push(url || '');
    } else {
      urls.push('');
    }
  });

  // Pad to 6 with empty strings
  while (urls.length < 6) {
    urls.push('');
  }

  return urls.slice(0, 6);
}

/**
 * Create cube geometry: 6 PlaneGeometry faces in a Group
 * Face order: +X=right, -X=left, +Y=top, -Y=bottom, +Z=front, -Z=back
 */
function createCube(THREE, textures) {
  const group = new THREE.Group();
  const size = 2;

  const faces = [
    // +X (right)
    {
      name: 'right',
      pos: [size / 2, 0, 0],
      rot: [0, Math.PI / 2, 0],
      texture: textures[0],
    },
    // -X (left)
    {
      name: 'left',
      pos: [-size / 2, 0, 0],
      rot: [0, -Math.PI / 2, 0],
      texture: textures[1],
    },
    // +Y (top)
    {
      name: 'top',
      pos: [0, size / 2, 0],
      rot: [Math.PI / 2, 0, 0],
      texture: textures[2],
    },
    // -Y (bottom)
    {
      name: 'bottom',
      pos: [0, -size / 2, 0],
      rot: [-Math.PI / 2, 0, 0],
      texture: textures[3],
    },
    // +Z (front)
    {
      name: 'front',
      pos: [0, 0, size / 2],
      rot: [0, 0, 0],
      texture: textures[4],
    },
    // -Z (back)
    {
      name: 'back',
      pos: [0, 0, -size / 2],
      rot: [0, Math.PI, 0],
      texture: textures[5],
    },
  ];

  const meshes = [];
  faces.forEach(({
    name,
    pos,
    rot,
    texture,
  }) => {
    const geom = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
    });
    const mesh = new THREE.Mesh(geom, mat);

    mesh.name = name;
    mesh.userData.faceIndex = faces.findIndex((f) => f.name === name);
    mesh.userData.originalPos = new THREE.Vector3(...pos);
    mesh.userData.originalRot = new THREE.Euler(...rot);
    mesh.position.set(...pos);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(...rot);

    // Store rotation axis and hinge point for unbox animation
    if (name === 'right') {
      mesh.userData.hingeAxis = new THREE.Vector3(0, 1, 0);
    } else if (name === 'left') {
      mesh.userData.hingeAxis = new THREE.Vector3(0, 1, 0);
    } else if (name === 'top') {
      mesh.userData.hingeAxis = new THREE.Vector3(1, 0, 0);
    } else if (name === 'bottom') {
      mesh.userData.hingeAxis = new THREE.Vector3(1, 0, 0);
    } else if (name === 'front') {
      mesh.userData.hingeAxis = new THREE.Vector3(0, 1, 0);
    } else if (name === 'back') {
      mesh.userData.hingeAxis = new THREE.Vector3(0, 1, 0);
    }

    group.add(mesh);
    meshes.push(mesh);
  });

  return { group, meshes };
}

/**
 * Render empty state
 */
function renderEmpty(block, message = 'No images provided') {
  const empty = document.createElement('div');
  empty.className = 'm3d-empty-state';
  empty.innerHTML = `
    <div class="empty-icon">🎁</div>
    <div class="empty-title">Image Cube</div>
    <div class="empty-hint">${message}</div>
  `;
  block.replaceChildren(empty);
}

/**
 * Initialize Three.js scene and cube
 */
async function initScene(block, imageUrls) {
  const THREE = await loadThreeJS();

  // Load all textures in parallel
  const texturePromises = imageUrls.map((url) => {
    if (url) {
      return loadImageAsTexture(THREE, url);
    }
    return Promise.resolve(createPlaceholder()).then(
      (canvas) => new THREE.CanvasTexture(canvas),
    );
  });
  const textures = await Promise.all(texturePromises);

  // Setup canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'm3d-cube-canvas';
  canvas.style.display = 'block';
  block.append(canvas);

  // Scene setup
  const scene = new THREE.Scene();
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || 600;
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setClearColor(0x07080d, 1);
  camera.position.z = 7;

  // Create cube
  const { group: cubeGroup, meshes } = createCube(THREE, textures);
  scene.add(cubeGroup);

  // Lighting
  const light = new THREE.PointLight(0xffffff, 1, 100);
  light.position.set(3, 3, 5);
  scene.add(light);
  const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambLight);

  // State
  const state = {
    isRotating: true,
    isUnboxed: false,
    lightboxActive: false,
    rotationVelX: 0,
    rotationVelY: 0,
    unboxProgress: 0,
    lightboxProgress: 0,
  };

  // Raycaster for click detection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  /**
   * Handle rotation pause/resume on hover
   */
  canvas.addEventListener('mouseover', () => {
    state.isRotating = false;
  });

  canvas.addEventListener('mouseleave', () => {
    state.isRotating = true;
    state.rotationVelX = 0.003;
    state.rotationVelY = 0.005;
  });

  /**
   * Handle click to detect face and trigger unbox/lightbox
   */
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / w) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / h) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cubeGroup.children, true);
    if (intersects.length > 0) {
      const face = intersects[0].object;
      if (face.name === 'front' && !state.isUnboxed) {
        state.isUnboxed = true;
        state.unboxProgress = 0;
      } else if (state.isUnboxed && state.lightboxActive) {
        state.lightboxActive = false;
        state.lightboxProgress = 1;
      }
    }
  });

  /**
   * Animation loop
   */
  function animate() {
    requestAnimationFrame(animate);

    // Auto-rotate
    if (state.isRotating && !state.isUnboxed) {
      cubeGroup.rotation.x += state.rotationVelX;
      cubeGroup.rotation.y += state.rotationVelY;
    } else if (!state.isRotating) {
      state.rotationVelX *= 0.96; // Smooth deceleration
      state.rotationVelY *= 0.96;
      cubeGroup.rotation.x += state.rotationVelX;
      cubeGroup.rotation.y += state.rotationVelY;
    }

    // Unbox animation (~1.2s = 1200ms)
    if (state.isUnboxed && state.unboxProgress < 1) {
      state.unboxProgress = Math.min(state.unboxProgress + 1 / 72, 1); // ~1.2s at 60fps
      const t = state.unboxProgress;

      // Rotate each face 90° outward on hinge
      meshes.forEach((mesh) => {
        const axis = mesh.userData.hingeAxis;
        const outwardRot = (Math.PI / 2) * t;

        // Reset to original rotation then apply outward rotation
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(
          mesh.userData.originalRot.x,
          mesh.userData.originalRot.y,
          mesh.userData.originalRot.z,
        );

        // Apply hinge rotation
        if (mesh.name === 'right') {
          mesh.rotateOnWorldAxis(axis, outwardRot);
        } else if (mesh.name === 'left') {
          mesh.rotateOnWorldAxis(axis, -outwardRot);
        } else if (mesh.name === 'top') {
          mesh.rotateOnWorldAxis(axis, outwardRot);
        } else if (mesh.name === 'bottom') {
          mesh.rotateOnWorldAxis(axis, -outwardRot);
        } else if (mesh.name === 'front') {
          mesh.rotateOnWorldAxis(axis, 0);
        } else if (mesh.name === 'back') {
          mesh.rotateOnWorldAxis(axis, outwardRot);
        }
      });

      // Camera zoom: 7 → 3
      camera.position.z = 7 - (7 - 3) * t;
      camera.updateProjectionMatrix();

      // Trigger lightbox at end
      if (state.unboxProgress >= 1) {
        state.lightboxActive = true;
      }
    }

    // Lightbox animation
    if (state.lightboxActive && state.lightboxProgress < 1) {
      state.lightboxProgress = Math.min(state.lightboxProgress + 1 / 30, 1);
    } else if (!state.lightboxActive && state.lightboxProgress > 0) {
      state.lightboxProgress = Math.max(state.lightboxProgress - 1 / 30, 0);

      if (state.lightboxProgress === 0 && state.isUnboxed) {
        // Reset unbox state
        state.isUnboxed = false;
        state.unboxProgress = 0;
        cubeGroup.rotation.set(0, 0, 0);
        camera.position.z = 7;
        camera.updateProjectionMatrix();
      }
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

  animate();

  // Cleanup
  return () => {
    renderer.dispose();
    textures.forEach((tex) => tex.dispose());
    meshes.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
  };
}

/**
 * Main block decoration function
 */
export default async function decorate(block) {
  try {
    // Parse image URLs from block rows 0-5, cell 2
    const imageUrls = parseImageUrls(block);

    // Check if any images provided
    if (imageUrls.every((url) => !url)) {
      renderEmpty(block, 'No images provided');
      return;
    }

    // Clear block and setup container
    block.replaceChildren();
    block.style.position = 'relative';
    block.style.minHeight = '600px';

    // Initialize Three.js scene
    await initScene(block, imageUrls);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('m3d-image-cube initialization failed:', error);
    renderEmpty(block, `Error: ${error.message}`);
  }
}
