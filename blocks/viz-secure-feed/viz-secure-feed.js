/**
 * viz-secure-feed — Auth-gated confidential metric cards
 *
 * Anonymous visitors see a blurred lock-screen overlay.
 * Adobe employees (Sidekick / adobeIMS) see the live metrics.
 */

function isAuthenticated() {
  if (window.adobeIMS?.isSignedInUser?.()) return true;
  if (document.documentElement.classList.contains('hlx-edit')) return true;
  if (document.querySelector('helix-sidekick, aem-sidekick')) return true;
  return false;
}

function waitForAuth(cb) {
  window.addEventListener('IMS:Ready', () => { if (isAuthenticated()) cb(); });
  window.addEventListener('sidekick-ready', () => { if (isAuthenticated()) cb(); });
  document.addEventListener('sidekick:loaded', () => { if (isAuthenticated()) cb(); });
  let tries = 0;
  const poll = setInterval(() => {
    tries += 1;
    if (isAuthenticated() || tries > 10) {
      clearInterval(poll);
      if (isAuthenticated()) cb();
    }
  }, 600);
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function renderFeed(block, data) {
  block.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'feed-container';

  // Header
  const header = document.createElement('div');
  header.className = 'feed-card-header';
  header.innerHTML = `
    <span class="feed-card-title">${data.feedTitle || 'Secure Feed'}</span>
    <div class="badge-group">
      <span class="confidential-badge"><span class="badge-icon"></span> Confidential</span>
    </div>
  `;
  container.append(header);

  // Metric cards grid
  const grid = document.createElement('div');
  grid.className = 'metric-cards-grid';
  (data.metrics || []).forEach((m) => {
    const card = document.createElement('div');
    card.className = `metric-card${m.alert ? ' alert' : ''}`;
    let trendClass = 'neutral';
    if (m.trend === 'up') trendClass = 'up';
    else if (m.trend === 'down') trendClass = 'down';
    card.innerHTML = `
      <div class="metric-label">${m.label}</div>
      <div class="metric-value">${m.value}</div>
      ${m.delta ? `<div class="metric-delta ${trendClass}"><span class="delta-arrow"></span>${m.delta}</div>` : ''}
    `;
    grid.append(card);
  });
  container.append(grid);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'feed-footer';
  footer.innerHTML = `
    <div class="last-synced">
      <span class="status-dot synced"></span>
      <span>Synced ${data.syncedAt ? timeAgo(data.syncedAt) : 'recently'}</span>
    </div>
    <div class="feed-footer-meta">
      <span>${data.source || ''}</span>
      <span>${data.note || ''}</span>
    </div>
  `;
  container.append(footer);
  block.append(container);
}

function renderAuthGate(block, onUnlock) {
  const gate = document.createElement('div');
  gate.style.cssText = `
    position:absolute; inset:0; z-index:50; display:flex; flex-direction:column;
    align-items:center; justify-content:center; background:rgba(12,24,38,0.85);
    backdrop-filter:blur(14px); gap:16px; text-align:center; padding:2rem;
  `;
  gate.innerHTML = `
    <div style="font-size:2.5rem;opacity:0.7;">🔒</div>
    <div class="confidential-badge critical" style="font-size:0.8rem;">
      <span class="badge-icon"></span> Authenticated Access Only
    </div>
    <div style="font-size:0.75rem;color:#94a3b8;max-width:280px;line-height:1.6;">
      This data feed is restricted to Adobe employees.
      Sign in with your Adobe ID to view.
    </div>
    <button style="
      margin-top:8px; padding:10px 24px; background:rgba(59,130,246,0.15);
      border:1px solid #3b82f6; border-radius:4px; color:#3b82f6;
      font-size:0.8rem; font-weight:600; cursor:pointer; text-transform:uppercase;
      letter-spacing:0.08em;
    " onclick="window.adobeIMS?.signIn ? window.adobeIMS.signIn() : window.open('https://account.adobe.com','_blank')">
      Sign In with Adobe ID
    </button>
    <div style="font-size:0.65rem;color:#475569;">
      Already signed in via Sidekick? This will unlock automatically.
    </div>
  `;

  block.style.position = 'relative';
  block.append(gate);

  waitForAuth(() => {
    gate.style.transition = 'opacity 400ms ease';
    gate.style.opacity = '0';
    setTimeout(() => { gate.remove(); onUnlock(); }, 420);
  });
}

export default async function decorate(block) {
  // Load demo data
  let data;
  try {
    const url = new URL('./viz-secure-feed-demo.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    block.innerHTML = `
      <div class="feed-empty-state">
        <div class="feed-empty-icon">🔐</div>
        <div class="feed-empty-title">Secure Feed Unavailable</div>
        <div class="feed-empty-hint">${e.message}</div>
      </div>`;
    return;
  }

  if (isAuthenticated()) {
    renderFeed(block, data);
  } else {
    // Render blurred preview behind gate
    renderFeed(block, data);
    block.style.filter = 'blur(6px) brightness(0.4)';
    block.style.pointerEvents = 'none';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;';
    block.parentElement.insertBefore(wrapper, block);
    wrapper.append(block);
    block.style.position = 'relative';

    renderAuthGate(wrapper, () => {
      block.style.filter = '';
      block.style.pointerEvents = '';
    });
  }
}
