import { loadScript } from '../../scripts/aem.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js';
const GLOBE_RADIUS = 2;
const TILT_RAD = 20 * (Math.PI / 180);
const AUTO_ROT_SPEED = 0.004; // ~0.23°/frame

const PALETTES = {
  blue: {
    pinLow: 0x3b82f6,
    pinHigh: 0x60efff,
    ambient: 0x0d2040,
    key: 0x4488ff,
  },
  green: {
    pinLow: 0x22c55e,
    pinHigh: 0xa3ffb0,
    ambient: 0x0a2010,
    key: 0x30d158,
  },
  amber: {
    pinLow: 0xf59e0b,
    pinHigh: 0xfde68a,
    ambient: 0x201500,
    key: 0xf0a020,
  },
  purple: {
    pinLow: 0xa855f7,
    pinHigh: 0xe4b8ff,
    ambient: 0x120a28,
    key: 0xb070f8,
  },
};

// --- Terrain texture (procedural, canvas-based) ---

function hash2(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function smooth(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return (
    hash2(ix, iy) * (1 - u) * (1 - v)
    + hash2(ix + 1, iy) * u * (1 - v)
    + hash2(ix, iy + 1) * (1 - u) * v
    + hash2(ix + 1, iy + 1) * u * v
  );
}

function fbm(x, y) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 5; i += 1) {
    val += smooth(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / 0.96875; // approximate normalization
}

function createTerrainTexture(THREE) {
  const W = 1024;
  const H = 512;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let py = 0; py < H; py += 1) {
    const lat = 90 - (py / H) * 180;
    const absLat = Math.abs(lat);

    for (let px = 0; px < W; px += 1) {
      const lon = (px / W) * 360 - 180;
      const nx = lon / 60 + 3.7;
      const ny = lat / 40 + 1.2;
      const n = fbm(nx, ny);

      let r;
      let g;
      let b;

      if (absLat > 75) {
        // Polar ice
        const t = Math.min(1, (absLat - 75) / 12);
        r = Math.round(195 + t * 50);
        g = Math.round(210 + t * 40);
        b = Math.round(230 + t * 25);
      } else if (absLat > 62 && n > 0.46) {
        // Sub-polar tundra
        r = 140 + Math.round(n * 30);
        g = 145 + Math.round(n * 25);
        b = 130;
      } else {
        const isLand = n > 0.52;
        if (isLand) {
          if (absLat > 50) {
            // Boreal / temperate
            r = 85 + Math.round(n * 25);
            g = 115 + Math.round(n * 30);
            b = 75;
          } else if (absLat > 30) {
            // Plains + mountains
            if (n > 0.70) {
              r = 125; g = 128; b = 118; // mountain gray
            } else {
              r = 55 + Math.round(n * 35);
              g = 145 + Math.round(n * 25);
              b = 55;
            }
          } else if (absLat > 10) {
            // Tropical plains
            r = 40 + Math.round(n * 30);
            g = 155 + Math.round(n * 25);
            b = 50;
          } else {
            // Equatorial jungle
            r = 30 + Math.round(n * 30);
            g = 148 + Math.round(n * 20);
            b = 42;
          }
        } else {
          // Ocean — deeper/darker toward poles
          const latN = absLat / 90;
          const depth = 0.55 + n * 0.45;
          r = Math.round((8 + (1 - latN) * 18) * depth);
          g = Math.round((25 + (1 - latN) * 65) * depth);
          b = Math.round((95 + (1 - latN) * 85) * depth);
        }
      }

      const idx = (py * W + px) * 4;
      d[idx] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cvs);
  tex.needsUpdate = true;
  return tex;
}

// --- Ocean animated shader layer ---

const OCEAN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const OCEAN_FRAG = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    float w1 = sin(vUv.x * 22.0 + time * 1.6) * 0.5 + 0.5;
    float w2 = sin(vUv.y * 16.0 + time * 1.1 + 1.3) * 0.5 + 0.5;
    float w3 = sin((vUv.x + vUv.y) * 11.0 - time * 2.1) * 0.5 + 0.5;
    float wave = w1 * w2 * w3;
    float alpha = wave * 0.10;
    gl_FragColor = vec4(0.08, 0.38, 0.82, alpha);
  }
`;

function createOceanMesh(THREE) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const geo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.006, 64, 48);
  return new THREE.Mesh(geo, mat);
}

// --- Data helpers ---

function parseRows(block) {
  const rows = [...block.children];
  const readCell = (row, idx = 1) => {
    const cells = [...row.children];
    if (cells.length > idx) return cells[idx].textContent.trim();
    return cells[0]?.textContent.trim() || '';
  };

  let dataText = '';
  const dataRow = rows[0];
  if (dataRow) {
    const dataCell = dataRow.children.length > 1 ? dataRow.children[1] : dataRow.children[0];
    if (dataCell) {
      dataText = [...dataCell.querySelectorAll('p')]
        .map((p) => p.textContent.trim())
        .filter(Boolean)
        .join('\n');
      if (!dataText) dataText = dataCell.textContent.trim();
    }
  }

  const color = rows[1] ? readCell(rows[1]) : '';
  const height = rows[2] ? readCell(rows[2]) : '';

  return { dataText, color, height };
}

function parseMarkers(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const parts = l.split(',').map((p) => p.trim());
      if (parts.length < 4) return null;
      const [label, lat, lon, value] = parts;
      const latN = Number(lat);
      const lonN = Number(lon);
      const valN = Number(value);
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null;
      return {
        label, lat: latN, lon: lonN, value: Number.isFinite(valN) ? valN : 0,
      };
    })
    .filter(Boolean);
}

function normalizeValues(markers) {
  if (!markers.length) return markers;
  const vals = markers.map((m) => m.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  return markers.map((m) => ({ ...m, norm: (m.value - min) / range }));
}

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

let threeReady = null;
function ensureThree() {
  if (!threeReady) threeReady = loadScript(THREE_URL);
  return threeReady;
}

// --- Main decorate ---

export default async function decorate(block) {
  const { dataText, color, height } = parseRows(block);

  while (block.firstChild) block.removeChild(block.firstChild);

  // Height
  const canvasHeight = Math.max(200, parseInt(height, 10) || 420);
  block.style.setProperty('--globe-height', `${canvasHeight}px`);

  const canvas = document.createElement('canvas');
  canvas.className = 'm3d-globe-canvas';
  canvas.style.height = `${canvasHeight}px`;

  const tooltip = document.createElement('div');
  tooltip.className = 'm3d-globe-tooltip';
  tooltip.style.display = 'none';

  const detail = document.createElement('div');
  detail.className = 'm3d-globe-detail-panel';
  detail.style.display = 'none';

  block.append(canvas, tooltip, detail);

  try {
    await ensureThree();
    const { THREE } = window;
    if (!THREE) throw new Error('Three.js failed to load');

    const paletteKey = (color || 'blue').toLowerCase().trim();
    const palette = PALETTES[paletteKey] || PALETTES.blue;

    const markers = normalizeValues(parseMarkers(dataText));

    // Scene
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    // Lighting
    const ambientLight = new THREE.AmbientLight(palette.ambient, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(palette.key, 1.5);
    keyLight.position.set(4, 3, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-3, -2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x88aaff, 0.4);
    rimLight.position.set(0, 0, -5);
    scene.add(rimLight);

    // Tilt group (20° axial tilt) wraps the rotatable globe group
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = TILT_RAD;
    scene.add(tiltGroup);

    const globeGroup = new THREE.Group();
    tiltGroup.add(globeGroup);

    // Globe sphere with terrain texture
    const terrainTex = createTerrainTexture(THREE);
    const globeGeo = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 32);
    const globeMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      metalness: 0.08,
      roughness: 0.78,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    globeGroup.add(globe);

    // Atmosphere glow (subtle outer sphere)
    const atmosphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.08, 32, 24);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    globeGroup.add(new THREE.Mesh(atmosphereGeo, atmosphereMat));

    // Ocean animated shader overlay
    const oceanMesh = createOceanMesh(THREE);
    globeGroup.add(oceanMesh);

    // Wireframe overlay
    const wireGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.015, 36, 24);
    const wireFrameGeo = new THREE.WireframeGeometry(wireGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x335588,
      transparent: true,
      opacity: 0.18,
    });
    globeGroup.add(new THREE.LineSegments(wireFrameGeo, wireMat));

    // Markers
    const pinObjects = [];

    markers.forEach((m) => {
      const { norm } = m;
      // Scale 1–8 mapped to radius range
      const scale = 1 + norm * 7;
      const pinRadius = 0.025 * scale;
      const pinColor = new THREE.Color(palette.pinLow).lerp(
        new THREE.Color(palette.pinHigh),
        norm,
      );

      const pos = latLonToVec3(m.lat, m.lon, GLOBE_RADIUS + pinRadius);

      // Halo
      const haloGeo = new THREE.SphereGeometry(pinRadius * 2.4, 8, 6);
      const haloMat = new THREE.MeshBasicMaterial({
        color: pinColor,
        transparent: true,
        opacity: 0.20 + norm * 0.22,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(pos.x, pos.y, pos.z);
      globeGroup.add(halo);

      // Pin core (tetrahedron for visual interest)
      const pinGeo = new THREE.TetrahedronGeometry(pinRadius, 0);
      const pinMat = new THREE.MeshStandardMaterial({
        color: pinColor,
        emissive: pinColor,
        emissiveIntensity: 0.65 + norm * 0.55,
        metalness: 0.15,
        roughness: 0.25,
      });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(pos.x, pos.y, pos.z);
      // Orient tetrahedron outward from globe center
      pin.lookAt(0, 0, 0);
      globeGroup.add(pin);

      pinObjects.push({
        mesh: pin, halo, marker: m, originalColor: pinColor.clone(),
      });
    });

    // Resize
    const resize = () => {
      const rect = block.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, canvasHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(block);
    resize();

    // Interaction state
    let autoRotating = true;
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let dragRotX = 0;
    let dragRotY = 0;
    let autoRotY = 0;
    let hoveredPin = null;

    // Stop auto-rotation on mouse enter, resume on leave
    block.addEventListener('mouseenter', () => { autoRotating = false; });
    block.addEventListener('mouseleave', () => {
      if (!isDragging) autoRotating = true;
    });

    // Drag
    canvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };
      dragRotY += dx * 0.008;
      dragRotX += dy * 0.008;
      dragRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, dragRotX));
    });

    canvas.addEventListener('pointerup', () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.style.cursor = 'grab';

    // Zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.01;
      camera.position.z = Math.max(3.5, Math.min(12, camera.position.z));
    }, { passive: false });

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getMouseNDC = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const showTooltip = (e, marker) => {
      const rect = block.getBoundingClientRect();
      tooltip.innerHTML = `<strong>${marker.label}</strong>${marker.value}`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX - rect.left + 14}px`;
      tooltip.style.top = `${e.clientY - rect.top - 10}px`;
    };

    const hideTooltip = () => { tooltip.style.display = 'none'; };

    const showDetail = (marker) => {
      detail.innerHTML = `
        <h3>${marker.label}</h3>
        <p><strong>Value:</strong> ${marker.value}</p>
        <p><strong>Lat / Lon:</strong> ${marker.lat.toFixed(2)}°, ${marker.lon.toFixed(2)}°</p>
        <button class="m3d-globe-detail-close" aria-label="Close">✕</button>
      `;
      detail.style.display = 'block';
      detail.querySelector('.m3d-globe-detail-close').addEventListener('click', () => {
        detail.style.display = 'none';
      });
    };

    // Hover: tooltip + highlight
    canvas.addEventListener('mousemove', (e) => {
      getMouseNDC(e);
      raycaster.setFromCamera(mouse, camera);
      const pinMeshes = pinObjects.map((p) => p.mesh);
      const hits = raycaster.intersectObjects(pinMeshes);

      if (hoveredPin) {
        hoveredPin.mesh.material.emissiveIntensity = 0.65 + hoveredPin.marker.norm * 0.55;
        hoveredPin.halo.material.opacity = 0.20 + hoveredPin.marker.norm * 0.22;
        hoveredPin = null;
        hideTooltip();
      }

      if (hits.length) {
        const found = pinObjects.find((p) => p.mesh === hits[0].object);
        if (found) {
          found.mesh.material.emissiveIntensity = 1.5;
          found.halo.material.opacity = 0.6;
          hoveredPin = found;
          showTooltip(e, found.marker);
          canvas.style.cursor = isDragging ? 'grabbing' : 'pointer';
          return;
        }
      }

      canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    });

    // Click: detail panel
    canvas.addEventListener('click', (e) => {
      getMouseNDC(e);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(pinObjects.map((p) => p.mesh));
      if (hits.length) {
        const found = pinObjects.find((p) => p.mesh === hits[0].object);
        if (found) { showDetail(found.marker); return; }
      }
      detail.style.display = 'none';
    });

    // Animation loop
    let running = false;
    let frame = 0;
    let elapsed = 0;

    const animate = () => {
      if (!running) return;
      frame = requestAnimationFrame(animate);
      elapsed += 0.016;

      if (autoRotating && !isDragging) autoRotY += AUTO_ROT_SPEED;

      globeGroup.rotation.y = autoRotY + dragRotY;
      globeGroup.rotation.x = dragRotX;

      // Update ocean shader time uniform
      oceanMesh.material.uniforms.time.value = elapsed;

      renderer.render(scene, camera);
    };

    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((en) => en.isIntersecting);
      if (visible && !running) { running = true; animate(); } else if (!visible && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    }, { threshold: 0.1 });
    io.observe(block);

    block.dispatchEvent(new CustomEvent('diagram:render', { bubbles: true }));
  } catch (err) {
    block.dispatchEvent(new CustomEvent('diagram:error', { bubbles: true, detail: { error: err.message } }));
  }
}
