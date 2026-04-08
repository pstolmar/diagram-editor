const SEVERITY_COLORS = {
  critical: 0xff4d5e,
  high: 0xfb923c,
  medium: 0xf5c842,
  low: 0x4ade80,
};

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
 * Expected format: rows with JSON config or CSV event data
 */
function parseBlock(block) {
  const rows = [...block.querySelectorAll('div')];
  let config = {};
  let events = [];

  rows.forEach((row) => {
    const text = row.textContent.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          events = parsed;
        } else {
          config = { ...config, ...parsed };
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  return { config, events };
}

/**
 * Load data from a URL or fallback to demo data
 * Supports live API adapters (e.g., usgs-earthquake)
 */
async function loadData(url, liveApiAdapter, signal) {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Adapt live APIs (USGS earthquakes) to threat event format
    if (liveApiAdapter === 'usgs-earthquake' && data.features) {
      // Rough country center map for demo
      const countryCenters = {
        'United States': { lat: 37.77, lon: -122.42, cc: 'US' },
        Japan: { lat: 35.69, lon: 139.69, cc: 'JP' },
        Indonesia: { lat: -6.21, lon: 106.85, cc: 'ID' },
        Chile: { lat: -30.27, lon: -71.54, cc: 'CL' },
        Russia: { lat: 55.75, lon: 37.62, cc: 'RU' },
        Peru: { lat: -12.05, lon: -77.04, cc: 'PE' },
        Philippines: { lat: 14.60, lon: 120.98, cc: 'PH' },
      };

      // Adapt first 20 features
      const adapted = data.features.slice(0, 20).map((feature, i) => {
        const { geometry, properties } = feature;
        const [lon, lat, depth] = geometry.coordinates;
        const mag = properties.mag || 5;
        const place = properties.place || 'Seismic event';

        // Pick a destination country from our map
        const destCountry = Object.keys(countryCenters)[i % Object.keys(countryCenters).length];
        const dest = countryCenters[destCountry];

        let severity = 'low';
        if (mag >= 6.5) severity = 'critical';
        else if (mag >= 6.0) severity = 'high';
        else if (mag >= 5.5) severity = 'medium';

        return {
          id: properties.id,
          ts: properties.time ? new Date(properties.time).toISOString() : new Date().toISOString(),
          type: 'Seismic Event',
          severity,
          src: {
            country: place.split(',')[place.split(',').length - 1].trim(), cc: 'XX', lat, lon,
          },
          dst: {
            country: destCountry, cc: dest.cc, lat: dest.lat, lon: dest.lon,
          },
          magnitude: mag,
          depth,
        };
      });

      return {
        stats: { blockedToday: 0, activeThreats: adapted.length, countriesTargeted: 20 },
        events: adapted,
      };
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Data load timeout');
    }
    throw error;
  }
}

/**
 * Render an empty state message
 */
function renderEmpty(block, message = 'No data available') {
  const empty = document.createElement('div');
  empty.className = 'viz-empty-state';
  empty.innerHTML = `
    <div class="viz-empty-icon">📡</div>
    <div class="viz-empty-title">Data Unavailable</div>
    <div class="viz-empty-hint">${message}</div>
  `;
  block.replaceChildren(empty);
}

/**
 * Convert lat/lon to 3D point on unit sphere
 */
function latLonToPoint(THREE, lat, lon, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Calculate great-circle distance between two points (in radians on unit sphere)
 */
function greatCircleDistance(THREE, lat1, lon1, lat2, lon2) {
  const phi1 = (90 - lat1) * (Math.PI / 180);
  const phi2 = (90 - lat2) * (Math.PI / 180);
  const theta1 = (lon1 + 180) * (Math.PI / 180);
  const theta2 = (lon2 + 180) * (Math.PI / 180);

  const p1 = new THREE.Vector3(
    Math.sin(phi1) * Math.cos(theta1),
    Math.cos(phi1),
    Math.sin(phi1) * Math.sin(theta1),
  );
  const p2 = new THREE.Vector3(
    Math.sin(phi2) * Math.cos(theta2),
    Math.cos(phi2),
    Math.sin(phi2) * Math.sin(theta2),
  );

  return p1.angleTo(p2);
}

/**
 * Create and render the Three.js scene
 */
async function initScene(block, data) {
  // Load Three.js
  const THREE = await loadThreeJS();

  // Setup canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'threat-canvas';
  block.append(canvas);

  // Scene setup
  const scene = new THREE.Scene();
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || 600;
  const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setClearColor(0x07080d, 1);
  camera.position.z = 2;

  // Create dark sphere
  const sphereGeom = new THREE.IcosahedronGeometry(1, 32);
  const sphereMat = new THREE.MeshPhongMaterial({
    color: 0x07080d,
    emissive: 0x0a0b14,
    specular: 0x1a1a2e,
    shininess: 5,
  });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  scene.add(sphere);

  // Wireframe overlay
  const wireframeGeom = new THREE.IcosahedronGeometry(1.002, 32);
  const wireframeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    opacity: 0.12,
    transparent: true,
  });
  const wireframe = new THREE.Mesh(wireframeGeom, wireframeMat);
  scene.add(wireframe);

  // Atmosphere glow
  const atmosphereGeom = new THREE.IcosahedronGeometry(1.03, 32);
  const atmosphereMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    opacity: 0.06,
    transparent: true,
  });
  const atmosphere = new THREE.Mesh(atmosphereGeom, atmosphereMat);
  scene.add(atmosphere);

  // Lighting
  const light = new THREE.PointLight(0xffffff, 0.8, 100);
  light.position.set(2, 2, 2);
  scene.add(light);
  const ambLight = new THREE.AmbientLight(0x4a4a5e, 0.6);
  scene.add(ambLight);

  // Animation state
  const activeArcs = [];
  const activeDots = [];

  /**
   * Create and animate an arc for a single event
   */
  function createArcAnimation(event) {
    const src = latLonToPoint(THREE, event.src.lat, event.src.lon);
    const dst = latLonToPoint(THREE, event.dst.lat, event.dst.lon);

    // Midpoint lift based on great-circle distance
    const distance = greatCircleDistance(
      THREE,
      event.src.lat,
      event.src.lon,
      event.dst.lat,
      event.dst.lon,
    );
    const liftHeight = 0.6 + (distance / Math.PI) * (1.4 - 0.6);

    // Create Bezier curve arc
    const midpoint = new THREE.Vector3()
      .addVectors(src, dst)
      .normalize()
      .multiplyScalar(1 + liftHeight * 0.3);

    const curve = new THREE.QuadraticBezierCurve3(src, midpoint, dst);
    const points = curve.getPoints(30);

    const arcGeom = new THREE.BufferGeometry().setFromPoints(points);
    const arcMat = new THREE.LineBasicMaterial({
      color: SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low,
      linewidth: 1,
      opacity: 0.8,
      transparent: true,
    });
    const arc = new THREE.Line(arcGeom, arcMat);
    scene.add(arc);

    // Animate dot travel along arc
    const dotGeom = new THREE.SphereGeometry(0.02, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({
      color: SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low,
    });
    const dot = new THREE.Mesh(dotGeom, dotMat);
    scene.add(dot);

    const startTime = Date.now();
    const arcFadeStart = startTime + 1500; // Start fade after dot travel completes
    const arcFadeEnd = arcFadeStart + 3000; // 3s fade duration

    activeArcs.push({
      arc,
      arcMat,
      startTime: arcFadeStart,
      endTime: arcFadeEnd,
      createdAt: startTime,
    });

    activeDots.push({
      dot,
      points,
      startTime,
      duration: 1500,
      createdAt: startTime,
    });
  }

  // Create initial animations for 20 most recent events
  const recentEvents = (data.events || []).slice(0, 20);
  recentEvents.forEach((event, idx) => {
    setTimeout(() => createArcAnimation(event), idx * 100);
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    const now = Date.now();

    // Update dots
    activeDots.forEach((item, idx) => {
      const elapsed = now - item.startTime;
      if (elapsed >= item.duration) {
        scene.remove(item.dot);
        activeDots.splice(idx, 1);
      } else {
        const t = elapsed / item.duration;
        const pointIdx = Math.floor(t * (item.points.length - 1));
        if (item.points[pointIdx]) {
          item.dot.position.copy(item.points[pointIdx]);
        }
      }
    });

    // Update arc fades
    activeArcs.forEach((item, idx) => {
      if (now >= item.endTime) {
        scene.remove(item.arc);
        activeArcs.splice(idx, 1);
      } else if (now >= item.startTime) {
        const elapsed = now - item.startTime;
        const duration = item.endTime - item.startTime;
        const t = elapsed / duration;
        item.arcMat.opacity = 0.8 * (1 - t);
      }
    });

    // Slow rotation
    sphere.rotation.y += 0.0001;
    wireframe.rotation.y += 0.0001;
    atmosphere.rotation.y += 0.0001;

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
    sphereGeom.dispose();
    sphereMat.dispose();
    wireframeGeom.dispose();
    wireframeMat.dispose();
    atmosphereGeom.dispose();
    atmosphereMat.dispose();
  };
}

/**
 * Render counter badges
 */
function renderCounters(container, stats) {
  const counters = document.createElement('div');
  counters.className = 'counters';

  const badges = [
    {
      label: 'Blocked Today',
      value: (stats.blockedToday || 0).toLocaleString(),
      className: 'accent',
    },
    {
      label: 'Active Threats',
      value: stats.activeThreats || 0,
      className: 'danger live',
    },
    {
      label: 'Countries',
      value: stats.countriesTargeted || 0,
      className: 'warn',
    },
  ];

  badges.forEach(({ label, value, className }) => {
    const badge = document.createElement('div');
    badge.className = `counter-badge ${className}`;
    badge.innerHTML = `
      <div class="counter-label">${label}</div>
      <div class="counter-value">${value}</div>
    `;
    counters.append(badge);
  });

  container.append(counters);
}

/**
 * Get flag emoji for country code
 */
function getFlagEmoji(cc) {
  if (!cc || cc.length !== 2) return '🌍';
  return String.fromCodePoint(
    ...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt()),
  );
}

/**
 * Render ticker with event feed
 */
function renderTicker(container, events) {
  const ticker = document.createElement('div');
  ticker.className = 'ticker';

  const track = document.createElement('div');
  track.className = 'ticker-track';

  // Duplicate items for seamless scroll loop
  const itemsToShow = events.slice(0, 20);
  const itemsHTML = itemsToShow
    .map(
      (event) => `
    <div class="ticker-item">
      <span class="severity ${event.severity}"></span>
      <span class="region">${getFlagEmoji(event.src.cc)} ${event.src.country}</span>
      <span>→</span>
      <span class="region">${getFlagEmoji(event.dst.cc)} ${event.dst.country}</span>
      <span>${event.type}</span>
      <time>${new Date(event.ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })}</time>
    </div>
  `,
    )
    .join('');

  track.innerHTML = itemsHTML + itemsHTML; // Duplicate for loop
  ticker.append(track);
  container.append(ticker);
}

/**
 * Main block decoration function
 */
export default async function decorate(block) {
  try {
    // Parse block content
    const { config: blockConfig, events: blockEvents } = parseBlock(block);

    // Build full config with defaults
    const config = {
      liveApi: null,
      liveApiAdapter: null,
      refreshMs: 30000,
      stats: { blockedToday: 0, activeThreats: 0, countriesTargeted: 0 },
      events: [],
      ...blockConfig,
    };

    // Determine data source
    let data = null;
    const dataUrl = config.liveApi || new URL('./viz-threat-map-demo.json', import.meta.url).href;

    // Use block events if provided, otherwise fetch
    if (blockEvents.length > 0) {
      data = { stats: config.stats, events: blockEvents };
    } else {
      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        data = await loadData(dataUrl, config.liveApiAdapter, controller.signal);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // Validate data
    if (!data || !data.events || data.events.length === 0) {
      renderEmpty(block, 'No threat events to display');
      return;
    }

    // Clear block and setup container
    block.replaceChildren();
    block.style.position = 'relative';
    block.style.minHeight = '600px';

    // Initialize Three.js scene
    await initScene(block, data);

    // Render UI overlays
    renderCounters(block, data.stats);
    renderTicker(block, data.events);

    // Live refresh if liveApi is configured
    if (config.liveApi && config.liveApiAdapter) {
      setInterval(async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const newData = await loadData(config.liveApi, config.liveApiAdapter, controller.signal);
          clearTimeout(timeoutId);

          if (newData && newData.events && newData.events.length > 0) {
            // Update counters and ticker with new data (scene continues animating existing events)
            const countersEl = block.querySelector('.counters');
            const tickerEl = block.querySelector('.ticker');

            if (countersEl) {
              countersEl.replaceWith(() => {
                const newCounters = document.createElement('div');
                renderCounters(newCounters, newData.stats);
                return newCounters.firstChild;
              });
            }

            if (tickerEl) {
              tickerEl.replaceWith(() => {
                const newTicker = document.createElement('div');
                renderTicker(newTicker, newData.events);
                return newTicker.firstChild;
              });
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Live data refresh failed:', error.message);
        }
      }, config.refreshMs);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('viz-threat-map initialization failed:', error);
    renderEmpty(block, `Error: ${error.message}`);
  }
}
