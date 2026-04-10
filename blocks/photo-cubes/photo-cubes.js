/* blocks/photo-cubes/photo-cubes.js */

const FACE_COLORS = {
  right: 0xb71234,
  left: 0xff5800,
  top: 0xffffff,
  bottom: 0xffd500,
  front: 0x009b48,
  back: 0x0046ad,
  interior: 0x111111,
};

// Material index order for BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
// right, left, top, bottom, front, back
const FACE_ORDER = ['right', 'left', 'top', 'bottom', 'front', 'back'];

// Axis index: 0=x, 1=y, 2=z
// face→axis/sign: right(+x), left(−x), top(+y), bottom(−y), front(+z), back(−z)
const FACE_AXIS = [
  { axis: 'x', sign: 1 }, // right
  { axis: 'x', sign: -1 }, // left
  { axis: 'y', sign: 1 }, // top
  { axis: 'y', sign: -1 }, // bottom
  { axis: 'z', sign: 1 }, // front
  { axis: 'z', sign: -1 }, // back
];

function parseBlock(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const data = {};
  rows.forEach((row) => {
    const cols = [...row.querySelectorAll(':scope > div')];
    if (cols.length >= 2) {
      const key = cols[0].textContent.trim().toLowerCase();
      const val = cols[1].textContent.trim();
      data[key] = val;
    }
  });
  return data;
}

function parseImages(block) {
  const imgs = [...block.querySelectorAll('img')].map((img) => img.src);
  const hrefs = [...block.querySelectorAll('a[href]')]
    .map((a) => a.href)
    .filter((h) => /\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(h));
  return [...new Set([...imgs, ...hrefs])];
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

function showEmptyState(block) {
  block.innerHTML = '<div class="viz-empty-state">Photo Cubes: failed to load THREE.js</div>';
}

// --- Grid position helpers ---
function roundToGrid(v) {
  return Math.round(v);
}

function snapCubelet(mesh) {
  mesh.position.x = roundToGrid(mesh.position.x);
  mesh.position.y = roundToGrid(mesh.position.y);
  mesh.position.z = roundToGrid(mesh.position.z);
  // snap rotation to nearest 90°
  const snap = (r) => Math.round(r / (Math.PI / 2)) * (Math.PI / 2);
  mesh.rotation.x = snap(mesh.rotation.x);
  mesh.rotation.y = snap(mesh.rotation.y);
  mesh.rotation.z = snap(mesh.rotation.z);
}

// Rotate gridPos according to axis rotation direction
function rotateGridPos(gp, axis, dir) {
  const { x, y, z } = gp;
  if (axis === 'x') {
    // right-hand rule around X by dir*90°
    // (x,y,z) -> dir=+1: (x, -z, y), dir=-1: (x, z, -y)
    return dir === 1
      ? { x, y: -z, z: y }
      : { x, y: z, z: -y };
  }
  if (axis === 'y') {
    // (x,y,z) -> dir=+1: (z, y, -x), dir=-1: (-z, y, x)
    return dir === 1
      ? { x: z, y, z: -x }
      : { x: -z, y, z: x };
  }
  // axis === 'z'
  // (x,y,z) -> dir=+1: (-y, x, z), dir=-1: (y, -x, z)
  return dir === 1
    ? { x: -y, y: x, z }
    : { x: y, y: -x, z };
}

// --- Texture helpers ---
function makeColorMaterial(THREE, color) {
  return new THREE.MeshBasicMaterial({ color });
}

function makeFaceMaterials(THREE, gp) {
  // For each of 6 faces, decide if outer or interior
  return FACE_ORDER.map((face, fi) => {
    const { axis, sign } = FACE_AXIS[fi];
    const coord = gp[axis];
    const isOuter = coord === sign;
    const color = isOuter ? FACE_COLORS[face] : FACE_COLORS.interior;
    return makeColorMaterial(THREE, color);
  });
}

// row/col within the 3×3 face grid for a given face
// Convention: face normal points outward. We need consistent row/col.
// For each face, define which two axes map to col and row:
// right (+x): col=z from -1..1, row=y from 1..-1 (top=row0)
// left  (-x): col=z from 1..-1, row=y from 1..-1
// top   (+y): col=x from -1..1, row=z from 1..-1
// bottom(-y): col=x from -1..1, row=z from -1..1
// front (+z): col=x from -1..1, row=y from 1..-1
// back  (-z): col=x from 1..-1, row=y from 1..-1
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

// --- Rotation animation ---
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

// --- Scramble / solve ---
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

// eslint-disable-next-line no-restricted-syntax
async function runMoves(THREE, group, cubelets, moves, duration) {
  // Sequential rotation — must await each move in order
  // eslint-disable-next-line no-restricted-syntax
  for (const move of moves) {
    // eslint-disable-next-line no-await-in-loop
    await rotateFace(THREE, group, cubelets, move.axis, move.layer, move.dir, duration);
  }
}

// --- Grayscale / color fade ---
function setMaterialsGrayscale(cubelets, gray) {
  cubelets.forEach((m) => {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      if (mat.map) {
        // Use canvas filter trick: adjust saturation via color multiplier
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

// --- Main decorate ---
export default async function decorate(block) {
  // 1. Load THREE
  const { loadScript } = await import('../../scripts/aem.js');
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
  } catch {
    showEmptyState(block);
    return;
  }

  const { THREE } = window;
  if (!THREE) {
    showEmptyState(block);
    return;
  }

  // 2. Parse block
  const tableData = parseBlock(block);
  let imageUrls = parseImages(block);

  const mode = (tableData.mode || 'single').toLowerCase();
  const speed = parseFloat(tableData.speed) || 1.0;
  const monochrome = (tableData.monochrome || 'false').toLowerCase() === 'true';

  if (imageUrls.length === 0) {
    const demo = await fetchDemoData(import.meta.url);
    if (demo) {
      if (Array.isArray(demo.images)) imageUrls = demo.images;
      else if (typeof demo.image === 'string') imageUrls = [demo.image];
    }
  }

  // 3. Build canvas container
  block.innerHTML = '';
  const container = document.createElement('div');
  container.style.cssText = 'width:100%;height:520px;position:relative;overflow:hidden;';
  block.appendChild(container);

  // 4. THREE setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / 520, 0.1, 100);
  camera.position.set(4, 3, 5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, 520);
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(5, 8, 5);
  scene.add(dirLight);

  // Cube group
  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  // 5 & 6. Build 27 cubelets
  const cubelets = [];
  const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);

  // We'll assign textures after loading
  const coords = [-1, 0, 1];

  // Determine sticker assignments for SINGLE or MANY mode
  // Build a map: { face, cubeletIndex } → texture + UV info
  // face order: right, left, top, bottom, front, back
  // For single mode: one texture per big face, tiled 3×3
  // For many mode: up to 54 images cycling

  // Load textures
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  function loadTex(url) {
    return new Promise((res) => {
      if (!url) { res(null); return; }
      loader.load(url, res, undefined, () => res(null));
    });
  }

  // Build cubelet list in order
  let stickerIndex = 0; // for MANY mode

  // For MANY mode: assign images round-robin per sticker slot (6 faces × 9 = 54 slots)
  // Order: iterate faces, then cubelets on that face
  // Interleave: cycle through imageUrls

  // We'll pre-load textures:
  // Single mode: one texture per face (or one texture for all, repeated)
  // Many mode: up to 54 textures

  let textures = [];

  if (mode === 'single') {
    // Use first image for all faces, or one per face if 6 images provided
    const count = Math.min(imageUrls.length, 6);
    const toLoad = count > 0 ? imageUrls.slice(0, count) : [];
    textures = await Promise.all(toLoad.map(loadTex));
  } else {
    // MANY mode: up to 54
    const toLoad = imageUrls.slice(0, 54);
    textures = await Promise.all(toLoad.map(loadTex));
  }

  // Build cubelets — nested loops are unavoidable for 3D grid construction
  /* eslint-disable no-restricted-syntax */
  for (const x of coords) {
    for (const y of coords) {
      for (const z of coords) {
        const gp = { x, y, z };
        const materials = makeFaceMaterials(THREE, gp);

        if (mode === 'single' && textures.length > 0) {
          // Apply texture per face
          FACE_ORDER.forEach((face, fi) => {
            const { axis, sign } = FACE_AXIS[fi];
            if (gp[axis] !== sign) return; // interior face
            // Which big-face texture?
            const texIdx = textures.length === 1 ? 0 : fi % textures.length;
            const tex = textures[texIdx];
            if (!tex) return;
            const uvFn = FACE_UV[face];
            const { col, row } = uvFn(gp);
            materials[fi] = applyTextureToMaterial(THREE, tex, col, row);
          });
        } else if (mode === 'many' && textures.length > 0) {
          // eslint-disable-next-line no-loop-func
          FACE_ORDER.forEach((face, fi) => {
            const { axis, sign } = FACE_AXIS[fi];
            if (gp[axis] !== sign) return;
            const idx = stickerIndex;
            stickerIndex += 1;
            const tex = textures[idx % textures.length];
            if (!tex) return;
            const uvFn = FACE_UV[face];
            const { col, row } = uvFn(gp);
            materials[fi] = applyTextureToMaterial(THREE, tex, col, row);
          });
        }

        const mesh = new THREE.Mesh(geo, materials);
        mesh.position.set(x, y, z);
        mesh.userData.gridPos = { ...gp };
        cubeGroup.add(mesh);
        cubelets.push(mesh);
      }
    }
  }
  /* eslint-enable no-restricted-syntax */

  // Mark UV mode as tiled after texture assignment
  block.dataset.uvMode = 'tiled';

  // 7. Monochrome initial state
  if (monochrome) {
    setMaterialsGrayscale(cubelets, true);
  }

  // 8 & 9. Animation state
  let isAnimating = false;
  let solved = false;
  let idleRotating = true;
  let scrambleMoves = [];

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    if (idleRotating) {
      cubeGroup.rotation.y += 0.003;
    }
    renderer.render(scene, camera);
  }
  animate();

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    camera.aspect = w / 520;
    camera.updateProjectionMatrix();
    renderer.setSize(w, 520);
  });
  resizeObserver.observe(container);

  // Scramble + solve sequence
  async function doScrambleAndSolve() {
    if (isAnimating || solved) return;
    isAnimating = true;
    idleRotating = false;

    scrambleMoves = randomMoves(12);
    const scrambleDuration = 80 * (1 / speed);
    const solveDuration = 350 * (1 / speed);

    await runMoves(THREE, cubeGroup, cubelets, scrambleMoves, scrambleDuration);

    // Pause 300ms
    await new Promise((r) => { setTimeout(r, 300); });

    const solveSeq = inverseMoves(scrambleMoves);
    await runMoves(THREE, cubeGroup, cubelets, solveSeq, solveDuration);

    // Solve complete
    solved = true;
    block.dataset.rotationOk = 'true';
    idleRotating = true;

    if (monochrome) {
      await fadeToColor(cubelets, 600);
    }

    isAnimating = false;
  }

  // 9. IntersectionObserver trigger
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

  // Attach data attribute
  block.dataset.cubelets = '27';
}
