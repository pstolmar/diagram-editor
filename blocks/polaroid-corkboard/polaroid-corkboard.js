// polaroid-corkboard block
// AEM EDS block: table rows = polaroid photos
// Row columns: image | caption | state (aged/faded/cracked) | interaction (hover/click/both)

const MONO_FILTER = {
  aged: 'grayscale(1) contrast(1.22) brightness(.72) sepia(.15)',
  faded: 'grayscale(.82) contrast(.9) brightness(1.04) sepia(.28) saturate(.28)',
  cracked: 'grayscale(1) contrast(1.38) brightness(.64)',
};

const DEFAULT_PHOTOS = [
  {
    caption: 'Campaign 01 · 2024', state: 'aged', rot: -4, sw: 3.8, sd: 0, mt: 0, ix: 'both', bg: '#1a4a8a', ac: '#45c2c2', ic: '◈',
  },
  {
    caption: 'Brand Shoot 12', state: 'faded', rot: 2, sw: 4.2, sd: -1.1, mt: 0, ix: 'click-zoom', bg: '#8a1a5a', ac: '#c1188b', ic: '◉',
  },
  {
    caption: 'Event 2023 ✦', state: 'cracked', rot: -1, sw: 3.1, sd: -0.7, mt: -18, ix: 'hover-reveal', bg: '#1a5a3a', ac: '#45c2c2', ic: '✦',
  },
  {
    caption: 'Partner Day · Q3', state: 'aged', rot: 5, sw: 4.5, sd: -2.0, mt: 8, ix: 'hover-reveal', bg: '#5a3a10', ac: '#e8a020', ic: '◈',
  },
  {
    caption: 'Leadership Summit', state: 'faded', rot: -6, sw: 3.6, sd: -0.3, mt: -8, ix: 'click-zoom', bg: '#1a1a7a', ac: '#7788dd', ic: '◎',
  },
  {
    caption: 'Innovation Lab', state: 'aged', rot: 3, sw: 4.0, sd: -1.8, mt: 0, ix: 'both', bg: '#5a1a1a', ac: '#c1188b', ic: '◉',
  },
];

function parseBoardData(block) {
  const photos = [];
  const rows = [...block.children];

  let labelText = 'Campaign Assets · Pending Governance';
  let startRow = 0;

  if (rows.length > 0) {
    const firstCells = [...rows[0].children];
    const hasImage = firstCells.some((c) => c.querySelector('img'));
    if (!hasImage && firstCells[0] && firstCells[0].textContent.trim()) {
      labelText = firstCells[0].textContent.trim();
      startRow = 1;
    }
  }

  for (let i = startRow; i < rows.length; i += 1) {
    const cells = [...rows[i].children];
    const img = cells[0] ? cells[0].querySelector('img') : null;
    const caption = cells[1] ? cells[1].textContent.trim() : '';
    const state = (cells[2] ? cells[2].textContent.trim() : 'aged') || 'aged';
    const ix = (cells[3] ? cells[3].textContent.trim() : 'both') || 'both';
    const rot = ((i * 37 + 11) % 15) - 7;
    const sw = 3.5 + (i % 5) * 0.22;
    const sd = -(i % 7) * 0.31;
    const mt = i % 3 === 0 ? 0 : ((i % 5) - 2) * 9;
    photos.push({
      img, caption, state, ix, rot, sw, sd, mt,
    });
  }

  return { labelText, photos };
}

function buildPhoto(data, idx) {
  const {
    img, caption, state, ix, rot, sw, sd, mt,
  } = data;

  const pol = document.createElement('div');
  const stateClass = ['aged', 'faded', 'cracked'].includes(state) ? state : 'aged';
  pol.className = `polaroid-photo ${stateClass} swaying`;
  if (ix === 'hover-reveal' || ix === 'both') pol.classList.add('hover-reveal');
  if (ix === 'hover-reveal') pol.classList.add('hover-zoom');
  pol.dataset.photoIdx = idx;

  const mono = MONO_FILTER[stateClass] || MONO_FILTER.aged;
  const fallAnim = rot >= 0 ? 'polaroid-fall-cw' : 'polaroid-fall-ccw';

  pol.style.cssText = [
    `--base-r:rotate(${rot}deg)`,
    `--sway-a:rotate(${rot - 1.5}deg)`,
    `--sway-b:rotate(${rot + 1.5}deg)`,
    `--rot:${rot}deg`,
    `--sw:${sw}s`,
    `--sd:${sd}s`,
    `--fall-anim:${fallAnim}`,
    `--fall-delay:${idx * 0.14}s`,
    `--mono:${mono}`,
    '--color:none',
    mt ? `margin-top:${mt}px` : '',
  ].filter(Boolean).join(';');

  const imgWrap = document.createElement('div');
  imgWrap.className = 'polaroid-photo-img-wrap';

  const inner = document.createElement('div');
  inner.className = 'polaroid-photo-inner';

  if (img) {
    const pic = img.cloneNode(true);
    pic.loading = 'lazy';
    inner.appendChild(pic);
  } else {
    const defaults = DEFAULT_PHOTOS[idx % DEFAULT_PHOTOS.length];
    const ph = document.createElement('div');
    ph.className = 'polaroid-photo-img-placeholder';
    ph.style.background = `linear-gradient(135deg, ${defaults.bg} 0%, ${defaults.ac}55 100%)`;
    ph.textContent = defaults.ic;
    inner.appendChild(ph);
  }

  imgWrap.appendChild(inner);
  pol.appendChild(imgWrap);

  if (caption) {
    const cap = document.createElement('div');
    cap.className = 'polaroid-photo-caption';
    cap.textContent = caption;
    pol.appendChild(cap);
  }

  return pol;
}

// ── ZOOM PORTAL ──
// All photos (any state, including rejected/pending) zoom to center on click.
// Portal is a direct child of body, escaping all transform/overflow contexts.

function buildZoomApprovalBar(idx, approvalActed, photoEl, closePortal) {
  const bar = document.createElement('div');
  bar.className = 'filmstrip-approval-bar pcb-zoom-approval-bar';
  bar.style.cssText = 'opacity:1;pointer-events:auto;';

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'filmstrip-btn filmstrip-btn-reject';
  rejectBtn.setAttribute('aria-label', 'Reject');
  rejectBtn.textContent = '✗';

  const approveBtn = document.createElement('button');
  approveBtn.className = 'filmstrip-btn filmstrip-btn-approve';
  approveBtn.setAttribute('aria-label', 'Approve');
  approveBtn.textContent = '✓';

  rejectBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (approvalActed && approvalActed.has(idx)) return;
    if (approvalActed) approvalActed.add(idx);
    document.querySelectorAll(`.filmstrip-frame[data-frame-idx="${idx}"]`)
      .forEach((f, fi) => { if (fi === 0) f.querySelector('.filmstrip-btn-reject')?.click(); });
    photoEl.classList.add('rejected');
    closePortal();
  });

  approveBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (approvalActed && approvalActed.has(idx)) return;
    if (approvalActed) approvalActed.add(idx);
    document.querySelectorAll(`.filmstrip-frame[data-frame-idx="${idx}"]`)
      .forEach((f, fi) => { if (fi === 0) f.querySelector('.filmstrip-btn-approve')?.click(); });
    photoEl.classList.remove('aged', 'faded', 'cracked', 'approval-pending');
    photoEl.classList.add('revealed');
    import('../../scripts/fx-canvas.js').then(({ fireSparkler }) => fireSparkler(photoEl));
    closePortal();
  });

  bar.append(rejectBtn, approveBtn);
  return bar;
}

function wireZoom(grid, approvalActed) {
  const portal = document.createElement('div');
  portal.className = 'pcb-zoom-portal';
  document.body.appendChild(portal);

  function closeZoom() {
    portal.innerHTML = '';
    portal.classList.remove('active');
    document.body.classList.remove('polaroid-has-zoom');
  }

  grid.querySelectorAll('.polaroid-photo').forEach((photoEl) => {
    photoEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (portal.classList.contains('active')) {
        closeZoom();
        return;
      }

      const idx = parseInt(photoEl.dataset.photoIdx, 10);
      const inApproval = document.body.classList.contains('pcb-approval-mode');
      const alreadyActed = approvalActed && approvalActed.has(idx);

      const clone = photoEl.cloneNode(true);
      clone.classList.remove('swaying', 'falling', 'hover-zoom', 'approval-pending');
      clone.style.cssText = [
        '--base-r:rotate(0deg)',
        '--sway-a:rotate(0deg)',
        '--sway-b:rotate(0deg)',
        'animation:none',
        'transform:none',
        'margin:0',
        'cursor:default',
      ].join(';');

      if (inApproval && !alreadyActed) {
        clone.appendChild(buildZoomApprovalBar(idx, approvalActed, photoEl, closeZoom));
      }

      const backdrop = document.createElement('div');
      backdrop.className = 'pcb-zoom-backdrop';
      backdrop.addEventListener('click', closeZoom);

      portal.innerHTML = '';
      portal.appendChild(backdrop);
      portal.appendChild(clone);
      portal.classList.add('active');
      document.body.classList.add('polaroid-has-zoom');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeZoom();
  });

  return { portal, closeZoom };
}

// ── GOVERNANCE AGENT CHAT ──
function buildChat(board, grid, agentBtn, agentRanRef) {
  const allPols = () => [...grid.querySelectorAll('.polaroid-photo')];

  function runWithChat() {
    if (agentRanRef.ran) return;
    agentRanRef.ran = true; // eslint-disable-line no-param-reassign
    agentBtn.disabled = true;

    const pending = allPols().filter((p) => !p.classList.contains('rejected'));
    const rejectedCount = allPols().length - pending.length;

    // Build chat window
    const chat = document.createElement('div');
    chat.className = 'pcb-governance-chat';
    chat.innerHTML = `
      <div class="pcb-chat-header">
        <span>◈ Governance Agent</span>
        <button class="pcb-chat-close" aria-label="Close">✕</button>
      </div>
      <div class="pcb-chat-body"></div>
      <div class="pcb-chat-input-row">
        <span class="pcb-chat-prompt">&gt;&nbsp;</span>
        <span class="pcb-chat-input-text"></span>
        <span class="pcb-chat-cursor"></span>
      </div>`;
    board.appendChild(chat);

    const chatBody = chat.querySelector('.pcb-chat-body');
    const inputText = chat.querySelector('.pcb-chat-input-text');
    const cursor = chat.querySelector('.pcb-chat-cursor');

    chat.querySelector('.pcb-chat-close').addEventListener('click', () => {
      chat.remove();
      agentBtn.textContent = pending.length > 0 ? '✓ Assets approved' : '✓ All assets approved';
      agentBtn.classList.add('pcb-agent-done');
    });

    function addLine(text, cls, delay) {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = `pcb-chat-line pcb-chat-line-${cls}`;
        line.textContent = text;
        chatBody.appendChild(line);
        chatBody.scrollTop = chatBody.scrollHeight;
      }, delay);
    }

    // Agent intro lines
    addLine('[Agent]: Initiating governance review…', 'agent', 300);
    addLine(`[Agent]: ${allPols().length} campaign assets in queue.`, 'agent', 700);
    if (rejectedCount > 0) {
      addLine(
        `[Agent]: ${rejectedCount} asset${rejectedCount > 1 ? 's' : ''} already rejected by reviewer.`,
        'agent',
        1100,
      );
    }
    const pendingDelay = rejectedCount > 0 ? 1500 : 1100;
    addLine(
      `[Agent]: ${pending.length} asset${pending.length !== 1 ? 's' : ''} pending. Awaiting command.`,
      'agent',
      pendingDelay,
    );

    // Typewriter for user command
    const command = pending.length < allPols().length ? 'Approve remaining' : 'Ok';
    const typeDelay = pendingDelay + 600;
    let charIdx = 0;

    // Start typewriter after intro lines
    setTimeout(() => {
      cursor.style.display = 'inline-block';
      charIdx = 0;
      inputText.textContent = '';
      const ti = setInterval(() => {
        if (charIdx >= command.length) {
          clearInterval(ti);
          cursor.style.display = 'none';
          setTimeout(() => {
            addLine(`[You]: ${command}`, 'user', 0);
            chatBody.scrollTop = chatBody.scrollHeight;
            addLine('[Agent]: Confirmed. Processing assets…', 'agent', 350);

            pending.forEach((p, i) => {
              const captionEl = p.querySelector('.polaroid-photo-caption');
              const label = captionEl ? captionEl.textContent : `Asset ${i + 1}`;
              setTimeout(() => {
                p.classList.remove('aged', 'faded', 'cracked', 'approval-pending');
                p.classList.add('revealed');
                addLine(`[Agent]: ✓ ${label}`, 'success', 0);
                chatBody.scrollTop = chatBody.scrollHeight;
                if (i === 0) {
                  import('../../scripts/fx-canvas.js').then(({ fireSparkler }) => fireSparkler(p));
                }
                if (i === pending.length - 1) {
                  setTimeout(() => {
                    addLine('[Agent]: All pending assets approved.', 'agent', 0);
                    chatBody.scrollTop = chatBody.scrollHeight;
                    import('../../scripts/fx-canvas.js').then(({ fireConfetti }) => fireConfetti());
                    agentBtn.textContent = '✓ All pending assets approved';
                    agentBtn.classList.add('pcb-agent-done');
                  }, 300);
                }
              }, 600 + i * 220);
            });
          }, 250);
          return;
        }
        inputText.textContent += command[charIdx];
        charIdx += 1;
      }, 90);
    }, typeDelay);
  }

  return runWithChat;
}

function dropPhotos(sceneEl) {
  sceneEl.querySelectorAll('.polaroid-photo').forEach((p) => {
    p.classList.remove(
      'aged',
      'faded',
      'cracked',
      'swaying',
      'revealed',
      'hover-reveal',
      'click-zoom',
      'hover-zoom',
      'zoomed',
    );
    p.classList.add('falling');
  });
}

function tipScene(sceneEl) {
  sceneEl.classList.add('tipped');
  setTimeout(() => dropPhotos(sceneEl), 450);
}

function resetScene(sceneEl, originalData, onReset) {
  sceneEl.classList.remove('tipped');
  sceneEl.querySelectorAll('.polaroid-photo').forEach((p, i) => {
    p.classList.remove('falling', 'revealed', 'zoomed', 'rejected', 'approval-pending');
    const d = originalData[i];
    if (!d) return;
    p.classList.add(d.state, 'swaying');
    if (d.ix === 'hover-reveal' || d.ix === 'both') p.classList.add('hover-reveal');
    if (d.ix === 'hover-reveal') p.classList.add('hover-zoom');
  });
  document.body.classList.remove('polaroid-has-zoom', 'pcb-approval-mode');
  if (onReset) onReset();
}

export default function decorate(block) {
  const { labelText, photos: parsedPhotos } = parseBoardData(block);

  const photos = parsedPhotos.length ? parsedPhotos : DEFAULT_PHOTOS.map((d) => ({
    img: null,
    caption: d.caption,
    state: d.state,
    ix: d.ix,
    rot: d.rot,
    sw: d.sw,
    sd: d.sd,
    mt: d.mt,
  }));

  block.textContent = '';

  const floor = document.createElement('div');
  floor.className = 'polaroid-corkboard-floor';

  const plane = document.createElement('div');
  plane.className = 'polaroid-corkboard-plane';

  const board = document.createElement('div');
  board.className = 'polaroid-corkboard-board';

  const label = document.createElement('div');
  label.className = 'polaroid-corkboard-label';
  label.textContent = labelText;

  const grid = document.createElement('div');
  grid.className = 'polaroid-corkboard-grid';

  photos.forEach((data, idx) => grid.appendChild(buildPhoto(data, idx)));

  // Governance agent bar
  const agentBar = document.createElement('div');
  agentBar.className = 'polaroid-corkboard-agent-bar';

  const agentBtn = document.createElement('button');
  agentBtn.className = 'polaroid-corkboard-agent-btn';
  agentBtn.innerHTML = '<span class="pcb-agent-icon">◈</span> Run Governance Agent';

  const agentRanRef = { ran: false };
  const runGovernanceAgent = buildChat(board, grid, agentBtn, agentRanRef);

  agentBtn.addEventListener('click', runGovernanceAgent);
  agentBar.appendChild(agentBtn);

  // Filmstrip approval mode bridge
  const approvalActed = new Set();

  document.addEventListener('filmstrip:approvalmode', () => {
    agentBar.style.display = 'none';
    document.body.classList.add('pcb-approval-mode');
    [...grid.querySelectorAll('.polaroid-photo')].forEach((p) => {
      p.classList.add('approval-pending');
    });
  });

  document.addEventListener('filmstrip:approve', (e) => {
    const photo = [...grid.querySelectorAll('.polaroid-photo')][e.detail.index];
    if (!photo) return;
    approvalActed.add(e.detail.index);
    photo.classList.remove('approval-pending', 'aged', 'faded', 'cracked');
    photo.classList.add('revealed');
    import('../../scripts/fx-canvas.js').then(({ fireSparkler }) => fireSparkler(photo));
  });

  document.addEventListener('filmstrip:reject', (e) => {
    const photo = [...grid.querySelectorAll('.polaroid-photo')][e.detail.index];
    if (!photo) return;
    approvalActed.add(e.detail.index);
    photo.classList.add('rejected');
  });

  board.appendChild(label);
  board.appendChild(agentBar);
  board.appendChild(grid);
  plane.appendChild(board);
  block.appendChild(floor);
  block.appendChild(plane);

  // Hover-reveal (not in approval mode)
  grid.querySelectorAll('.polaroid-photo.hover-reveal').forEach((p, i) => {
    const state = photos[i] ? photos[i].state : 'aged';
    p.addEventListener('mouseenter', () => {
      if (p.classList.contains('approval-pending') || p.classList.contains('rejected')) return;
      p.classList.remove('aged', 'faded', 'cracked');
      p.classList.add('revealed');
    });
    p.addEventListener('mouseleave', () => {
      if (!p.classList.contains('zoomed')) {
        p.classList.remove('revealed');
        p.classList.add(state);
      }
    });
  });

  // Zoom — all photos, body portal
  const { portal: zoomPortal, closeZoom } = wireZoom(grid, approvalActed);

  // Filmstrip frame click → side-by-side comparison in zoom portal
  document.addEventListener('filmstrip:frameclick', (e) => {
    const idx = e.detail.index;
    const photoEl = [...grid.querySelectorAll('.polaroid-photo')][idx];
    if (!photoEl) return;
    const filmFrame = document.querySelector(`.filmstrip-frame[data-frame-idx="${idx}"]`);

    closeZoom();

    const inApproval = document.body.classList.contains('pcb-approval-mode');
    const alreadyActed = approvalActed.has(idx);

    // Build side-by-side panel
    const panel = document.createElement('div');
    panel.className = 'pcb-compare-panel';

    // Left: film negative
    const filmSide = document.createElement('div');
    filmSide.className = 'pcb-compare-film';
    const filmImg = filmFrame ? filmFrame.querySelector('img') : null;
    if (filmImg) {
      filmSide.appendChild(filmImg.cloneNode(true));
    } else {
      const ph = document.createElement('div');
      ph.className = 'filmstrip-img-placeholder';
      filmSide.appendChild(ph);
    }
    const filmLabel = document.createElement('div');
    filmLabel.className = 'pcb-compare-film-label';
    filmLabel.textContent = 'ORIGINAL NEGATIVE';
    filmSide.appendChild(filmLabel);

    // Right: polaroid (enlarged)
    const polSide = document.createElement('div');
    polSide.className = 'pcb-compare-pol';
    const clone = photoEl.cloneNode(true);
    clone.classList.remove('swaying', 'falling', 'hover-zoom', 'approval-pending');
    clone.style.cssText = [
      '--base-r:rotate(0deg)',
      '--sway-a:rotate(0deg)',
      '--sway-b:rotate(0deg)',
      'animation:none',
      'transform:none',
      'margin:0',
      'cursor:default',
    ].join(';');
    polSide.appendChild(clone);

    if (inApproval && !alreadyActed) {
      panel.appendChild(buildZoomApprovalBar(idx, approvalActed, photoEl, closeZoom));
    }

    panel.append(filmSide, polSide);

    const backdrop = document.createElement('div');
    backdrop.className = 'pcb-zoom-backdrop';
    backdrop.addEventListener('click', closeZoom);

    zoomPortal.innerHTML = '';
    zoomPortal.appendChild(backdrop);
    zoomPortal.appendChild(panel);
    zoomPortal.classList.add('active');
    document.body.classList.add('polaroid-has-zoom');
  });

  // Scroll-triggered tip + drop
  let tipped = false;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!tipped && !entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
        tipped = true;
        tipScene(block);
      }
      if (tipped && entry.isIntersecting && entry.intersectionRatio > 0.5) {
        tipped = false;
        agentRanRef.ran = false; // eslint-disable-line no-param-reassign
        resetScene(block, photos, () => {
          agentBtn.disabled = false;
          agentBtn.classList.remove('pcb-agent-done');
          agentBtn.innerHTML = '<span class="pcb-agent-icon">◈</span> Run Governance Agent';
          agentBar.style.display = '';
          block.querySelector('.pcb-governance-chat')?.remove();
        });
      }
    },
    { threshold: [0, 0.5] },
  );
  observer.observe(block);

  // Demo URL params
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo');
  if (demo === 'corkboard' || demo === 'new') {
    setTimeout(() => block.scrollIntoView({ behavior: 'smooth' }), 100);
  }
  if (demo === 'fallen') {
    setTimeout(() => { block.scrollIntoView(); tipped = true; tipScene(block); }, 200);
  }
  if (demo === 'governance') {
    setTimeout(() => {
      block.scrollIntoView({ behavior: 'smooth' });
      setTimeout(runGovernanceAgent, 800);
    }, 200);
  }
}
