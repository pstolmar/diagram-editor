/* blocks/photo-cubes/photo-cubes.js */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';

const FACE_ORDER = ['right', 'left', 'top', 'bottom', 'front', 'back'];
const FACE_SEQUENCE = ['front', 'back', 'right', 'left', 'top', 'bottom'];

// Material index order for BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
// right, left, top, bottom, front, back
const FACE_AXIS = [
  { axis: 'x', sign: 1 }, // right
  { axis: 'x', sign: -1 }, // left
  { axis: 'y', sign: 1 }, // top
  { axis: 'y', sign: -1 }, // bottom
  { axis: 'z', sign: 1 }, // front
  { axis: 'z', sign: -1 }, // back
];

const FACE_GRID_SEQUENCE = [
  { row: 1, col: 1 }, // center
  { row: 0, col: 0 },
  { row: 2, col: 2 },
  { row: 0, col: 2 },
  { row: 2, col: 0 },
  { row: 0, col: 1 },
  { row: 2, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 2 },
];

function isAuthoringContext() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') || '').toLowerCase();
  const wcmmode = (params.get('wcmmode') || '').toLowerCase();

  return document.documentElement.classList.contains('hlx-ue')
    || window.location.pathname.endsWith('/photocube-authoring')
    || mode === 'author'
    || mode === 'edit'
    || wcmmode === 'edit'
    || params.has('edit');
}

function parseRows(block) {
  return [...block.querySelectorAll(':scope > div')];
}

function readConfig(block) {
  const config = {};
  parseRows(block).forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      const value = cells[1].textContent.trim();
      config[key] = value;
    }
  });
  return config;
}

function readImages(block) {
  const rows = parseRows(block);
  const images = [];

  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      if (['mode', 'speed', 'monochrome'].includes(key)) return;
      if (['image', 'images', 'photo', 'photos'].includes(key)) {
        cells.slice(1).forEach((cell) => {
          const img = cell.querySelector('img');
          const href = cell.querySelector('a[href]');
          const value = img?.src || href?.href || cell.textContent.trim();
          if (value) images.push(value);
        });
        return;
      }
    }

    const img = row.querySelector('img');
    if (img?.src) {
      images.push(img.src);
      return;
    }

    const href = row.querySelector('a[href]');
    if (href?.href) {
      images.push(href.href);
      return;
    }

    const text = row.textContent.trim();
    if (text) images.push(text);
  });

  return images.filter(Boolean);
}

async function fetchDemoData(base) {
  try {
    const url = new URL('photo-cubes-demo.json', base);
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

function showEmptyState(block, message) {
  block.innerHTML = `<div class="viz-empty-state">${message || 'Photo Cubes: failed to load THREE.js'}</div>`;
}

function roundToGrid(v) {
  return Math.round(v);
}

function snapCubelet(mesh) {
  mesh.position.x = roundToGrid(mesh.position.x);
  mesh.position.y = roundToGrid(mesh.position.y);
  mesh.position.z = roundToGrid(mesh.position.z);

  const snap = (r) => Math.round(r / (Math.PI / 2)) * (Math.PI / 2);
  mesh.rotation.x = snap(mesh.rotation.x);
  mesh.rotation.y = snap(mesh.rotation.y);
  mesh.rotation.z = snap(mesh.rotation.z);
}

function rotateGridPos(gp, axis, dir) {
  const { x, y, z } = gp;
  if (axis === 'x') {
    return dir === 1
      ? { x, y: -z, z: y }
      : { x, y: z, z: -y };
  }

  if (axis === 'y') {
    return dir === 1
      ? { x: z, y, z: -x }
      : { x: -z, y, z: x };
  }

  return dir === 1
    ? { x: -y, y: x, z }
    : { x: y, y: -x, z };
}

function makeColorMaterial(THREE, color) {
  return new THREE.MeshBasicMaterial({ color });
}

function makeFaceMaterials(THREE, gp) {
  return FACE_ORDER.map((_, fi) => {
    const { axis, sign } = FACE_AXIS[fi];
    const coord = gp[axis];
    const isOuter = coord === sign;
    const color = isOuter ? 0xffffff : 0x111111;
    return makeColorMaterial(THREE, color);
  });
}

const FACE_UV = {
  right: (gp) => ({ col: gp.z + 1, row: 1 - (gp.y + 1) }),
  left: (gp) => ({ col: 1 - (gp.z + 1), row: 1 - (gp.y + 1) }),
  top: (gp) => ({ col: gp.x + 1, row: 1 - (gp.z + 1) }),
  bottom: (gp) => ({ col: gp.x + 1, row: gp.z + 1 }),
  front: (gp) => ({ col: gp.x + 1, row: 1 - (gp.y + 1) }),
  back: (gp) => ({ col: 1 - (gp.x + 1), row: 1 - (gp.y + 1) }),
};

function applyTextureToMaterial(THREE, texture, col, row) {
  const tex = texture.clone();
  tex.needsUpdate = true;
  tex.repeat.set(1 / 3, 1 / 3);
  tex.offset.set(col / 3, (2 - row) / 3);
  return new THREE.MeshBasicMaterial({ map: tex });
}

function normaliseTexture(THREE, texture) {
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  if ('colorSpace' in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if ('encoding' in texture && THREE.sRGBEncoding) {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.needsUpdate = true;
  return texture;
}

function createFallbackCanvas(label = 'Image unavailable') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0c1826');
  grad.addColorStop(1, '#16253d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  return canvas;
}

function createFallbackTexture(THREE, label) {
  return normaliseTexture(THREE, new THREE.CanvasTexture(createFallbackCanvas(label)));
}

const textureCache = new Map();

async function loadTexture(THREE, url) {
  if (!url) return createFallbackTexture(THREE, 'Missing image');
  if (textureCache.has(url)) return textureCache.get(url);

  const promise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(
      url,
      (texture) => resolve(normaliseTexture(THREE, texture)),
      undefined,
      () => resolve(createFallbackTexture(THREE, 'Image failed')),
    );
  });

  textureCache.set(url, promise);
  return promise;
}

function spreadSequence(values, count) {
  if (!values.length || count <= 0) return [];
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = values[i % values.length];
  }
  return out;
}

async function loadTextures(THREE, urls) {
  return Promise.all(urls.map((url) => loadTexture(THREE, url)));
}

function buildAtlasTexture(THREE, textures) {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d');
  const cellSize = canvas.width / 3;

  FACE_GRID_SEQUENCE.forEach(({ row, col }, index) => {
    const texture = textures[index];
    const source = texture?.image;
    if (!source) return;
    try {
      ctx.drawImage(source, col * cellSize, row * cellSize, cellSize, cellSize);
    } catch {
      ctx.fillStyle = '#24324a';
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  });

  return normaliseTexture(THREE, new THREE.CanvasTexture(canvas));
}

function buildFaceTextures(urls) {
  const selected = spreadSequence(urls, 6);
  return {
    layout: 'face',
    urls: selected,
  };
}

function buildFaceGridTextures(urls) {
  const selected = spreadSequence(urls, 9);
  return {
    layout: 'face-grid',
    urls: selected,
  };
}

function buildStickerTextures(urls) {
  const selected = spreadSequence(urls, 54);
  return {
    layout: 'sticker',
    urls: selected,
  };
}

function inferLayout(imageCount) {
  if (imageCount <= 6) return 'face';
  if (imageCount <= 9) return 'face-grid';
  return 'sticker';
}

function resolveLayout(configMode, imageCount) {
  const mode = (configMode || '').toLowerCase();
  if (['face', 'single'].includes(mode)) return 'face';
  if (mode === 'face-grid') return 'face-grid';
  if (['sticker', 'many'].includes(mode)) return 'sticker';
  return inferLayout(imageCount);
}

function createNotice(block, imageCount, layout, isAuthoring) {
  if (!isAuthoring || !imageCount) return;

  const notice = document.createElement('div');
  notice.className = 'photo-cubes-notice';
  let layoutLabel = '54-slot layout';
  if (layout === 'face') {
    layoutLabel = 'single / 6-face layout';
  } else if (layout === 'face-grid') {
    layoutLabel = '9-image face-grid layout';
  }
  const baseText = `${imageCount} image${imageCount === 1 ? '' : 's'} detected. Using the ${layoutLabel}.`;
  notice.textContent = baseText;

  if (imageCount > 9 && imageCount < 54) {
    const extra = document.createElement('div');
    extra.className = 'photo-cubes-notice-note';
    extra.textContent = '10-53 images are normalized to the full 54-slot layout so duplicates stay spread across the cube.';
    notice.append(extra);
  }

  block.append(notice);
}

function getSlotKey(face, gp) {
  const { row, col } = FACE_UV[face](gp);
  return `${face}:${row}:${col}`;
}

function buildStickerKeyOrder() {
  const keys = [];
  FACE_GRID_SEQUENCE.forEach(({ row, col }) => {
    FACE_SEQUENCE.forEach((face) => {
      keys.push(`${face}:${row}:${col}`);
    });
  });
  return keys;
}

function buildStickerTextureMap(THREE, urls) {
  const orderedUrls = spreadSequence(urls, 54);
  const keyOrder = buildStickerKeyOrder();
  return loadTextures(THREE, orderedUrls).then((textures) => {
    const map = new Map();
    keyOrder.forEach((key, index) => {
      map.set(key, textures[index]);
    });
    return map;
  });
}

function rotateFace(THREE, group, cubelets, axis, layer, dir, duration) {
  return new Promise((resolve) => {
    const axisVec = new THREE.Vector3(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0,
    );
    const members = cubelets.filter((m) => m.userData.gridPos[axis] === layer);

    const pivot = new THREE.Group();
    group.add(pivot);
    members.forEach((m) => {
      pivot.attach(m);
    });

    const targetAngle = (dir * Math.PI) / 2;
    const startTime = performance.now();

    function tick(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const angle = targetAngle * eased;
      pivot.setRotationFromAxisAngle(axisVec, angle);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        pivot.setRotationFromAxisAngle(axisVec, targetAngle);
        members.forEach((m) => {
          group.attach(m);
          snapCubelet(m);
          m.userData.gridPos = rotateGridPos(m.userData.gridPos, axis, dir);
        });
        group.remove(pivot);
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

const AXES = ['x', 'y', 'z'];
const LAYERS = [-1, 0, 1];
const DIRS = [1, -1];

function randomMoves(count) {
  const moves = [];
  for (let i = 0; i < count; i += 1) {
    moves.push({
      axis: AXES[Math.floor(Math.random() * 3)],
      layer: LAYERS[Math.floor(Math.random() * 3)],
      dir: DIRS[Math.floor(Math.random() * 2)],
    });
  }
  return moves;
}

function inverseMoves(moves) {
  return [...moves].reverse().map((m) => ({ ...m, dir: -m.dir }));
}

async function runMoves(THREE, group, cubelets, moves, duration) {
  return moves.reduce(
    (promise, move) => promise.then(() => rotateFace(
      THREE,
      group,
      cubelets,
      move.axis,
      move.layer,
      move.dir,
      duration,
    )),
    Promise.resolve(),
  );
}

function setMaterialsGrayscale(cubelets, gray) {
  cubelets.forEach((m) => {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      if (mat.map) {
        mat.color.setScalar(gray ? 0.3 : 1.0);
      }
    });
  });
}

function fadeToColor(cubelets, duration) {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      cubelets.forEach((m) => {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if (mat.map) {
            const v = 0.3 + 0.7 * t;
            mat.color.setScalar(v);
          }
        });
      });
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

export default async function decorate(block) {
  const { loadScript } = await import('../../scripts/aem.js');

  try {
    await loadScript(THREE_URL);
  } catch {
    showEmptyState(block);
    return;
  }

  const { THREE } = window;
  if (!THREE) {
    showEmptyState(block);
    return;
  }

  const config = readConfig(block);
  let imageUrls = readImages(block);

  if (!imageUrls.length) {
    const demo = await fetchDemoData(import.meta.url);
    if (demo) {
      if (Array.isArray(demo.images)) imageUrls = demo.images.slice();
      else if (typeof demo.image === 'string') imageUrls = [demo.image];
    }
  }

  if (!imageUrls.length) {
    showEmptyState(block, 'Photo Cubes: no images were provided');
    return;
  }

  const imageCount = Math.min(imageUrls.length, 54);
  const layout = resolveLayout(config.mode, imageCount);
  const speed = parseFloat(config.speed) || 1.0;
  const monochrome = (config.monochrome || 'false').toLowerCase() === 'true';
  const isAuthoring = isAuthoringContext();

  let sourceUrls;
  if (layout === 'face') {
    sourceUrls = buildFaceTextures(imageUrls).urls;
  } else if (layout === 'face-grid') {
    sourceUrls = buildFaceGridTextures(imageUrls).urls;
  } else {
    sourceUrls = buildStickerTextures(imageUrls).urls;
  }

  const loadedTextures = await loadTextures(THREE, sourceUrls);
  const faceGridAtlas = layout === 'face-grid'
    ? buildAtlasTexture(THREE, loadedTextures)
    : null;
  const faceTextureByName = layout === 'face'
    ? new Map(FACE_SEQUENCE.map((face, index) => [face, loadedTextures[index]]))
    : null;

  block.textContent = '';

  const shell = document.createElement('div');
  shell.className = 'photo-cubes-shell';

  if (isAuthoring) {
    createNotice(shell, imageCount, layout, isAuthoring);
  }

  const container = document.createElement('div');
  container.className = 'photo-cubes-stage';
  shell.append(container);
  block.append(shell);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(4, 3, 5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth || 1, 520);
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
  dirLight.position.set(5, 8, 5);
  scene.add(dirLight);

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const cubelets = [];
  const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const coords = [-1, 0, 1];

  let stickerTextureMap = null;
  if (layout === 'sticker') {
    stickerTextureMap = await buildStickerTextureMap(THREE, imageUrls);
  }

  coords.forEach((x) => {
    coords.forEach((y) => {
      coords.forEach((z) => {
        const gp = { x, y, z };
        const materials = makeFaceMaterials(THREE, gp);

        FACE_ORDER.forEach((face, fi) => {
          const { axis, sign } = FACE_AXIS[fi];
          if (gp[axis] !== sign) return;

          if (layout === 'face') {
            const tex = faceTextureByName.get(face);
            const { col, row } = FACE_UV[face](gp);
            materials[fi] = applyTextureToMaterial(THREE, tex, col, row);
            return;
          }

          if (layout === 'face-grid') {
            const { col, row } = FACE_UV[face](gp);
            materials[fi] = applyTextureToMaterial(THREE, faceGridAtlas, col, row);
            return;
          }

          const key = getSlotKey(face, gp);
          const tex = stickerTextureMap.get(key);
          materials[fi] = new THREE.MeshBasicMaterial({ map: tex });
        });

        const mesh = new THREE.Mesh(geo, materials);
        mesh.position.set(x, y, z);
        mesh.userData.gridPos = { ...gp };
        cubeGroup.add(mesh);
        cubelets.push(mesh);
      });
    });
  });

  block.dataset.cubelets = '27';
  block.dataset.photoCubesImageCount = String(imageCount);
  block.dataset.photoCubesLayout = layout;
  block.dataset.uvMode = layout === 'sticker' ? 'sticker' : 'tiled';
  if (isAuthoring) block.dataset.photoCubesAuthoring = 'true';

  if (monochrome) {
    setMaterialsGrayscale(cubelets, true);
  }

  let isAnimating = false;
  let solved = false;
  let idleRotating = true;
  let scrambleMoves = [];

  function animate() {
    requestAnimationFrame(animate);
    if (idleRotating) {
      cubeGroup.rotation.y += 0.003;
    }
    renderer.render(scene, camera);
  }
  animate();

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth || 1;
    camera.aspect = w / 520;
    camera.updateProjectionMatrix();
    renderer.setSize(w, 520);
  });
  resizeObserver.observe(container);

  async function doScrambleAndSolve() {
    if (isAnimating || solved) return;
    isAnimating = true;
    idleRotating = false;

    scrambleMoves = randomMoves(12);
    const scrambleDuration = 80 * (1 / speed);
    const solveDuration = 350 * (1 / speed);

    await runMoves(THREE, cubeGroup, cubelets, scrambleMoves, scrambleDuration);
    await new Promise((r) => { setTimeout(r, 300); });

    await runMoves(THREE, cubeGroup, cubelets, inverseMoves(scrambleMoves), solveDuration);

    solved = true;
    block.dataset.rotationOk = 'true';
    idleRotating = true;

    if (monochrome) {
      await fadeToColor(cubelets, 600);
    }

    isAnimating = false;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !solved && !isAnimating) {
          observer.disconnect();
          doScrambleAndSolve();
        }
      });
    },
    { threshold: 0.3 },
  );
  observer.observe(block);
}
