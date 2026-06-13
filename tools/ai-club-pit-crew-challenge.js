const FAKE_TEAMS = [
  {
    slug: 'context-window-warriors', name: 'Context Window Warriors', accent: '#9cf7b2',
    config: { mobility: 'scout-legs', utility: 'robot-arm', care: 'stabilizer', brain: 'structured-thinker' },
    score: 17, place: 1,
  },
  {
    slug: 'prompt-engineers', name: 'Prompt Engineers', accent: '#77f2ed',
    config: { mobility: 'scout-legs', utility: 'robot-arm', care: 'cushion-mount', brain: 'fast-guesser' },
    score: 15, place: 2,
  },
  {
    slug: 'llm-dreamers', name: 'LLM Dreamers', accent: '#6ca7ff',
    config: { mobility: 'balanced-treads', utility: 'robot-arm', care: 'stabilizer', brain: 'structured-thinker' },
    score: 13, place: 3,
  },
  {
    slug: 'mixture-of-experts', name: 'Mixture of Experts', accent: '#c3a3ff',
    config: { mobility: 'balanced-treads', utility: 'suction-cup', care: 'cushion-mount', brain: 'fast-guesser' },
    score: 12, place: 4,
  },
  {
    slug: 'agents-of-chaos', name: 'Agents of Chaos', accent: '#ff925c',
    config: { mobility: 'scout-legs', utility: 'grapple-hook', care: 'none', brain: 'fast-guesser' },
    score: 11, place: 5,
  },
  {
    slug: 'search-party', name: 'Search Party', accent: '#ffb4eb',
    config: { mobility: 'balanced-treads', utility: 'suction-cup', care: 'cushion-mount', brain: 'verifier' },
    score: 10, place: 6,
  },
  {
    slug: 'token-titans', name: 'Token Titans', accent: '#d3ff70',
    config: { mobility: 'heavy-lift', utility: 'robot-arm', care: 'cushion-mount', brain: 'structured-thinker' },
    score: 10, place: 7,
  },
  {
    slug: 'the-verifiers', name: 'The Verifiers', accent: '#ffe082',
    config: { mobility: 'heavy-lift', utility: 'suction-cup', care: 'cushion-mount', brain: 'verifier' },
    score: 8, place: 8,
  },
];

// activeTeams mirrors FAKE_TEAMS but is overwritten with live data when AIO is configured
let activeTeams = FAKE_TEAMS;

const LS_TEAM_KEY = 'ai-club:pitTeamSlug';

function getOrAssignTeam() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('resetTeam') === '1') {
    localStorage.removeItem(LS_TEAM_KEY);
  }
  let slug = localStorage.getItem(LS_TEAM_KEY);
  if (!slug) {
    const idx = Math.floor(Math.random() * FAKE_TEAMS.length);
    slug = FAKE_TEAMS[idx].slug;
    localStorage.setItem(LS_TEAM_KEY, slug);
  }
  return FAKE_TEAMS.find((t) => t.slug === slug) || FAKE_TEAMS[0];
}

const state = {
  phase: 'assign',
  team: null,
  votes: {},
};

// ── Query params (module-level so all phases can read them) ───────────────
const params = new URLSearchParams(window.location.search);
const gameDuration = params.get('voting') === 'short' ? 120 : 300;

// ── Adobe I/O Runtime integration ─────────────────────────────────────────
// Pass ?aio=<url> or ?aio=stage to enable. Without it every aioFetch() returns
// null and fake data drives everything — zero regression for local dev.
const AIO_ALIASES = {
  stage: 'https://adobeioruntime.net/api/v1/web/768811-280maroonswan-stage/pstolmar-test/robot-game',
  prod:  '',
};
const AIO_BASE = AIO_ALIASES[params.get('aio')] ?? params.get('aio') ?? '';

async function aioFetch(mode, body = null) {
  if (!AIO_BASE) return null;
  try {
    const opts = body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {};
    const r = await fetch(`${AIO_BASE}?mode=${mode}`, opts);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

function goToPhase(name) {
  const current = document.querySelector('.pit-phase.is-active');
  if (current) current.classList.remove('is-active');
  const next = document.querySelector(`[data-phase="${name}"]`);
  if (next) {
    next.classList.add('is-active');
    state.phase = name;
  }
}

async function init() {
  state.team = getOrAssignTeam();

  // Join the session — server picks team randomly and returns { teamSlug, teamName }.
  // Adopt the server-assigned slug so submit goes to the right team key.
  if (AIO_BASE) {
    const joined = await aioFetch('join');
    if (joined?.teamSlug) {
      const base = FAKE_TEAMS.find((t) => t.slug === joined.teamSlug) || { slug: joined.teamSlug, accent: '#77f2ed' };
      state.team = { ...base, name: joined.teamName || base.name };
      sessionStorage.setItem('ai-club:pitSession', JSON.stringify({
        teamSlug: joined.teamSlug, teamName: state.team.name,
      }));
    }
    const serverStatus = await aioFetch('status');
    if (serverStatus?.expiresAt) {
      state.serverExpiresAt = serverStatus.expiresAt;
      state.serverPhase = serverStatus.phase;
    }
  }

  // Late-join spectator: game already over — skip straight to arena with default build
  if (state.serverPhase === 'results' || (state.serverExpiresAt && Date.parse(state.serverExpiresAt) < Date.now())) {
    const config = { mobility: 'balanced-treads', utility: 'robot-arm', care: 'cushion-mount', brain: 'structured-thinker' };
    state.team = { ...state.team, config, score: computeScoreFromConfig(config) };
    goToPhase('arena');
    runArenaPhase();
    return;
  }

  const startPhase = params.get('startPhase') || 'assign';
  goToPhase(startPhase);
  if (startPhase === 'assign') runAssignPhase();
  else if (startPhase === 'countdown') runCountdownPhase();
  else if (startPhase === 'vote') runVotePhase();
  else if (startPhase === 'lobby') runLobbyPhase();
  else if (startPhase === 'arena') runArenaPhase();
}

const BUILD_GROUPS = [
  {
    id: 'brain',
    label: 'Decision Brain',
    icon: '🧠',
    description: 'How does your robot decide what to do next?',
    options: [
      { id: 'fast-guesser', label: 'Fast Guesser', desc: 'Quick decisions, sometimes wrong — speed bonus' },
      { id: 'structured-thinker', label: 'Structured Thinker', desc: 'Methodical — consistent, moderate speed' },
      { id: 'verifier', label: 'Verifier', desc: 'Double-checks everything — slow but thorough' },
    ],
  },
  {
    id: 'utility',
    label: 'Utility Attachment',
    icon: '🦾',
    description: 'What tool does your robot use to handle objects?',
    options: [
      { id: 'robot-arm', label: 'Robot Arm', desc: 'Precision grabber — works on most tasks' },
      { id: 'suction-cup', label: 'Suction Cup', desc: 'Gentle handling — best for fragile items' },
      { id: 'grapple-hook', label: 'Grapple Hook', desc: 'High range — risky on delicate objectives' },
    ],
  },
  {
    id: 'care',
    label: 'Fragile Item Handling',
    icon: '📦',
    description: 'How does your robot protect fragile cargo?',
    options: [
      { id: 'stabilizer', label: 'Stabilizer Rig', desc: 'Active balance — best overall protection' },
      { id: 'cushion-mount', label: 'Cushion Mount', desc: 'Passive padding — lighter, good enough' },
      { id: 'none', label: 'Unconstrained', desc: 'No extra protection — max speed, zero care' },
    ],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    icon: '🚗',
    description: 'How does your robot get around the arena?',
    options: [
      { id: 'scout-legs', label: 'Scout Legs', desc: 'Fast but fragile — speed bonus, higher fail risk' },
      { id: 'balanced-treads', label: 'Balanced Treads', desc: 'Solid all-around, moderate speed' },
      { id: 'heavy-lift', label: 'Heavy Lift', desc: 'Deliberate and strong — slow, very stable' },
    ],
  },
];

function startTimerButton(btn, durationMs, onComplete) {
  btn.classList.add('timer-btn--active');
  const start = performance.now();
  let rafId;
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    btn.style.setProperty('--timer-progress', `${progress * 360}deg`);
    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      btn.classList.remove('timer-btn--active');
      onComplete();
    }
  }
  rafId = requestAnimationFrame(tick);
  btn.addEventListener('click', () => {
    cancelAnimationFrame(rafId);
    btn.classList.remove('timer-btn--active');
    onComplete();
  }, { once: true });
}

function runAssignPhase() {
  const team = state.team;
  const pawnsEl = document.getElementById('assign-pawns');
  const revealEl = document.getElementById('assign-reveal');
  const nameEl = document.getElementById('assign-team-name');
  const advanceBtn = document.getElementById('assign-advance');
  const spinner = document.getElementById('assign-spinner');

  const trickle = [800, 900, 1600, 2200];
  trickle.forEach((delay) => {
    setTimeout(() => {
      const pawn = document.createElement('div');
      pawn.className = 'pawn-badge';
      pawn.setAttribute('aria-label', 'Teammate');
      pawn.textContent = '♟';
      pawnsEl.appendChild(pawn);
      requestAnimationFrame(() => requestAnimationFrame(() => pawn.classList.add('is-visible')));
    }, delay);
  });

  setTimeout(() => {
    spinner.style.opacity = '0';
    nameEl.textContent = team.name;
    nameEl.style.color = team.accent;
    revealEl.classList.remove('is-hidden');
    window.gsap.from(revealEl, { y: 16, opacity: 0, duration: 0.5, ease: 'power2.out' });
  }, 3500);

  setTimeout(() => {
    advanceBtn.classList.remove('is-hidden');
    window.gsap.from(advanceBtn, { opacity: 0, scale: 0.95, duration: 0.4 });
    startTimerButton(advanceBtn, 4000, () => {
      goToPhase('countdown');
      runCountdownPhase();
    });
  }, 4000);
}

async function runCountdownPhase() {
  const el = document.getElementById('countdown-number');

  async function showNumber(n, color) {
    el.textContent = n;
    el.style.color = color;
    await window.gsap.fromTo(el,
      { scale: 2.2, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' },
    );
    await new Promise((r) => { setTimeout(r, 750); });
    await window.gsap.to(el, { opacity: 0, scale: 0.85, duration: 0.18 });
  }

  await showNumber('3', '#ef4444');
  await showNumber('2', '#f59e0b');
  await showNumber('1', '#22c55e');

  el.textContent = 'GO!';
  el.style.color = '#38bdf8';
  await window.gsap.fromTo(el,
    { scale: 3, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' },
  );
  await new Promise((r) => { setTimeout(r, 700); });

  goToPhase('vote');
  runVotePhase();
}
function runVotePhase() {
  const container = document.getElementById('vote-groups');
  const lockBtn = document.getElementById('lock-in-build');

  // ── Robot preview canvas ──
  const previewCanvas = document.getElementById('vote-preview-canvas');
  const PW = Math.min(280, window.innerWidth - 48);
  const PH = Math.round(PW * 0.72);
  previewCanvas.width = PW;
  previewCanvas.height = PH;

  const { THREE } = window;
  const previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
  previewRenderer.setSize(PW, PH);

  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(38, PW / PH, 0.1, 30);
  previewCamera.position.set(2.6, 2.8, 4.2);
  previewCamera.lookAt(0, 1.2, 0);

  previewScene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const pvSun = new THREE.DirectionalLight(0xffffff, 1.1);
  pvSun.position.set(3, 6, 4);
  previewScene.add(pvSun);

  const pvFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x0d1a2a, roughness: 0.9 }),
  );
  pvFloor.rotation.x = -Math.PI / 2;
  previewScene.add(pvFloor);

  let pvRobotRoot = null;
  let pvAngle = 0;
  let pvAnimId = null;

  function rebuildPreviewRobot() {
    if (pvRobotRoot) previewScene.remove(pvRobotRoot);
    const config = {
      mobility: state.votes.mobility || 'balanced-treads',
      utility: state.votes.utility || 'robot-arm',
      care: state.votes.care || 'cushion-mount',
      brain: state.votes.brain || 'structured-thinker',
    };
    const robot = buildPodiumRobot(config, previewScene, state.team.accent);
    pvRobotRoot = robot.root;
  }

  rebuildPreviewRobot();

  function pvRenderLoop() {
    pvAnimId = requestAnimationFrame(pvRenderLoop);
    pvAngle += 0.008;
    if (pvRobotRoot) pvRobotRoot.rotation.y = pvAngle;
    previewRenderer.render(previewScene, previewCamera);
  }
  pvRenderLoop();

  function cleanupPreview() {
    cancelAnimationFrame(pvAnimId);
    previewRenderer.dispose();
  }

  container.innerHTML = BUILD_GROUPS.map((group) => `
    <div class="vote-group" data-group="${group.id}">
      <div class="vote-group-header">
        <span class="vote-group-icon">${group.icon}</span>
        <div>
          <h3 class="vote-group-label">${group.label}</h3>
          <p class="vote-group-desc">${group.description}</p>
        </div>
      </div>
      <div class="option-cards">
        ${group.options.map((opt) => `
          <button class="option-card" data-group="${group.id}" data-option="${opt.id}" type="button">
            <span class="option-label">${opt.label}</span>
            <span class="option-desc">${opt.desc}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  function checkAllSelected() {
    const allSelected = BUILD_GROUPS.every((g) => state.votes[g.id]);
    lockBtn.disabled = !allSelected;
  }

  function applyVotesToTeam() {
    state.team = {
      ...state.team,
      config: {
        mobility: state.votes.mobility || 'balanced-treads',
        utility:  state.votes.utility  || 'robot-arm',
        care:     state.votes.care     || 'cushion-mount',
        brain:    state.votes.brain    || 'structured-thinker',
      },
    };
  }

  function autoLockAndAdvance() {
    cleanupPreview();
    BUILD_GROUPS.forEach((g) => {
      if (!state.votes[g.id]) state.votes[g.id] = g.options[0].id;
    });
    applyVotesToTeam();
    new Promise((r) => { setTimeout(r, Math.random() * 400); })
      .then(() => aioFetch('submit', { teamSlug: state.team.slug, build: state.team.config }));
    goToPhase('lobby');
    runLobbyPhase();
  }

  let secs = params.get('fast') === '1' ? 20 : gameDuration;
  if (state.serverExpiresAt && state.serverPhase === 'voting') {
    const remainingMs = Date.parse(state.serverExpiresAt) - Date.now();
    if (remainingMs <= 20000) { autoLockAndAdvance(); return; }
    secs = Math.round(remainingMs / 1000);
  }
  const timerEl = document.getElementById('vote-timer');
  const timerInterval = setInterval(() => {
    secs -= 1;
    const m = Math.floor(Math.max(secs, 0) / 60);
    const s = String(Math.max(secs, 0) % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    if (secs <= 0) {
      clearInterval(timerInterval);
      autoLockAndAdvance();
    }
  }, 1000);

  container.addEventListener('click', (e) => {
    const card = e.target.closest('.option-card');
    if (!card) return;
    const { group, option } = card.dataset;
    container.querySelectorAll(`[data-group="${group}"].option-card`).forEach((c) => {
      c.classList.toggle('is-selected', c === card);
    });
    state.votes[group] = option;
    checkAllSelected();
    rebuildPreviewRobot();
  });

  lockBtn.addEventListener('click', () => {
    if (Object.keys(state.votes).length < BUILD_GROUPS.length) return;
    clearInterval(timerInterval);
    cleanupPreview();
    applyVotesToTeam();
    new Promise((r) => { setTimeout(r, Math.random() * 400); })
      .then(() => aioFetch('submit', { teamSlug: state.team.slug, build: state.team.config }));
    goToPhase('lobby');
    runLobbyPhase();
  });
}
function runLobbyPhase() {
  const fast = params.get('fast') === '1' || params.get('fastLobby') === '1';
  const totalMs = fast ? 2000 : gameDuration * 1000;

  const bar = document.getElementById('lobby-bar');
  const counter = document.getElementById('teams-locked-count');
  const quizOffer = document.getElementById('lobby-quiz-offer');
  const quizContainer = document.getElementById('lobby-quiz-container');
  const lobbyHint = document.querySelector('.lobby-hint');
  const presenceEl = document.getElementById('lobby-presence');

  presenceEl.textContent = '';

  // ── Progress bar ──
  window.gsap.to(bar, { width: '100%', duration: totalMs / 1000, ease: 'none' });

  // ── Auto-load quiz immediately ──
  let quizInProgress = false;
  let quizSettled = false;
  let quizDoneResolve = null;
  const quizDonePromise = new Promise((res) => { quizDoneResolve = res; });

  quizOffer.classList.add('is-hidden');
  quizContainer.classList.remove('is-hidden');
  lobbyHint.classList.add('is-hidden');

  Promise.all([
    import('/tools/ai-club-quiz.js'),
    fetch('/tools/ai-club-quiz-data.json').then((r) => r.json()),
  ]).then(([{ initQuiz }, questions]) => {
    quizInProgress = true;
    initQuiz(quizContainer, questions, {
      onComplete: (score, total) => {
        quizInProgress = false;
        if (!quizSettled) { quizSettled = true; quizDoneResolve({ score, total }); }
      },
    });
  });

  // ── Advance logic (guarded against double-fire) ──
  let hasAdvanced = false;
  async function doAdvance() {
    if (hasAdvanced) return;
    hasAdvanced = true;

    // Signal to server that this player is entering the arena
    aioFetch('advance', { teamSlug: state.team.slug });

    if (quizInProgress && !fast) {
      const skipBanner = document.createElement('div');
      skipBanner.className = 'lobby-skip-banner';
      skipBanner.innerHTML = `
        <span>All teams are ready!</span>
        <button class="pit-btn pit-btn--primary lobby-skip-btn" type="button">Go to Arena →</button>
      `;
      quizContainer.prepend(skipBanner);
      skipBanner.querySelector('.lobby-skip-btn').addEventListener('click', () => {
        if (!quizSettled) { quizSettled = true; quizDoneResolve(null); }
      }, { once: true });
      await quizDonePromise;
      skipBanner.remove();
      if (!quizInProgress) {
        await new Promise((r) => { setTimeout(r, 2000); });
      }
    } else {
      if (!quizSettled) { quizSettled = true; quizDoneResolve(null); }
    }

    counter.closest('.lobby-social').textContent = '⚡ All teams locked in — loading arena…';
    await new Promise((r) => { setTimeout(r, 800); });

    goToPhase('arena');
    runArenaPhase();
  }

  if (AIO_BASE) {
    // ── Live mode: poll /status every 4s ──
    let lastReady = 1;
    let fallbackSet = false;
    const pollInterval = setInterval(async () => {
      const status = await aioFetch('status');
      if (!status) return;
      const { teamsReady, teamsTotal, expiresAt } = status;
      if (!fallbackSet && expiresAt) {
        fallbackSet = true;
        const remaining = Date.parse(expiresAt) - Date.now();
        setTimeout(() => doAdvance(), Math.max(remaining + 4000, 4000));
      }
      if (teamsReady > lastReady) {
        lastReady = teamsReady;
        counter.textContent = teamsReady;
        counter.closest('.lobby-social').classList.add('lobby-pulse');
        setTimeout(() => counter.closest('.lobby-social').classList.remove('lobby-pulse'), 400);
      }
      if (status.phase === 'results' || Date.now() > Date.parse(expiresAt)) {
        clearInterval(pollInterval);
        doAdvance();
      }
    }, 4000);
  } else {
    // ── Dev mode: fake trickle ──
    const fractions = [0.08, 0.18, 0.30, 0.44, 0.57, 0.70, 0.84];
    let locked = 1;
    const trickleTimeouts = fractions.map((frac, idx) => setTimeout(() => {
      locked += 1;
      counter.textContent = locked;
      counter.closest('.lobby-social').classList.add('lobby-pulse');
      setTimeout(() => counter.closest('.lobby-social').classList.remove('lobby-pulse'), 400);
      if (idx === fractions.length - 1) setTimeout(doAdvance, 1500);
    }, frac * totalMs));
    setTimeout(doAdvance, totalMs + 2000);
    void trickleTimeouts;
  }
}
async function showPlayerRobotIntro() {
  const { THREE } = window;
  const introEl = document.getElementById('player-intro');
  const teamNameEl = document.getElementById('player-intro-team');
  const scoreNumEl = document.getElementById('player-intro-score-num');
  const placeEl = document.getElementById('player-intro-place');
  const tagsEl = document.getElementById('player-intro-tags');
  const introCanvas = document.getElementById('player-intro-canvas');

  const team = state.team;
  teamNameEl.textContent = team.name;
  teamNameEl.style.color = team.accent;
  placeEl.textContent = `#${team.place} of 8 teams`;

  // Config tags
  const tagLabels = {
    'scout-legs': 'Scout Legs', 'balanced-treads': 'Balanced Treads', 'heavy-lift': 'Heavy Lift',
    'robot-arm': 'Robot Arm', 'suction-cup': 'Suction Cup', 'grapple-hook': 'Grapple Hook',
    'stabilizer': 'Stabilizer Rig', 'cushion-mount': 'Cushion Mount', none: 'Unconstrained',
    'fast-guesser': 'Fast Guesser', 'structured-thinker': 'Structured Thinker', verifier: 'Verifier',
  };
  tagsEl.innerHTML = Object.values(team.config).map((v) => `
    <span class="player-intro-tag">${tagLabels[v] || v.replace(/-/g, ' ')}</span>
  `).join('');

  // Full arena mission — same scene system as Watch modal, slightly slower
  const W = introEl.clientWidth || Math.min(window.innerWidth - 48, 520);
  const H = Math.round(W * 0.58);
  introCanvas.width = W;
  introCanvas.height = H;

  const renderer = new THREE.WebGLRenderer({ canvas: introCanvas, antialias: true, alpha: true });
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 60);
  camera.position.set(-5.6, 7.8, 9.5);

  scene.add(new THREE.AmbientLight(0x334466, 0.85));
  const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.3);
  keyLight.position.set(6, 10, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const accentFill = new THREE.PointLight(new THREE.Color(team.accent), 0.8, 20);
  accentFill.position.set(-4, 5, 4);
  scene.add(accentFill);
  const rim = new THREE.PointLight(0xff925c, 0.9, 30);
  rim.position.set(-8, 6, -8);
  scene.add(rim);

  const introFloor = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.8, 14),
    new THREE.MeshStandardMaterial({ color: 0x10203b, metalness: 0.15, roughness: 0.9 }),
  );
  introFloor.receiveShadow = true;
  introFloor.position.y = -0.4;
  scene.add(introFloor);
  const grid = new THREE.GridHelper(18, 18, 0x5cecff, 0x173250);
  grid.position.y = 0.02;
  scene.add(grid);

  const mantle = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.45, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x73553d, roughness: 0.85 }),
  );
  mantle.position.set(4.6, 2.8, -3.6);
  mantle.castShadow = true;
  scene.add(mantle);

  const grate = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 2.8, 5),
    new THREE.MeshStandardMaterial({ color: 0x40566d, metalness: 0.65, roughness: 0.4 }),
  );
  grate.position.set(-4.5, 1.5, 0);
  scene.add(grate);
  for (let i = -2; i <= 2; i += 1) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.3, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x7d95ab, metalness: 0.75, roughness: 0.3 }),
    );
    bar.position.set(-4.3, 1.5, i);
    scene.add(bar);
  }

  const waiterWindow = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.3, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xeed9aa, emissive: 0x674318, emissiveIntensity: 0.4 }),
  );
  waiterWindow.position.set(0, 1.8, 5.4);
  scene.add(waiterWindow);

  const atmoGeo = new THREE.BufferGeometry();
  const atmoPos = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i += 1) {
    atmoPos[i * 3] = (Math.random() - 0.5) * 30;
    atmoPos[i * 3 + 1] = Math.random() * 4 + 5.5;
    atmoPos[i * 3 + 2] = -8 - Math.random() * 14;
  }
  atmoGeo.setAttribute('position', new THREE.BufferAttribute(atmoPos, 3));
  const atmosphere = new THREE.Points(atmoGeo, new THREE.PointsMaterial({ color: 0x77f2ed, size: 0.08, transparent: true, opacity: 0.28, depthWrite: false }));
  scene.add(atmosphere);

  const robot = buildArenaRobot(scene, state.team.config, state.team.accent);
  const props = buildArenaProps(scene);

  const camTarget = new THREE.Vector3(0, 1.5, 0);
  const cameraState = { position: camera.position.clone(), target: camTarget.clone(), fov: 42 };
  applyMissionCamera('third', cameraState);

  const clock = new THREE.Clock();
  let animId;
  function loop() {
    animId = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    robot.wheels.forEach((wheel, i) => { wheel.children[0].rotation.y += 0.042 + (i % 2) * 0.004; });
    robot.bobGroup.position.y = Math.sin(t * 2.6) * 0.06;
    robot.legs.forEach(({ group, phase }) => {
      const swing = Math.sin(t * 6 + phase) * 0.28;
      group.rotation.x = swing;
      group.children[0].position.y = -0.28 + Math.abs(swing) * 0.12;
    });
    robot.treads.forEach((sg) => {
      sg.children.forEach((pad, i) => {
        pad.position.z = -0.45 + ((i * 0.18 + t * 0.4) % 1.26) - 0.63;
      });
    });
    atmosphere.rotation.y += 0.0008;
    camera.position.lerp(cameraState.position, 0.08);
    camTarget.lerp(cameraState.target, 0.08);
    camera.fov += (cameraState.fov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  }

  introEl.classList.remove('is-hidden');
  introEl.style.opacity = '0';
  await window.gsap.to(introEl, { opacity: 1, duration: 0.4 });
  loop();

  // Run mission scenes at 0.65× speed
  const missionScenes = buildSceneList(team.config);
  for (const sceneDef of missionScenes) {
    // eslint-disable-next-line no-await-in-loop
    await playArenaScene(sceneDef, robot, props, cameraState, 0.65);
  }

  applyMissionCamera('third', cameraState);
  await countUp(scoreNumEl, team.score, 1400);
  scoreNumEl.style.color = team.accent;

  await new Promise((r) => { setTimeout(r, 2000); });

  await window.gsap.to(introEl, { opacity: 0, y: -20, duration: 0.5 });
  introEl.classList.add('is-hidden');
  introEl.style.opacity = '';
  introEl.style.transform = '';

  cancelAnimationFrame(animId);
  renderer.dispose();
}

async function runArenaPhase() {
  // Load live results from server if AIO is configured
  if (AIO_BASE) {
    const status = await aioFetch('status');
    if (status?.results) {
      const live = Object.entries(status.results)
        .filter(([, r]) => r.actualBuild && r.score > 0)
        .map(([slug, r]) => {
          const base = FAKE_TEAMS.find((t) => t.slug === slug) || { slug, accent: '#77f2ed' };
          return { ...base, name: r.teamName || base.name, config: r.actualBuild, score: r.score };
        })
        .sort((a, b) => b.score - a.score)
        .map((t, i) => ({ ...t, place: i + 1 }));
      if (live.length) {
        activeTeams = live;
        const myLive = live.find((t) => t.slug === state.team.slug);
        if (myLive) state.team = myLive;
      }
    }
  }

  if (params.get('startPhase') !== 'arena') {
    await showPlayerRobotIntro();
  }
  await revealScoreCards();
  await showPodiumBanner();
  await runPodiumSequence();
  showFinalLeaderboard();
}

async function revealScoreCards() {
  const container = document.getElementById('score-reveal-container');
  const nonPodium = activeTeams
    .filter((t) => t.place > 3)
    .sort((a, b) => b.place - a.place);

  await nonPodium.reduce((chain, team) => chain.then(async () => {
    const card = document.createElement('div');
    card.className = 'score-card-reveal';
    card.innerHTML = `
      <div class="score-card-inner">
        <span class="score-card-place">#${team.place}</span>
        <span class="score-card-name" style="color:${team.accent}">${team.name}</span>
        <span class="score-card-score" data-final="${team.score}">0</span>
      </div>
    `;
    container.prepend(card);
    await window.gsap.from(card, { rotateY: 90, opacity: 0, duration: 0.35, ease: 'power2.out' });
    await countUp(card.querySelector('.score-card-score'), team.score, 600);
    await new Promise((r) => { setTimeout(r, 450); });
  }), Promise.resolve());
}

function countUp(el, target, durationMs) {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / durationMs, 1);
      el.textContent = Math.round(progress * target);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target;
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

async function showPodiumBanner() {
  const banner = document.getElementById('podium-banner');
  banner.classList.remove('is-hidden');
  await window.gsap.from(banner, { y: 20, opacity: 0, duration: 0.5 });
  await new Promise((r) => { setTimeout(r, 2200); });
}

async function runPodiumSequence() {
  const container = document.getElementById('podium-container');
  const canvas = document.getElementById('podium-canvas');
  const nameLabel = document.getElementById('podium-team-label');
  container.classList.remove('is-hidden');

  const W = container.clientWidth || Math.min(window.innerWidth - 32, 900);
  const H = Math.round(W * 0.5);
  canvas.width = W;
  canvas.height = H;

  const { THREE } = window;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, W / H, 0.1, 60);
  camera.position.set(0, 4, 11);
  camera.lookAt(0, 1.5, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(4, 8, 5);
  sun.castShadow = true;
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x0d1a2a, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const slotDefs = [
    { x: -3.2, podiumH: 0.5, podiumColor: 0xcd7f32, place: 3 },
    { x: 3.2,  podiumH: 0.9, podiumColor: 0xc0c0c0, place: 2 },
    { x: 0,    podiumH: 1.4, podiumColor: 0xffd700, place: 1 },
  ];

  slotDefs.forEach((s) => {
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, s.podiumH, 24),
      new THREE.MeshStandardMaterial({
        color: s.podiumColor,
        roughness: s.place === 1 ? 0.22 : 0.38,
        metalness: 0.85,
      }),
    );
    cyl.position.set(s.x, s.podiumH / 2, 0);
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    scene.add(cyl);
  });

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  }
  renderLoop();

  async function spawnRobot(slot) {
    const team = activeTeams.find((t) => t.place === slot.place);
    const robot = buildPodiumRobot(team.config, scene, team.accent);
    robot.root.position.set(slot.x, -6, 0);

    await window.gsap.to(robot.root.position, {
      y: slot.podiumH, duration: 0.85, ease: 'back.out(1.1)',
    });

    // Mobility animation
    if (team.config.mobility === 'scout-legs' && robot.legs.length) {
      for (let c = 0; c < 2; c++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(robot.legs.map((leg, i) => {
          const dir = i % 2 === 0 ? -0.15 : 0.15;
          return window.gsap.to(leg.group.position, { y: `+=${dir}`, duration: 0.14, yoyo: true, repeat: 1 });
        }));
      }
    } else if (team.config.mobility === 'balanced-treads' && robot.treads.length) {
      let step = 0;
      const anim = setInterval(() => {
        step += 1;
        robot.treads.forEach((sg) => {
          sg.children.forEach((pad, i) => {
            pad.position.z = -0.45 + ((i * 0.18 + step * 0.06) % 1.08);
          });
        });
      }, 50);
      await new Promise((r) => { setTimeout(r, 650); });
      clearInterval(anim);
    } else {
      await window.gsap.to(robot.root.position, {
        y: slot.podiumH + 0.2, duration: 0.32, yoyo: true, repeat: 1, ease: 'power1.inOut',
      });
    }

    // Utility animation
    if (team.config.utility === 'robot-arm' && robot.armBase) {
      await window.gsap.to(robot.armBase.rotation, { z: -0.9, duration: 0.48, ease: 'power2.inOut' });
      await window.gsap.to(robot.armBase.rotation, { z: 0, duration: 0.38 });
    } else if (team.config.utility === 'grapple-hook') {
      await window.gsap.to(robot.root.rotation, { y: Math.PI * 2, duration: 0.6 });
      robot.root.rotation.y = 0;
    }

    // Show medal card
    showMedalCard(team);

    // Show team name, then fade
    nameLabel.textContent = team.name;
    nameLabel.style.color = team.accent;
    nameLabel.style.opacity = '1';
    await new Promise((r) => { setTimeout(r, 1400); });
    await window.gsap.to(nameLabel, { opacity: 0.35, duration: 0.6 });
  }

  // Entry order: bronze (3rd), silver (2nd), gold (1st)
  const entryOrder = [
    slotDefs.find((s) => s.place === 3),
    slotDefs.find((s) => s.place === 2),
    slotDefs.find((s) => s.place === 1),
  ];

  // eslint-disable-next-line no-restricted-syntax
  for (const slot of entryOrder) {
    // eslint-disable-next-line no-await-in-loop
    await spawnRobot(slot);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 400); });
  }

  // All three visible — celebrate
  nameLabel.style.opacity = '0';
  spawnConfetti();
  // Render loop continues — robots remain visible indefinitely
}

async function playOnePodiumSlot(team, scene) {
  const robot = buildPodiumRobot(team.config, scene, team.accent);
  robot.root.position.y = -4;
  await window.gsap.to(robot.root.position, { y: 0, duration: 0.8, ease: 'back.out(1.2)' });

  // Mobility animation
  if (team.config.mobility === 'scout-legs' && robot.legs.length) {
    // 3 cycles of leg walk
    for (let cycle = 0; cycle < 3; cycle++) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(robot.legs.map((leg, i) => {
        const dir = i % 2 === 0 ? -0.18 : 0.18;
        return window.gsap.to(leg.group.position, { y: `+=${dir}`, duration: 0.18, yoyo: true, repeat: 1 });
      }));
    }
  } else if (team.config.mobility === 'balanced-treads' && robot.treads.length) {
    // Scroll tread pads (translate on Z in a loop)
    let treadStep = 0;
    const treadAnim = setInterval(() => {
      treadStep += 1;
      robot.treads.forEach((sg) => {
        sg.children.forEach((pad, i) => {
          pad.position.z = -0.45 + ((i * 0.18 + treadStep * 0.06) % 1.08);
        });
      });
    }, 50);
    await new Promise((r) => { setTimeout(r, 900); });
    clearInterval(treadAnim);
  } else {
    // heavy-lift or default: deliberate slow bob
    await window.gsap.to(robot.root.position, { y: 0.3, duration: 0.45, yoyo: true, repeat: 1, ease: 'power1.inOut' });
  }

  // Utility animation
  if (team.config.utility === 'robot-arm' && robot.armBase) {
    await window.gsap.to(robot.armBase.rotation, { z: -1.0, duration: 0.55, ease: 'power2.inOut' });
    await window.gsap.to(robot.armBase.rotation, { z: 0, duration: 0.4 });
  } else if (team.config.utility === 'grapple-hook') {
    await window.gsap.to(robot.root.rotation, { y: Math.PI * 2, duration: 0.7, ease: 'power2.inOut' });
    robot.root.rotation.y = 0;
  } else if (team.config.utility === 'suction-cup') {
    await window.gsap.to(robot.root.position, { y: 0.4, duration: 0.3, yoyo: true, repeat: 1 });
  }

  await window.gsap.to(robot.root.rotation, { x: 0.18, duration: 0.25 });
  await new Promise((r) => { setTimeout(r, 300); });
  await window.gsap.to(robot.root.rotation, { x: 0, duration: 0.25 });

  showMedalCard(team);
  await new Promise((r) => { setTimeout(r, team.place === 1 ? 2800 : 1800); });

  scene.remove(robot.root);
}

function buildPodiumRobot(config, scene, accentHex) {
  const { THREE } = window;
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex), roughness: 0.45, metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.5, metalness: 0.6 });
  const greyMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.7, metalness: 0.5 });

  // ── Body ──
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.9), bodyMat);
  body.position.y = 1.15;
  body.castShadow = true;
  root.add(body);

  // ── Head ──
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.52, 0.62), darkMat);
  head.position.y = 1.93;
  head.castShadow = true;
  root.add(head);

  // ── Mobility ──
  const treads = [];
  const legs = [];

  if (config.mobility === 'scout-legs') {
    // 4 articulated legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.6, metalness: 0.5 });
    [[-0.55, 0.38], [0.55, 0.38], [-0.55, -0.38], [0.55, -0.38]].forEach(([x, z], i) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.68, z);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.52, 8), legMat);
      upper.position.set(Math.sign(x) * 0.14, -0.18, 0);
      upper.rotation.z = Math.sign(x) * 0.45;
      upper.castShadow = true;
      legGroup.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.44, 8), legMat);
      lower.position.set(Math.sign(x) * 0.26, -0.48, 0);
      lower.rotation.z = Math.sign(x) * -0.3;
      lower.castShadow = true;
      legGroup.add(lower);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), greyMat);
      foot.position.set(Math.sign(x) * 0.33, -0.68, 0);
      foot.castShadow = true;
      legGroup.add(foot);
      root.add(legGroup);
      legs.push({ group: legGroup, phase: (i % 2) * Math.PI });
    });
  } else if (config.mobility === 'balanced-treads') {
    // Side track boxes with tread pads
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
    [-0.68, 0.68].forEach((x) => {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 1.0), trackMat);
      track.position.set(x, 0.14, 0);
      track.castShadow = true;
      root.add(track);
      // tread strip group (to animate)
      const stripGroup = new THREE.Group();
      stripGroup.position.set(x, 0.14, 0);
      for (let i = 0; i < 6; i++) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.12), padMat);
        pad.position.z = -0.45 + i * 0.18;
        pad.position.y = 0.12;
        stripGroup.add(pad);
      }
      root.add(stripGroup);
      treads.push(stripGroup);
    });
  } else {
    // heavy-lift or default: large wheels
    const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.8 });
    [[-0.65, 0.28, 0.48], [0.65, 0.28, 0.48], [-0.65, 0.28, -0.48], [0.65, 0.28, -0.48]].forEach((pos) => {
      const wg = new THREE.Group();
      wg.position.set(...pos);
      wg.rotation.z = Math.PI / 2;
      const w = new THREE.Mesh(wGeo, wMat);
      w.castShadow = true;
      wg.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.24, 8), hubMat);
      wg.add(hub);
      root.add(wg);
    });
  }

  // ── Utility Attachment ──
  let armBase = null;
  if (config.utility === 'robot-arm') {
    armBase = new THREE.Group();
    armBase.position.set(0.52, 1.55, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), bodyMat);
    upper.position.y = 0.31;
    upper.castShadow = true;
    armBase.add(upper);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.12), darkMat);
    claw.position.set(0, 0.68, 0);
    armBase.add(claw);
    root.add(armBase);
  } else if (config.utility === 'suction-cup') {
    const suckBase = new THREE.Group();
    suckBase.position.set(0.52, 1.4, 0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 10), greyMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.x = 0.25;
    tube.castShadow = true;
    suckBase.add(tube);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 16), bodyMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = 0.54;
    disc.castShadow = true;
    suckBase.add(disc);
    root.add(suckBase);
  } else if (config.utility === 'grapple-hook') {
    const hookBase = new THREE.Group();
    hookBase.position.set(0.0, 2.05, 0);
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), greyMat);
    spool.rotation.z = Math.PI / 2;
    spool.position.x = 0.5;
    hookBase.add(spool);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), darkMat);
    cable.rotation.z = Math.PI / 2;
    cable.position.x = 0.76;
    hookBase.add(cable);
    const hookTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), bodyMat);
    hookTip.position.x = 1.0;
    hookTip.rotation.z = -Math.PI / 2;
    hookTip.castShadow = true;
    hookBase.add(hookTip);
    root.add(hookBase);
  }

  // ── Care ──
  if (config.care === 'stabilizer') {
    const stabMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.4, metalness: 0.7 });
    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.07), stabMat);
      arm.position.set(side * 0.9, 0.75, 0);
      arm.castShadow = true;
      root.add(arm);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.06, 10), darkMat);
      tip.position.set(side * 1.1, 0.75, 0);
      tip.rotation.x = Math.PI / 2;
      tip.castShadow = true;
      root.add(tip);
    });
  } else if (config.care === 'cushion-mount') {
    const cushMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.95 });
    const cush = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.95), cushMat);
    cush.position.set(0, 0.65, 0);
    cush.castShadow = true;
    root.add(cush);
  }

  // ── Brain ──
  const glowColor = config.brain === 'fast-guesser' ? 0xffff00
    : config.brain === 'verifier' ? 0x22c55e : 0x38bdf8;
  const antMat = new THREE.MeshStandardMaterial({
    color: glowColor, emissive: glowColor, emissiveIntensity: 0.7,
  });
  if (config.brain === 'fast-guesser') {
    [-0.14, 0, 0.14].forEach((x) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 6), antMat);
      ant.position.set(x, 2.27, 0);
      root.add(ant);
    });
  } else if (config.brain === 'verifier') {
    [-0.12, 0.12].forEach((x) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 6), antMat);
      ant.position.set(x, 2.30, 0);
      root.add(ant);
    });
  } else {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.52, 6), antMat);
    ant.position.set(0, 2.45, 0);
    root.add(ant);
  }

  scene.add(root);
  return { root, armBase, treads, legs };
}

const PLACE_EMOJIS = ['🥇', '🥈', '🥉'];

function showMedalCard(team) {
  const cardsRow = document.getElementById('podium-medal-cards');
  cardsRow.classList.remove('is-hidden');
  const medalClass = ['gold', 'silver', 'bronze'][team.place - 1];
  const card = document.createElement('div');
  card.className = `medal-card medal-card--${medalClass}`;
  card.dataset.place = String(team.place);
  card.innerHTML = `
    <div class="medal-place">${PLACE_EMOJIS[team.place - 1]}</div>
    <div class="medal-team-name">${team.name}</div>
    <div class="medal-score">${team.score} pts</div>
    <div class="medal-config">
      ${Object.values(team.config).map((v) => `<span class="medal-tag">${v.replace(/-/g, ' ')}</span>`).join('')}
    </div>
    <button class="medal-watch-btn" data-place="${team.place}" type="button">▶ Watch</button>
  `;
  cardsRow.appendChild(card);
  window.gsap.from(card, {
    y: 30, opacity: 0, scale: 0.9, duration: 0.5, ease: 'back.out(1.5)',
  });
  if (team.place === 1) spawnConfetti();
}

function spawnConfetti() {
  const colors = ['#ffd700', '#38bdf8', '#22c55e', '#f59e0b', '#c084fc', '#f472b6'];
  Array.from({ length: 60 }).forEach(() => {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = [
      `left:${Math.random() * 100}vw`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `animation-delay:${Math.random() * 1.5}s`,
      `animation-duration:${1.5 + Math.random() * 2}s`,
      `width:${6 + Math.random() * 8}px`,
      `height:${6 + Math.random() * 8}px`,
      `transform:rotate(${Math.random() * 360}deg)`,
    ].join(';');
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  });
}

function showFinalLeaderboard() {
  const finalEl = document.getElementById('arena-final');
  const list = document.getElementById('full-leaderboard');
  finalEl.classList.remove('is-hidden');
  const sorted = [...activeTeams].sort((a, b) => a.place - b.place);
  list.innerHTML = sorted.map((team) => `
    <li class="lb-row${team.place <= 3 ? ' lb-row--podium' : ''}">
      <span class="lb-place">#${team.place}</span>
      <span class="lb-name" style="color:${team.accent}">${team.name}</span>
      <span class="lb-score">${team.score}</span>
    </li>
  `).join('');
  window.gsap.from(finalEl, { opacity: 0, y: 20, duration: 0.5 });
}

// ── Client-side scoring (mirrors server scoring map, 75–250 per tier, 300–1000 total) ──
const SCORING_MAP = {
  // Mobility
  'balanced-treads': 250, 'scout-legs': 150, 'heavy-lift': 75,
  // Utility
  'robot-arm': 250, 'grapple-hook': 150, 'suction-cup': 75,
  // Care
  'stabilizer': 250, 'cushion-mount': 150, none: 75,
  // Brain
  'structured-thinker': 250, verifier: 150, 'fast-guesser': 75,
};

function computeScoreFromConfig(config) {
  return Object.values(config).reduce((sum, id) => sum + (SCORING_MAP[id] || 0), 0);
}

// ── Full arena mission system ──────────────────────────────────────────────

const MISSION_SCENES = {
  intro: { id: 'intro', title: 'Entering the arena', score: 0, camera: 'third', description: 'Your robot bounds into position.' },
  'high-reach': { id: 'high-reach', title: 'High-reach grab', score: 5, camera: 'cinematic', description: 'The arm extends to the shelf and pulls down the high-value prize.' },
  grapple: { id: 'grapple', title: 'Grapple shot', score: 4, camera: 'close', description: 'The hook fires through the grate and reels in the prize behind it.' },
  scanner: { id: 'scanner', title: 'Target scan', score: 2, camera: 'third', description: 'The scanner dish spins and identifies the highest-value target.' },
  egg: { id: 'egg', title: 'Egg delivery', score: 5, camera: 'close', description: 'The stabilizer lowers the glowing egg onto the pillow cradle and carries it softly to the waiter window.' },
  heavy: { id: 'heavy', title: 'Crate push', score: 2, camera: 'third', description: 'The heavy frame plows into the crate and slides it across the floor.' },
  dash: { id: 'dash', title: 'Speed dash', score: 3, camera: 'driver', description: 'A quick burst across the arena grabs a low-value pickup before the door closes.' },
  balanced: { id: 'balanced', title: 'Route run', score: 2, camera: 'third', description: 'A tidy route across the tiles with a practical mid-value pickup.' },
  verify: { id: 'verify', title: 'Precision check', score: 2, camera: 'close', description: 'Reticle. Pause. Check. A precise pickup that avoids the decoy entirely.' },
  fail: { id: 'fail', title: 'Decoy collision', score: -1, camera: 'third', description: 'The robot rushes in and clips the decoy — points deducted.' },
  finale: { id: 'finale', title: 'Victory pose', score: 1, camera: 'third', description: 'Mission complete. The robot does a victory spin.' },
};

function buildSceneList(config) {
  const s = MISSION_SCENES;
  const scenes = [s.intro];
  if (config.utility === 'robot-arm') scenes.push(s['high-reach']);
  else if (config.utility === 'grapple-hook') scenes.push(s.grapple);
  else if (config.utility === 'suction-cup') scenes.push(s.egg);
  if (config.brain === 'verifier') scenes.push(s.scanner, s.verify);
  else if (config.brain === 'structured-thinker') scenes.push(s.verify);
  if (config.mobility === 'scout-legs') scenes.push(s.dash);
  else if (config.mobility === 'heavy-lift') scenes.push(s.heavy);
  else scenes.push(s.balanced);
  if (config.care === 'none' && config.mobility === 'scout-legs') scenes.push(s.fail);
  scenes.push(s.finale);
  return scenes;
}

function buildArenaRobot(scene, config = null, accentHex = null) {
  const { THREE } = window;
  const root = new THREE.Group();
  const bobGroup = new THREE.Group();
  root.add(bobGroup);

  const bodyColor = accentHex ? new THREE.Color(accentHex) : 0x5b7dff;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.65, 2.7),
    new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.25, roughness: 0.5, emissive: accentHex ? new THREE.Color(accentHex).multiplyScalar(0.18) : 0x102458, emissiveIntensity: 0.55 }),
  );
  body.castShadow = true;
  body.position.y = 1.15;
  bobGroup.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.55, 1.05),
    new THREE.MeshStandardMaterial({ color: 0xd5ecff, emissive: 0x345d9a, emissiveIntensity: 0.25, roughness: 0.35 }),
  );
  head.position.set(0, 2.1, 0.15);
  head.castShadow = true;
  bobGroup.add(head);

  const eyeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.08);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x77f2ed, emissive: 0x77f2ed, emissiveIntensity: 1.2 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.22, 2.12, 0.62);
  eyeR.position.set(0.22, 2.12, 0.62);
  bobGroup.add(eyeL, eyeR);

  const armBase = new THREE.Group();
  armBase.position.set(1.22, 1.55, -0.1);
  armBase.rotation.z = -0.22;
  bobGroup.add(armBase);

  const upperArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 1.4, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xffc56b, roughness: 0.45 }),
  );
  upperArm.position.y = 0.7;
  upperArm.castShadow = true;
  armBase.add(upperArm);

  const forearmPivot = new THREE.Group();
  forearmPivot.position.y = 1.35;
  forearmPivot.rotation.z = 0.18;
  armBase.add(forearmPivot);

  const forearm = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.2, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xff925c, roughness: 0.45 }),
  );
  forearm.position.y = 0.6;
  forearm.castShadow = true;
  forearmPivot.add(forearm);

  const claw = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xf9efe2, roughness: 0.4 }),
  );
  claw.position.y = 1.23;
  forearmPivot.add(claw);

  const hookPivot = new THREE.Group();
  hookPivot.position.set(-1.14, 1.55, -0.2);
  bobGroup.add(hookPivot);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x87a8bf, metalness: 0.7, roughness: 0.35 }),
  );
  cable.position.y = -0.8;
  hookPivot.add(cable);

  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.06, 10, 18, Math.PI * 1.35),
    new THREE.MeshStandardMaterial({ color: 0xd3ff70, metalness: 0.65, roughness: 0.25 }),
  );
  hook.rotation.z = Math.PI / 2;
  hook.position.y = -1.58;
  hookPivot.add(hook);

  const scannerPivot = new THREE.Group();
  scannerPivot.position.set(0, 2.35, 1.55);
  bobGroup.add(scannerPivot);
  const scannerDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.2, 0.16, 24),
    new THREE.MeshStandardMaterial({ color: 0x77f2ed, emissive: 0x184a4d, emissiveIntensity: 0.55 }),
  );
  scannerDish.rotation.x = Math.PI / 2;
  scannerPivot.add(scannerDish);

  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.14, 0.72),
    new THREE.MeshStandardMaterial({ color: 0xb91010, roughness: 0.97, metalness: 0.0 }),
  );
  pillow.position.set(0, 1.97, 0.0);
  bobGroup.add(pillow);

  const legs = [];
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.5, roughness: 0.45 });
  const footMat = new THREE.MeshStandardMaterial({ color: 0x77f2ed, roughness: 0.5 });
  [[-1.05, -0.9], [1.05, -0.9], [-1.05, 0.9], [1.05, 0.9]].forEach(([lx, lz], i) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(lx, 0.55, lz);
    legGroup.rotation.z = Math.sign(lx) * 0.32;
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.22), legMat);
    thigh.position.y = -0.28;
    legGroup.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.18), legMat);
    shin.position.y = -0.85;
    legGroup.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.26), footMat);
    foot.position.set(Math.sign(lx) * 0.1, -1.14, 0.06);
    legGroup.add(foot);
    root.add(legGroup);
    legs.push({ group: legGroup, phase: i * Math.PI * 0.5 });
  });

  const treads = [];
  const treadTracks = [];
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x222e3e, roughness: 0.9 });
  [-1.22, 1.22].forEach((tx) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.48, 2.5), treadMat);
    track.position.set(tx, 0.28, 0);
    root.add(track);
    treadTracks.push(track);
    const stripGroup = new THREE.Group();
    stripGroup.position.set(tx, 0.55, 0);
    root.add(stripGroup);
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x5cecff, emissive: 0x1a4a5a, emissiveIntensity: 0.5 });
    for (let i = 0; i < 7; i += 1) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.12), stripMat);
      strip.position.z = -0.45 + i * 0.18;
      stripGroup.add(strip);
    }
    treads.push(stripGroup);
  });

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.34, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141d2b, roughness: 0.9 });
  [[-1.05, 0.55, 1.02], [1.05, 0.55, 1.02], [-1.05, 0.55, -1.02], [1.05, 0.55, -1.02]].forEach((pos) => {
    const wg = new THREE.Group();
    wg.position.set(...pos);
    wg.rotation.z = Math.PI / 2;
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    wg.add(wheel);
    root.add(wg);
    wheels.push(wg);
  });

  if (config) {
    const usesLegs = config.mobility === 'scout-legs';
    const usesTreads = config.mobility === 'balanced-treads';
    legs.forEach(({ group }) => { group.visible = usesLegs; });
    treadTracks.forEach((t) => { t.visible = usesTreads; });
    treads.forEach((sg) => { sg.visible = usesTreads; });
    wheels.forEach((wg) => { wg.visible = !usesLegs && !usesTreads; });
  }

  scene.add(root);
  return { root, bobGroup, armBase, forearmPivot, hookPivot, cable, hook, scannerPivot, scannerDish, pillow, wheels, legs, treads, eyeL, eyeR };
}

function buildArenaProps(scene) {
  const { THREE } = window;
  const mantlePrize = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({ color: 0xffc76a, emissive: 0x5a3100, emissiveIntensity: 0.55 }),
  );
  mantlePrize.position.set(4.65, 3.35, -3.55);

  const gratePrize = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.25, 0),
    new THREE.MeshStandardMaterial({ color: 0xd3ff70, emissive: 0x334a00, emissiveIntensity: 0.55 }),
  );
  gratePrize.position.set(-5.55, 0.95, 0.55);

  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xd88cff, emissive: 0x5c287d, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.3 }),
  );
  egg.scale.set(0.82, 1.15, 0.82);
  egg.position.set(1.6, 0.92, 2.45);

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.85, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x8f6a42, roughness: 0.85 }),
  );
  crate.position.set(-1.6, 0.43, -2.6);

  const decoy = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.6, 4),
    new THREE.MeshStandardMaterial({ color: 0xff566f, emissive: 0x5b1120, emissiveIntensity: 0.5 }),
  );
  decoy.position.set(0.45, 0.38, -0.6);

  [mantlePrize, gratePrize, egg, crate, decoy].forEach((mesh) => {
    mesh.castShadow = true;
    scene.add(mesh);
  });

  return { mantlePrize, gratePrize, egg, crate, decoy };
}

function applyMissionCamera(kind, cameraState) {
  if (kind === 'close') {
    cameraState.position.set(3.4, 6.5, 8.4);
    cameraState.target.set(1.2, 1.8, 1.8);
    cameraState.fov = 34;
  } else if (kind === 'cinematic') {
    cameraState.position.set(6.2, 7.5, 5.9);
    cameraState.target.set(4.2, 3.5, -3.5);
    cameraState.fov = 32;
  } else if (kind === 'driver') {
    cameraState.position.set(0, 4.5, 2.2);
    cameraState.target.set(0, 2.8, -4.2);
    cameraState.fov = 56;
  } else {
    cameraState.position.set(-5.6, 7.8, 9.5);
    cameraState.target.set(0, 1.5, 0);
    cameraState.fov = 42;
  }
}

function resetArenaRobot(robot, props) {
  const gsap = window.gsap;
  gsap.killTweensOf([
    robot.root.position, robot.root.rotation,
    robot.armBase.rotation, robot.forearmPivot.rotation,
    robot.hookPivot.rotation, robot.cable.scale, robot.hook.position,
    robot.scannerPivot.rotation, robot.scannerDish.scale, robot.pillow.position,
    props.mantlePrize.position, props.gratePrize.position,
    props.egg.position, props.crate.position, props.decoy.rotation,
  ]);
  robot.root.position.set(0, 0, 0);
  robot.root.rotation.set(0, 0, 0);
  robot.armBase.rotation.set(0, 0, -0.22);
  robot.forearmPivot.rotation.set(0, 0, 0.18);
  robot.hookPivot.rotation.set(0, 0, 0);
  robot.cable.scale.set(1, 1, 1);
  robot.hook.position.set(0, -1.58, 0);
  robot.scannerPivot.rotation.set(0, 0, 0);
  robot.scannerDish.scale.set(1, 1, 1);
  robot.pillow.position.set(0, 1.82, 0);
  props.mantlePrize.position.set(4.65, 3.35, -3.55);
  props.gratePrize.position.set(-5.55, 0.95, 0.55);
  props.egg.position.set(1.6, 0.92, 2.45);
  props.crate.position.set(-1.6, 0.43, -2.6);
  props.decoy.rotation.set(0, 0, 0);
}

function playArenaScene(sceneDef, robot, props, cameraState, timeScale = 1) {
  resetArenaRobot(robot, props);
  applyMissionCamera(sceneDef.camera, cameraState);
  const gsap = window.gsap;
  const tl = gsap.timeline({ timeScale });

  if (sceneDef.id === 'intro') {
    tl.to(robot.root.position, { y: 0.22, duration: 0.35, ease: 'power2.out' })
      .to(robot.root.position, { y: 0, duration: 0.5, ease: 'bounce.out' })
      .to(robot.armBase.rotation, { z: -0.55, duration: 0.35 }, 0.1)
      .to(robot.forearmPivot.rotation, { z: 0.7, duration: 0.35 }, 0.1)
      .to(robot.armBase.rotation, { z: -0.18, duration: 0.42 }, 0.48)
      .to(robot.forearmPivot.rotation, { z: 0.15, duration: 0.42 }, 0.48)
      .to(robot.eyeL.scale, { y: 0.15, duration: 0.08, yoyo: true, repeat: 1 }, 0.24)
      .to(robot.eyeR.scale, { y: 0.15, duration: 0.08, yoyo: true, repeat: 1 }, 0.24);
  } else if (sceneDef.id === 'high-reach') {
    tl.to(robot.root.position, { x: 2.8, z: -2.2, duration: 1.1, ease: 'power2.inOut' })
      .to(robot.armBase.rotation, { z: -1.08, duration: 0.55 }, '-=0.2')
      .to(robot.forearmPivot.rotation, { z: 0.18, duration: 0.55 }, '<')
      .to(props.mantlePrize.position, { x: 3.95, y: 2.25, z: -2.1, duration: 0.55, ease: 'power1.inOut' }, '-=0.08')
      .to(cameraState, { fov: 27, duration: 0.2 }, '-=0.25')
      .to(robot.root.position, { x: 1.5, z: -0.6, duration: 0.8 })
      .to(robot.armBase.rotation, { z: -0.22, duration: 0.45 }, '<')
      .to(robot.forearmPivot.rotation, { z: 0.18, duration: 0.45 }, '<');
  } else if (sceneDef.id === 'grapple') {
    tl.to(robot.root.position, { x: -2.65, z: 0.3, duration: 0.85, ease: 'power2.inOut' })
      .to(robot.hookPivot.rotation, { z: 0.25, duration: 0.25 })
      .to(robot.cable.scale, { y: 1.9, duration: 0.4 }, '<')
      .to(robot.hook.position, { y: -2.55, x: -1.1, duration: 0.4 }, '<')
      .to(props.gratePrize.position, { x: -2.75, y: 1.05, z: 0.3, duration: 0.28, ease: 'steps(4)' })
      .to(cameraState, { fov: 24, duration: 0.18 }, '<')
      .to(robot.cable.scale, { y: 1, duration: 0.35 }, '<')
      .to(robot.hook.position, { y: -1.58, x: 0, duration: 0.35 }, '<');
  } else if (sceneDef.id === 'scanner') {
    tl.to(robot.scannerPivot.rotation, { y: Math.PI * 2, duration: 1.15, ease: 'none' })
      .to(robot.scannerDish.scale, { x: 1.4, z: 1.4, duration: 0.25, yoyo: true, repeat: 3 }, 0.15)
      .to(props.decoy.rotation, { y: Math.PI * 0.5, duration: 0.5 }, 0.25)
      .to(props.mantlePrize.position, { y: props.mantlePrize.position.y + 0.12, duration: 0.3, yoyo: true, repeat: 2 }, 0.45);
  } else if (sceneDef.id === 'egg') {
    tl.to(robot.root.position, { x: 1.5, z: 2.1, duration: 1.0, ease: 'power1.inOut' })
      .to(props.egg.position, { x: 1.5, y: 2.22, z: 2.1, duration: 0.7, ease: 'power1.inOut' })
      .to(cameraState, { fov: 26, duration: 0.25 }, '-=0.45')
      .to(robot.root.position, { x: 0.1, z: 4.2, duration: 1.6, ease: 'power1.inOut' })
      .to(props.egg.position, { x: 0.1, y: 2.22, z: 4.3, duration: 1.6, ease: 'power1.inOut' }, '<')
      .to(props.egg.position, { x: 0.0, y: 1.82, z: 5.35, duration: 0.6, ease: 'power1.out' });
  } else if (sceneDef.id === 'heavy') {
    tl.to(robot.root.position, { x: -1.2, z: -1.8, duration: 0.75 })
      .to(props.crate.position, { x: -0.2, y: 0.62, z: -1.3, duration: 0.55 }, '-=0.1')
      .to(robot.root.position, { x: 2.4, z: -0.8, duration: 0.85 })
      .to(props.crate.position, { x: 3.3, y: 0.48, z: -0.3, duration: 0.4 });
  } else if (sceneDef.id === 'dash') {
    tl.to(robot.root.position, { x: -3.4, z: 2.6, duration: 0.4, ease: 'power3.out' })
      .to(robot.root.position, { x: 2.8, z: 1.1, duration: 0.45, ease: 'power3.in' })
      .to(robot.root.rotation, { y: 0.25, duration: 0.18, yoyo: true, repeat: 1 }, 0.18);
  } else if (sceneDef.id === 'verify') {
    tl.to(robot.root.position, { x: 0.9, z: -0.15, duration: 0.5 })
      .to(robot.scannerDish.scale, { x: 1.65, z: 1.65, duration: 0.35, yoyo: true, repeat: 1 })
      .to(robot.armBase.rotation, { z: -0.72, duration: 0.3 })
      .to(robot.forearmPivot.rotation, { z: 0.12, duration: 0.3 }, '<')
      .to(props.decoy.rotation, { x: 0.65, duration: 0.3 }, '-=0.08');
  } else if (sceneDef.id === 'balanced') {
    tl.to(robot.root.position, { x: 1.3, z: -1.3, duration: 0.55 })
      .to(robot.root.position, { x: 2.4, z: 0.65, duration: 0.7 })
      .to(robot.root.position, { x: 0.4, z: 1.4, duration: 0.45 });
  } else if (sceneDef.id === 'fail') {
    tl.to(robot.root.position, { x: 0.65, z: -0.22, duration: 0.35 })
      .to(props.decoy.rotation, { z: 1.2, duration: 0.2 }, '-=0.05')
      .to(cameraState, { fov: 28, duration: 0.15 }, '<')
      .to(robot.root.rotation, { z: 0.18, duration: 0.15, yoyo: true, repeat: 3 }, '-=0.08')
      .to(robot.root.position, { x: -0.55, z: 0.45, duration: 0.5 });
  } else if (sceneDef.id === 'finale') {
    tl.to(robot.root.position, { y: 0.18, duration: 0.28, yoyo: true, repeat: 1 })
      .to(robot.root.rotation, { y: Math.PI * 2, duration: 1.2, ease: 'power1.inOut' }, 0)
      .to(robot.scannerDish.scale, { x: 1.35, z: 1.35, duration: 0.22, yoyo: true, repeat: 3 }, 0.15);
  }

  return new Promise((resolve) => { tl.eventCallback('onComplete', resolve); });
}

function openMissionModal(team) {
  const { THREE } = window;
  const modal = document.getElementById('mission-modal');
  const title = document.getElementById('mission-modal-title');
  const statusEl = document.getElementById('mission-modal-status');
  const canvas = document.getElementById('mission-canvas');
  const closeBtn = document.getElementById('mission-modal-close');

  title.textContent = `${team.name} — Mission Run`;
  title.style.color = team.accent;
  statusEl.textContent = 'Entering arena…';
  modal.classList.remove('is-hidden');

  const W = canvas.parentElement.clientWidth - 48 || 600;
  const H = Math.round(W * 0.56);
  canvas.width = W;
  canvas.height = H;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 60);
  camera.position.set(-5.6, 7.8, 9.5);

  scene.add(new THREE.AmbientLight(0x334466, 0.85));
  const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.3);
  keyLight.position.set(6, 10, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const rim = new THREE.PointLight(0xff925c, 1.1, 30);
  rim.position.set(-8, 6, -8);
  scene.add(rim);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x10203b, metalness: 0.15, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 14), floorMat);
  floor.receiveShadow = true;
  floor.position.y = -0.4;
  scene.add(floor);
  const grid = new THREE.GridHelper(18, 18, 0x5cecff, 0x173250);
  grid.position.y = 0.02;
  scene.add(grid);

  const mantle = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.45, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x73553d, roughness: 0.85 }),
  );
  mantle.position.set(4.6, 2.8, -3.6);
  mantle.castShadow = true;
  scene.add(mantle);

  const grate = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 2.8, 5),
    new THREE.MeshStandardMaterial({ color: 0x40566d, metalness: 0.65, roughness: 0.4 }),
  );
  grate.position.set(-4.5, 1.5, 0);
  scene.add(grate);
  for (let i = -2; i <= 2; i += 1) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.3, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x7d95ab, metalness: 0.75, roughness: 0.3 }),
    );
    bar.position.set(-4.3, 1.5, i);
    scene.add(bar);
  }

  const waiterWindow = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.3, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xeed9aa, emissive: 0x674318, emissiveIntensity: 0.4 }),
  );
  waiterWindow.position.set(0, 1.8, 5.4);
  scene.add(waiterWindow);

  const atmoGeo = new THREE.BufferGeometry();
  const atmoPos = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i += 1) {
    atmoPos[i * 3] = (Math.random() - 0.5) * 30;
    atmoPos[i * 3 + 1] = Math.random() * 4 + 5.5;
    atmoPos[i * 3 + 2] = -8 - Math.random() * 14;
  }
  atmoGeo.setAttribute('position', new THREE.BufferAttribute(atmoPos, 3));
  const atmosphere = new THREE.Points(atmoGeo, new THREE.PointsMaterial({ color: 0x77f2ed, size: 0.08, transparent: true, opacity: 0.28, depthWrite: false }));
  scene.add(atmosphere);

  const robot = buildArenaRobot(scene, team.config, team.accent);
  const props = buildArenaProps(scene);

  const target = new THREE.Vector3(0, 1.5, 0);
  const cameraState = { position: camera.position.clone(), target: target.clone(), fov: 42 };
  applyMissionCamera('third', cameraState);

  const clock = new THREE.Clock();
  let mAnimId;
  function mLoop() {
    mAnimId = requestAnimationFrame(mLoop);
    const t = clock.getElapsedTime();
    robot.wheels.forEach((wheel, i) => { wheel.children[0].rotation.y += 0.042 + (i % 2) * 0.004; });
    robot.bobGroup.position.y = Math.sin(t * 2.6) * 0.06;
    robot.legs.forEach(({ group, phase }) => {
      const swing = Math.sin(t * 6 + phase) * 0.28;
      group.rotation.x = swing;
      group.children[0].position.y = -0.28 + Math.abs(swing) * 0.12;
    });
    robot.treads.forEach((sg) => {
      sg.children.forEach((pad, i) => {
        pad.position.z = -0.45 + ((i * 0.18 + t * 0.4) % 1.26) - 0.63;
      });
    });
    atmosphere.rotation.y += 0.0008;
    camera.position.lerp(cameraState.position, 0.08);
    target.lerp(cameraState.target, 0.08);
    camera.fov += (cameraState.fov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  mLoop();

  function cleanup() {
    cancelAnimationFrame(mAnimId);
    renderer.dispose();
    modal.classList.add('is-hidden');
  }

  closeBtn.addEventListener('click', cleanup, { once: true });

  modal.querySelectorAll('.mission-cam-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.mission-cam-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      applyMissionCamera(btn.dataset.cam, cameraState);
    });
  });

  (async () => {
    const scenes = buildSceneList(team.config);
    for (const sceneDef of scenes) {
      statusEl.textContent = sceneDef.title;
      // eslint-disable-next-line no-await-in-loop
      await playArenaScene(sceneDef, robot, props, cameraState);
    }
    statusEl.textContent = 'Mission complete!';
    applyMissionCamera('third', cameraState);
  })();
}

document.addEventListener('click', (e) => {
  const watchBtn = e.target.closest('.medal-watch-btn');
  if (!watchBtn) return;
  const place = Number(watchBtn.dataset.place);
  const team = activeTeams.find((t) => t.place === place);
  if (team) openMissionModal(team);
});

// ── Debug panel — only shown with ?debug=1 ─────────────────────────────────
if (AIO_BASE && (params.get('debug') === '1' || params.get('debug') === 'true')) {
  const bar = document.createElement('div');
  bar.className = 'debug-bar';
  bar.innerHTML = `
    <span class="debug-bar-label">DEBUG</span>
    <button class="debug-btn" data-mode="seed">Seed</button>
    <button class="debug-btn" data-mode="inspect">Inspect</button>
    <button class="debug-btn" data-mode="reset">Reset</button>
  `;
  document.body.appendChild(bar);
  bar.addEventListener('click', async (e) => {
    const btn = e.target.closest('.debug-btn');
    if (!btn) return;
    const body = btn.dataset.mode === 'reset' ? { duration: gameDuration } : null;
    const result = await aioFetch(btn.dataset.mode, body);
    // eslint-disable-next-line no-console
    console.log(`[debug:${btn.dataset.mode}]`, result);
    if (btn.dataset.mode === 'inspect' || btn.dataset.mode === 'seed') {
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(result, null, 2));
    } else if (btn.dataset.mode === 'reset') {
      // eslint-disable-next-line no-alert
      alert('State reset. Reload the page to restart.');
    }
  });
}

init();
