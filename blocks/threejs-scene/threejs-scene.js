import { loadScript } from '../../scripts/aem.js';

const PALETTES = {
  blue: { primary: '#0070f3', accent: '#60a5fa' },
  purple: { primary: '#7c3aed', accent: '#c084fc' },
  green: { primary: '#059669', accent: '#6ee7b7' },
  sunset: { primary: '#dc2626', accent: '#f59e0b' },
};

const LIGHTING = {
  warm: (THREE, scene) => {
    scene.add(new THREE.AmbientLight(0xfff2e1, 0.7));
    const key = new THREE.DirectionalLight(0xffc58a, 1.2);
    key.position.set(3, 4, 2);
    scene.add(key);
  },
  cool: (THREE, scene) => {
    scene.add(new THREE.AmbientLight(0xe6f0ff, 0.6));
    const key = new THREE.DirectionalLight(0x9ad0ff, 1.1);
    key.position.set(-3, 3, 2);
    scene.add(key);
  },
  dramatic: (THREE, scene) => {
    scene.add(new THREE.AmbientLight(0x111827, 0.35));
    const key = new THREE.PointLight(0xffffff, 1.6, 30);
    key.position.set(2, 4, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0xff5f6d, 0.9, 30);
    rim.position.set(-4, -2, -4);
    scene.add(rim);
  },
  neon: (THREE, scene) => {
    scene.add(new THREE.AmbientLight(0x0b1026, 0.4));
    const magenta = new THREE.PointLight(0xff3bf5, 1.4, 40);
    magenta.position.set(4, 2, 2);
    scene.add(magenta);
    const cyan = new THREE.PointLight(0x22d3ee, 1.1, 40);
    cyan.position.set(-4, -2, 2);
    scene.add(cyan);
  },
};

function normalize(value, fallback) {
  const cleaned = (value || '').toLowerCase().trim();
  return cleaned || fallback;
}

function normalizeHeight(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}px`;
  }
  return trimmed;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const readRowValue = (row) => {
    if (!row) return '';
    const cells = [...row.children];
    if (cells.length > 1) {
      return cells[1].textContent.trim();
    }
    return row.textContent.trim();
  };
  const config = {
    scene: readRowValue(rows[0]),
    colors: readRowValue(rows[1]),
    lighting: readRowValue(rows[2]),
    height: readRowValue(rows[3]),
  };
  rows.forEach((row) => row.remove());

  const sceneKey = normalize(config.scene, 'crystal');
  const paletteKey = normalize(config.colors, 'blue');
  const lightingKey = normalize(config.lighting, 'warm');
  const heightValue = normalizeHeight(config.height);

  if (heightValue) {
    block.style.height = heightValue;
    block.style.minHeight = heightValue;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'tjs-canvas';
  block.append(canvas);

  await loadScript('https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js');
  const { THREE } = window;
  if (!THREE) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const palette = PALETTES[paletteKey] || PALETTES.blue;
  const primary = new THREE.Color(palette.primary);
  const accent = new THREE.Color(palette.accent);

  const material = new THREE.MeshStandardMaterial({
    color: primary,
    metalness: 0.65,
    roughness: 0.15,
    emissive: accent,
    emissiveIntensity: 0.45,
  });

  const group = new THREE.Group();
  scene.add(group);

  // Floating ambient particles
  const particleCount = 260;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 10;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.045, color: accent, transparent: true, opacity: 0.55,
  });
  scene.add(new THREE.Points(particleGeo, particleMat));

  const cubes = [];
  if (sceneKey === 'nebula') {
    // Sphere + inner glow sphere + orbit ring
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 64, 32), material);
    group.add(mesh);
    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 32, 16),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.12 }),
    );
    group.add(innerGlow);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.04, 8, 80),
      new THREE.MeshBasicMaterial({ color: primary, transparent: true, opacity: 0.35 }),
    );
    ring.rotation.x = Math.PI / 3;
    group.add(ring);
  } else if (sceneKey === 'torus') {
    const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.38, 200, 18), material);
    group.add(mesh);
    // Wireframe overlay
    const wireMesh = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.01, 0.39, 80, 10),
      new THREE.MeshBasicMaterial({
        color: accent, wireframe: true, transparent: true, opacity: 0.18,
      }),
    );
    group.add(wireMesh);
  } else if (sceneKey === 'cubes') {
    const geometry = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    for (let i = 0; i < 12; i += 1) {
      const mesh = new THREE.Mesh(geometry, material.clone());
      group.add(mesh);
      cubes.push(mesh);
    }
  } else {
    // crystal: solid icosahedron + wireframe halo
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), material);
    group.add(mesh);
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.55, 0),
      new THREE.MeshBasicMaterial({
        color: accent, wireframe: true, transparent: true, opacity: 0.28,
      }),
    );
    group.add(wire);
  }

  (LIGHTING[lightingKey] || LIGHTING.dramatic)(THREE, scene);

  const resize = () => {
    const rect = block.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(block);
  resize();

  let running = false;
  let frame = 0;

  const animate = () => {
    if (!running) return;
    frame = window.requestAnimationFrame(animate);
    const time = performance.now() * 0.0006;

    group.rotation.y += 0.006;
    group.rotation.x = Math.sin(time * 0.4) * 0.18;

    // Slowly drift particles for a living-space feel
    particleGeo.getAttribute('position').array.forEach((_, i) => {
      if (i % 3 === 1) { // y-axis only
        particleGeo.getAttribute('position').array[i] += Math.sin(time + i) * 0.0004;
      }
    });
    particleGeo.getAttribute('position').needsUpdate = true;

    if (cubes.length) {
      const radius = 2.4;
      cubes.forEach((cube, index) => {
        const angle = time * 0.8 + (index * Math.PI * 2) / cubes.length;
        const yWave = Math.sin(time * 1.2 + index * 0.7) * 0.8;
        cube.position.set(
          Math.cos(angle) * radius,
          yWave,
          Math.sin(angle) * radius,
        );
        cube.rotation.x += 0.012;
        cube.rotation.y += 0.014;
      });
    }

    renderer.render(scene, camera);
  };

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !running) {
        running = true;
        animate();
      } else if (!visible && running) {
        running = false;
        window.cancelAnimationFrame(frame);
      }
    },
    { threshold: 0.1 },
  );
  intersectionObserver.observe(block);
}
