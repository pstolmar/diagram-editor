/* blocks/orbit-ring/orbit-ring.js */
import { loadScript } from '../../scripts/aem.js';

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

/* ── helpers ─────────────────────────────────────────────────────────────── */

function showEmpty(block) {
  block.innerHTML = '<div class="viz-empty-state">No images to display.</div>';
}

async function resolveImages(block) {
  const urls = [];
  block.querySelectorAll('tr').forEach((row) => {
    const cell = row.querySelector('td');
    if (!cell) return;
    const a = cell.querySelector('a');
    const src = a ? a.href : cell.textContent.trim();
    if (src) urls.push(src);
  });
  if (urls.length) return urls;

  try {
    const resp = await fetch(new URL('orbit-ring-demo.json', import.meta.url));
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.images) ? data.images : [];
  } catch {
    return [];
  }
}

/* ── main ────────────────────────────────────────────────────────────────── */

export default async function decorate(block) {
  /* 1. load Three.js */
  let THREE;
  try {
    THREE = await import(/* webpackIgnore: true */ THREE_CDN);
  } catch {
    try {
      await loadScript(THREE_CDN, { type: 'module' });
      THREE = window.THREE;
    } catch {
      showEmpty(block);
      return;
    }
  }
  if (!THREE || !THREE.Scene) {
    showEmpty(block);
    return;
  }

  /* 2. images */
  const images = await resolveImages(block);
  if (!images.length) {
    showEmpty(block);
    return;
  }

  /* 3. canvas / renderer */
  block.innerHTML = '';
  const canvas = document.createElement('canvas');
  block.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 1);

  function resize() {
    const w = block.clientWidth || 800;
    const h = 500;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = `${h}px`;
    /* eslint-disable no-use-before-define */
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    /* eslint-enable no-use-before-define */
  }

  /* 9. camera */
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 1.5, 7);
  camera.lookAt(0, 0, 0);

  resize();
  window.addEventListener('resize', resize);

  /* scene */
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  /* 4 + 5. build meshes on torus ring */
  const N = images.length;
  const RADIUS = 3.5;
  const TILT = Math.PI / 12; // 15°
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  const meshes = [];

  images.forEach((url, i) => {
    const angle = (2 * Math.PI * i) / N;
    const x = RADIUS * Math.sin(angle);
    const y = 0;
    const z = RADIUS * Math.cos(angle);

    const geo = new THREE.PlaneGeometry(1.6, 1.6);
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });

    const mesh = new THREE.Mesh(geo, mat);

    /* position on ring, apply 15° tilt around X */
    mesh.position.set(x, y, z);
    group.add(mesh);

    /* store orbit position for reset */
    mesh.userData = {
      orbitAngle: angle,
      orbitPos: new THREE.Vector3(x, y, z),
      selected: false,
      lerpTarget: null,
      lerpScale: null,
      lerpStart: 0,
      lerpDuration: 0.5,
      baseOpacity: 1,
    };

    /* tilt the whole group around X once, but tilt each mesh individually so
       lookAt still works per-mesh */
    mesh.userData.tiltedY = y + RADIUS * Math.sin(TILT) * Math.sin(angle) * 0;
    // apply tilt: raise/lower y by radius * sin(tilt) * cos(angle)
    mesh.position.y = RADIUS * Math.sin(TILT) * Math.cos(angle);
    mesh.position.x = RADIUS * Math.cos(TILT) * Math.sin(angle);
    mesh.position.z = RADIUS * Math.cos(angle);
    mesh.userData.orbitPos.copy(mesh.position);

    meshes.push(mesh);

    loader.load(
      url,
      (tex) => {
        mat.map = tex;
        mat.needsUpdate = true;
      },
      undefined,
      () => { /* ignore load errors */ },
    );
  });

  /* 6 + 7. rotation state */
  let speed = 1;
  let selectedMesh = null;

  canvas.addEventListener('pointerenter', () => { speed = 0; });
  canvas.addEventListener('pointerleave', () => { if (!selectedMesh) speed = 1; });

  /* 8. click / tap */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function getCanvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function deselectAll(now) {
    meshes.forEach((m) => {
      m.userData.selected = false;
      m.userData.lerpTarget = m.userData.orbitPos.clone();
      m.userData.lerpScale = 1;
      m.userData.lerpStart = now;
      m.userData.baseOpacity = 1;
    });
    selectedMesh = null;
    speed = 0; /* canvas still hovered; pointerleave will resume */
  }

  function selectMesh(mesh, now) {
    meshes.forEach((m) => {
      if (m === mesh) {
        m.userData.selected = true;
        m.userData.lerpTarget = new THREE.Vector3(0, 0, 2.5);
        m.userData.lerpScale = 2.2;
        m.userData.lerpStart = now;
        m.userData.baseOpacity = 1;
      } else {
        m.userData.selected = false;
        m.userData.lerpTarget = m.userData.orbitPos.clone();
        m.userData.lerpScale = 1;
        m.userData.lerpStart = now;
        m.userData.baseOpacity = 0.3;
      }
    });
    selectedMesh = mesh;
  }

  function onPick(e) {
    e.preventDefault();
    getCanvasXY(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meshes);
    const now = performance.now() / 1000;

    if (!hits.length) {
      if (selectedMesh) deselectAll(now);
      return;
    }

    const hit = hits[0].object;
    if (selectedMesh === hit) {
      deselectAll(now);
    } else {
      selectMesh(hit, now);
    }
  }

  canvas.addEventListener('click', onPick);
  canvas.addEventListener('touchend', onPick, { passive: false });

  /* render loop */
  let rafId;
  function animate() {
    rafId = requestAnimationFrame(animate);
    const now = performance.now() / 1000;

    /* 6. auto-rotate */
    if (!selectedMesh) {
      group.rotation.y += 0.005 * speed;
    }

    /* lerp meshes — operate in world space by temporarily removing from group */
    meshes.forEach((m) => {
      const ud = m.userData;
      if (!ud.lerpTarget) {
        /* no active lerp: face camera */
        m.getWorldPosition(m.userData.cachedWp = m.userData.cachedWp || new THREE.Vector3());
        /* lookAt in group local space */
        const camLocal = group.worldToLocal(camera.position.clone());
        m.lookAt(camLocal);
        m.material.opacity = ud.baseOpacity;
        return;
      }

      const elapsed = now - ud.lerpStart;
      const t = Math.min(elapsed / ud.lerpDuration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut

      if (ud.selected) {
        /* move in world space: pull out of group temporarily */
        const worldPos = new THREE.Vector3();
        m.getWorldPosition(worldPos);
        worldPos.lerp(ud.lerpTarget, ease);
        /* convert back to group local */
        const localPos = group.worldToLocal(worldPos.clone());
        m.position.lerp(localPos, ease);
        m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, ud.lerpScale, ease));
      } else {
        m.position.lerp(ud.lerpTarget, ease);
        m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, ud.lerpScale, ease));
      }

      m.material.opacity = THREE.MathUtils.lerp(m.material.opacity, ud.baseOpacity, ease);

      /* face camera */
      const camLocal = group.worldToLocal(camera.position.clone());
      m.lookAt(camLocal);

      if (t >= 1) {
        m.position.copy(ud.selected ? group.worldToLocal(ud.lerpTarget.clone()) : ud.lerpTarget);
        m.scale.setScalar(ud.lerpScale);
        m.material.opacity = ud.baseOpacity;
        if (!ud.selected) ud.lerpTarget = null;
      }
    });

    renderer.render(scene, camera);
  }

  animate();

  /* cleanup on block disconnect */
  const observer = new MutationObserver(() => {
    if (!block.isConnected) {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      window.removeEventListener('resize', resize);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
