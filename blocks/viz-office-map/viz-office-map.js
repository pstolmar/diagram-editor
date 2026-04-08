/**
 * viz-office-map — Adobe HQ floor occupancy map
 *
 * Auth-gate pattern (per EDS docs):
 *  - Shows a blurred preview to anonymous visitors
 *  - Reveals live floor map if window.adobeIMS reports signed-in
 *  - Also detects Sidekick / hlx-edit context for authors
 *  - On the published edge, use site-auth / CDN token config to
 *    serve the data fragment only to authenticated requests
 */

const ZONE_COLORS = {
  meeting: { fill: 'rgba(59,130,246,0.55)', border: '#3b82f6' },
  openplan: { fill: 'rgba(34,197,94,0.35)', border: '#22c55e' },
  amenity: { fill: 'rgba(245,166,35,0.30)', border: '#f5a623' },
  phone: { fill: 'rgba(180,142,255,0.45)', border: '#b48eff' },
  common: { fill: 'rgba(100,116,139,0.35)', border: '#64748b' },
};

const STATUS_TINT = {
  busy: 'rgba(248,81,73,0.18)',
  partial: 'rgba(245,166,35,0.18)',
  free: null,
};

// ── Auth helpers ──────────────────────────────────────────────────────────

function isAuthenticated() {
  // Check Adobe IMS (present when Sidekick is active or site has IMS integration)
  if (window.adobeIMS?.isSignedInUser?.()) return true;
  // Check for Sidekick edit context
  if (document.documentElement.classList.contains('hlx-edit')) return true;
  // Check for Sidekick plugin element
  if (document.querySelector('helix-sidekick, aem-sidekick')) return true;
  return false;
}

function waitForAuth(callback) {
  // Recheck after IMS initialises
  const check = () => {
    if (isAuthenticated()) callback();
  };
  window.addEventListener('IMS:Ready', check);
  window.addEventListener('sidekick-ready', check);
  document.addEventListener('sidekick:loaded', check);
  // Fallback poll: IMS may load async after DOMContentLoaded
  let tries = 0;
  const poll = setInterval(() => {
    tries += 1;
    if (isAuthenticated() || tries > 10) {
      clearInterval(poll);
      if (isAuthenticated()) callback();
    }
  }, 600);
}

// ── Canvas floor-plan renderer ────────────────────────────────────────────

function drawFloorPlan(canvas, data, jitter = false) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Background grid
  ctx.strokeStyle = 'rgba(42,49,68,0.6)';
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const MARGIN = 48; // space for statusbar + bottom
  const mapW = w;
  const mapH = h - MARGIN;
  const offsetY = MARGIN;

  data.zones.forEach((zone) => {
    const zx = zone.x * mapW;
    const zy = zone.y * mapH + offsetY;
    const zw = zone.w * mapW;
    const zh = zone.h * mapH;

    // Occupancy tint: dim = empty, bright = full
    const occ = zone.capacity > 0 ? zone.occupied / zone.capacity : 0;
    const alpha = jitter ? Math.max(0, Math.min(1, occ + (Math.random() - 0.5) * 0.08)) : occ;
    const colors = ZONE_COLORS[zone.type] || ZONE_COLORS.common;

    // Zone fill
    ctx.fillStyle = STATUS_TINT[zone.status] || colors.fill;
    ctx.beginPath();
    ctx.roundRect(zx + 1, zy + 1, zw - 2, zh - 2, 4);
    ctx.fill();

    // Occupancy heat overlay
    ctx.fillStyle = `rgba(34,197,94,${alpha * 0.25})`;
    ctx.fill();

    // Zone border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label + occupancy text (skip tiny phone pods)
    if (zw > 60 && zh > 30) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `bold ${Math.min(11, zw / 8)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Clip label to zone
      ctx.save();
      ctx.beginPath();
      ctx.rect(zx + 4, zy + 4, zw - 8, zh - 8);
      ctx.clip();
      ctx.fillText(zone.label, zx + zw / 2, zy + zh / 2 - 8);
      if (zone.capacity > 0) {
        let occColor = '#3fb950';
        if (alpha > 0.8) occColor = '#f85149';
        else if (alpha > 0.5) occColor = '#f5a623';
        ctx.fillStyle = occColor;
        ctx.font = `${Math.min(10, zw / 9)}px "IBM Plex Mono", monospace`;
        ctx.fillText(`${zone.occupied}/${zone.capacity}`, zx + zw / 2, zy + zh / 2 + 8);
      }
      ctx.restore();
    }

    // Status dot for meeting rooms
    if (zone.status) {
      let dotColor = '#3fb950';
      if (zone.status === 'busy') dotColor = '#f85149';
      else if (zone.status === 'partial') dotColor = '#f5a623';
      ctx.beginPath();
      ctx.arc(zx + zw - 8, zy + 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
    }
  });
}

// ── Auth gate overlay ─────────────────────────────────────────────────────

function renderAuthGate(block, onUnlock) {
  const gate = document.createElement('div');
  gate.className = 'vom-auth-gate';
  gate.style.cssText = `
    position: absolute; inset: 0; z-index: 50;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(13,17,23,0.72); backdrop-filter: blur(12px);
    gap: 16px; text-align: center; padding: 2rem;
  `;
  gate.innerHTML = `
    <div style="font-size:2.5rem; opacity:0.8;">🔒</div>
    <div style="font-family:'IBM Plex Mono',monospace; font-size:0.85rem; font-weight:600;
                letter-spacing:0.12em; text-transform:uppercase; color:#f5a623;">
      Authenticated Access Only
    </div>
    <div style="font-size:0.75rem; color:#7d8590; max-width:280px; line-height:1.6;">
      This floor occupancy data is restricted to Adobe employees.
      Sign in with your Adobe ID to view live occupancy.
    </div>
    <button class="vom-signin-btn" style="
      margin-top:8px; padding:10px 24px; background:rgba(245,166,35,0.15);
      border:1px solid #f5a623; border-radius:6px; color:#f5a623;
      font-family:'IBM Plex Mono',monospace; font-size:0.8rem; font-weight:600;
      letter-spacing:0.08em; cursor:pointer; text-transform:uppercase;
      transition: background 200ms, box-shadow 200ms;
    " onmouseover="this.style.background='rgba(245,166,35,0.25)'; this.style.boxShadow='0 0 12px rgba(245,166,35,0.4)'"
       onmouseout="this.style.background='rgba(245,166,35,0.15)'; this.style.boxShadow='none'">
      Sign In with Adobe ID
    </button>
    <div style="font-size:0.65rem; color:#444c56; margin-top:4px;">
      Already signed in via Sidekick? This section will unlock automatically.
    </div>
  `;

  gate.querySelector('.vom-signin-btn').addEventListener('click', () => {
    // Trigger IMS sign-in if available, otherwise open accounts page
    if (window.adobeIMS?.signIn) {
      window.adobeIMS.signIn();
    } else {
      window.open('https://account.adobe.com', '_blank');
    }
  });

  block.style.position = 'relative';
  block.appendChild(gate);

  // Watch for auth state change
  waitForAuth(() => {
    gate.style.transition = 'opacity 400ms ease';
    gate.style.opacity = '0';
    setTimeout(() => {
      gate.remove();
      onUnlock();
    }, 420);
  });
}

// ── Status bar ────────────────────────────────────────────────────────────

function renderStatusBar(block, data) {
  const bar = document.createElement('div');
  bar.className = 'vom-statusbar';
  const occ = data.currentOccupancy ?? '—';
  const cap = data.totalCapacity ?? '—';
  const pct = data.totalCapacity ? Math.round((data.currentOccupancy / data.totalCapacity) * 100) : '—';
  bar.innerHTML = `
    <div class="vom-live-dot"></div>
    <span class="vom-statusbar-label">${data.building ?? 'Floor Plan'}</span>
    <div class="vom-statusbar-sep"></div>
    <span>${occ}/${cap} occupants</span>
    <span style="color:#f5a623">${pct}%</span>
    <div class="vom-statusbar-spacer"></div>
    <span>Auto-refresh 30s</span>
  `;
  block.appendChild(bar);
}

// ── Main render (authenticated) ───────────────────────────────────────────

function renderFloorMap(block, data) {
  block.innerHTML = '';
  block.style.position = 'relative';

  renderStatusBar(block, data);

  const canvas = document.createElement('canvas');
  canvas.className = 'vom-canvas';
  const w = block.offsetWidth || 900;
  const h = block.offsetHeight || 560;
  canvas.width = w * (window.devicePixelRatio || 1);
  canvas.height = h * (window.devicePixelRatio || 1);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  block.appendChild(canvas);
  drawFloorPlan(canvas, data);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'vom-tooltip';
  block.appendChild(tooltip);

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const MARGIN_FRAC = 48 / h;

    const hit = data.zones.find((z) => {
      const ry = (my - MARGIN_FRAC) / (1 - MARGIN_FRAC);
      return mx >= z.x && mx <= z.x + z.w && ry >= z.y && ry <= z.y + z.h;
    });

    if (hit) {
      const occ = hit.capacity > 0 ? `${hit.occupied}/${hit.capacity}` : `${hit.occupied} present`;
      tooltip.innerHTML = `
        <div class="vom-tooltip-name">${hit.label}</div>
        <div class="vom-tooltip-row">
          <span class="vom-tooltip-key">Occupancy</span>
          <span class="vom-tooltip-val">${occ}</span>
        </div>
        ${hit.event ? `<div class="vom-tooltip-row"><span class="vom-tooltip-key">Event</span><span class="vom-tooltip-val">${hit.event}</span></div>` : ''}
        ${hit.status ? `<div class="vom-tooltip-row"><span class="vom-tooltip-key">Status</span><span class="vom-tooltip-val">${hit.status}</span></div>` : ''}
      `;
      tooltip.style.left = `${e.clientX - rect.left + 12}px`;
      tooltip.style.top = `${e.clientY - rect.top - 10}px`;
      tooltip.classList.add('is-visible');
    } else {
      tooltip.classList.remove('is-visible');
    }
  });

  canvas.addEventListener('mouseleave', () => tooltip.classList.remove('is-visible'));

  // Auto-refresh with simulated occupancy jitter
  setInterval(() => {
    // Simulate small live changes
    data.zones.forEach((zone) => {
      if (zone.capacity > 0 && Math.random() < 0.3) {
        const delta = Math.random() < 0.5 ? 1 : -1;
        zone.occupied = Math.max(0, Math.min(zone.capacity, zone.occupied + delta));
      }
    });
    drawFloorPlan(canvas, data, true);
    // Update statusbar occupancy
    const total = data.zones.reduce((s, z) => s + z.occupied, 0);
    data.currentOccupancy = total;
    const occEl = block.querySelector('.vom-statusbar');
    if (occEl) {
      const pctNew = Math.round((total / data.totalCapacity) * 100);
      const spans = occEl.querySelectorAll('span');
      if (spans[1]) spans[1].textContent = `${total}/${data.totalCapacity} occupants`;
      if (spans[2]) spans[2].textContent = `${pctNew}%`;
    }
  }, data.refreshMs ?? 30000);
}

// ── Blurred preview ───────────────────────────────────────────────────────

function renderBlurredPreview(block, data) {
  block.style.position = 'relative';

  const preview = document.createElement('canvas');
  const w = block.offsetWidth || 900;
  const h = block.offsetHeight || 560;
  preview.width = w;
  preview.height = h;
  preview.style.cssText = 'width:100%; height:100%; filter:blur(6px) brightness(0.5); position:absolute; inset:0;';
  block.appendChild(preview);
  drawFloorPlan(preview, data);
}

// ── Block entry point ─────────────────────────────────────────────────────

export default async function decorate(block) {
  // Load demo data
  let data;
  try {
    const demoUrl = new URL('./viz-office-map-demo.json', import.meta.url).href;
    const res = await fetch(demoUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    block.innerHTML = `<div class="viz-empty-state">
      <div class="viz-empty-icon">🏢</div>
      <div class="viz-empty-title">Office Map Unavailable</div>
      <div class="viz-empty-hint">${e.message}</div>
    </div>`;
    return;
  }

  if (isAuthenticated()) {
    // Signed in — render directly
    renderFloorMap(block, data);
  } else {
    // Anonymous — blurred preview + auth gate
    renderBlurredPreview(block, data);
    renderAuthGate(block, () => renderFloorMap(block, data));
  }
}
