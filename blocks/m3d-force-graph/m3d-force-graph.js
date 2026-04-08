/* m3d-force-graph — THREE.js 3D force-directed graph block */

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';

const DEMO_CSV = `Source,Target,Weight
A,B,3
A,C,2
B,D,5
C,D,1
D,E,4
E,F,2
B,F,3`;

// Node colors by degree bucket (low → high)
const DEGREE_COLORS = [0x4fc3f7, 0x29b6f6, 0x039be5, 0xf48fb1, 0xe91e63, 0xb71c1c];

function degreeColor(deg, maxDeg) {
  const idx = Math.min(
    Math.floor((deg / Math.max(maxDeg, 1)) * DEGREE_COLORS.length),
    DEGREE_COLORS.length - 1,
  );
  return DEGREE_COLORS[idx];
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',').map((h) => h.trim());
  const srcIdx = header.indexOf('Source');
  const tgtIdx = header.indexOf('Target');
  const wIdx = header.indexOf('Weight');
  const edges = [];
  lines.slice(1).forEach((line) => {
    if (!line.trim()) return;
    const cols = line.split(',').map((c) => c.trim());
    edges.push({
      source: cols[srcIdx],
      target: cols[tgtIdx],
      weight: wIdx >= 0 ? parseFloat(cols[wIdx]) || 1 : 1,
    });
  });
  return edges;
}

function buildGraph(edges) {
  const nodeMap = new Map();
  const getNode = (id) => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        degree: 0,
        // random initial position in a cube [-1,1]
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    }
    return nodeMap.get(id);
  };
  const links = edges.map((e) => {
    const src = getNode(e.source);
    const tgt = getNode(e.target);
    src.degree += 1;
    tgt.degree += 1;
    return { source: src, target: tgt, weight: e.weight };
  });
  return { nodes: [...nodeMap.values()], links };
}

function runPhysics(nodes, links, iterations = 15) {
  const REPULSION = 0.04;
  const SPRING_LEN = 0.8;
  const SPRING_K = 0.05;
  const DAMPING = 0.8;

  for (let iter = 0; iter < iterations; iter += 1) {
    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist2 = dx * dx + dy * dy + dz * dz + 0.0001;
        const force = REPULSION / dist2;
        a.vx -= dx * force;
        a.vy -= dy * force;
        a.vz -= dz * force;
        b.vx += dx * force;
        b.vy += dy * force;
        b.vz += dz * force;
      }
    }
    // Spring attraction along links
    links.forEach((link) => {
      const { source: s, target: t, weight } = link;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dz = t.z - s.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.0001;
      const desired = SPRING_LEN / (weight * 0.3 + 0.7);
      const stretch = (dist - desired) * SPRING_K;
      const nx = (dx / dist) * stretch;
      const ny = (dy / dist) * stretch;
      const nz = (dz / dist) * stretch;
      s.vx += nx; s.vy += ny; s.vz += nz;
      t.vx -= nx; t.vy -= ny; t.vz -= nz;
    });
    // Integrate & dampen
    nodes.forEach((n) => {
      n.vx *= DAMPING; n.vy *= DAMPING; n.vz *= DAMPING;
      n.x += n.vx; n.y += n.vy; n.z += n.vz;
    });
  }
}

async function loadThree() {
  if (window.THREE) return window.THREE;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = THREE_CDN;
    script.onload = () => resolve(window.THREE);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function renderEmpty(block, title) {
  const empty = document.createElement('div');
  empty.className = 'viz-empty-state';
  empty.innerHTML = `
    <div class="viz-empty-icon">📊</div>
    <div class="viz-empty-title">${title}</div>
    <div class="viz-empty-hint">No nodes or data available</div>
  `;
  block.replaceChildren(empty);
}

export default async function decorate(block) {
  // Read optional CSV from block content
  const pre = block.querySelector('pre');
  const csvText = pre ? pre.textContent.trim() : DEMO_CSV;
  block.textContent = '';

  // Container canvas
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.cursor = 'grab';
  block.style.display = 'block';
  block.style.height = block.style.height || '420px';
  block.style.overflow = 'hidden';
  block.style.background = '#0d1117';
  block.appendChild(canvas);

  const THREE = await loadThree();

  // Scene setup
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x0d1117, 1);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  camera.position.set(0, 0, 4);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  // Graph data
  const edges = parseCSV(csvText);
  const { nodes, links } = buildGraph(edges);

  // Empty state check
  if (!nodes || nodes.length === 0) {
    renderEmpty(block, 'Force Graph');
    return;
  }

  runPhysics(nodes, links, 15);

  const maxDeg = Math.max(...nodes.map((n) => n.degree));

  // Pivot group for rotation
  const pivot = new THREE.Group();
  scene.add(pivot);

  // Node meshes — alternate geometry by degree for variety
  const nodeMeshes = new Map();
  nodes.forEach((node, i) => {
    const shapes = [
      () => new THREE.SphereGeometry(0.12, 16, 12),
      () => new THREE.OctahedronGeometry(0.14),
      () => new THREE.TetrahedronGeometry(0.14),
      () => new THREE.IcosahedronGeometry(0.12),
    ];
    const geo = shapes[i % shapes.length]();
    const mat = new THREE.MeshPhongMaterial({
      color: degreeColor(node.degree, maxDeg),
      shininess: 80,
      specular: 0x888888,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(node.x, node.y, node.z);
    pivot.add(mesh);
    nodeMeshes.set(node.id, mesh);

    // Label sprite
    const label = document.createElement('canvas');
    label.width = 64; label.height = 32;
    const ctx = label.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 64, 32);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.id, 32, 16);
    const tex = new THREE.CanvasTexture(label);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.35, 0.175, 1);
    sprite.position.set(node.x, node.y + 0.22, node.z);
    pivot.add(sprite);
  });

  // Link lines
  links.forEach((link) => {
    const alpha = Math.min(0.8, 0.3 + link.weight * 0.1);
    const mat = new THREE.LineBasicMaterial({ color: 0x90caf9, transparent: true, opacity: alpha });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(link.source.x, link.source.y, link.source.z),
      new THREE.Vector3(link.target.x, link.target.y, link.target.z),
    ]);
    const line = new THREE.Line(geo, mat);
    pivot.add(line);
  });

  // Resize handling
  function resize() {
    const w = block.clientWidth;
    const h = block.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(block);

  // Drag rotation (OrbitControls-like, no import needed)
  let isDragging = false;
  let prevX = 0;
  let prevY = 0;
  let autoRotate = true;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    pivot.rotation.y += dx * 0.008;
    pivot.rotation.x += dy * 0.008;
    prevX = e.clientX;
    prevY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('mouseenter', () => { autoRotate = false; });
  canvas.addEventListener('mouseleave', () => { if (!isDragging) autoRotate = true; });

  // Touch support
  let lastTouch = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      [lastTouch] = e.touches;
      autoRotate = false;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && lastTouch) {
      const t = e.touches[0];
      const dx = t.clientX - lastTouch.clientX;
      const dy = t.clientY - lastTouch.clientY;
      pivot.rotation.y += dx * 0.008;
      pivot.rotation.x += dy * 0.008;
      lastTouch = t;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => { lastTouch = null; autoRotate = true; });

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    if (autoRotate && !isDragging) {
      pivot.rotation.y += 0.0005;
      pivot.rotation.z += 0.0005;
    }
    renderer.render(scene, camera);
  }
  animate();
}
