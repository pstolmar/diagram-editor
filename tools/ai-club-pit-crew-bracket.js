import {
  computeScoreFromConfig, buildSceneList, applyMissionCamera, playArenaScene,
  buildPodiumRobot, setupArena, startArenaLoop, spawnConfetti,
} from '/tools/ai-club-arena.js';

// ── Demo teams (SEED_BUILDS with actual scores) ───────────────────────────────
const DEMO_TEAMS = [
  {
    slug: 'context-window-warriors', name: 'Context Window Warriors', accent: '#9cf7b2',
    config: { mobility: 'balanced-treads', utility: 'robot-arm', care: 'stabilizer', brain: 'structured-thinker' },
  },
  {
    slug: 'prompt-engineers', name: 'Prompt Engineers', accent: '#77f2ed',
    config: { mobility: 'scout-legs', utility: 'robot-arm', care: 'stabilizer', brain: 'verifier' },
  },
  {
    slug: 'llm-dreamers', name: 'LLM Dreamers', accent: '#6ca7ff',
    config: { mobility: 'balanced-treads', utility: 'grapple-hook', care: 'cushion-mount', brain: 'structured-thinker' },
  },
  {
    slug: 'mixture-of-experts', name: 'Mixture of Experts', accent: '#c3a3ff',
    config: { mobility: 'heavy-lift', utility: 'suction-cup', care: 'none', brain: 'fast-guesser' },
  },
  {
    slug: 'agents-of-chaos', name: 'Agents of Chaos', accent: '#ff925c',
    config: { mobility: 'scout-legs', utility: 'grapple-hook', care: 'stabilizer', brain: 'verifier' },
  },
  {
    slug: 'search-party', name: 'Search Party', accent: '#ffb4eb',
    config: { mobility: 'balanced-treads', utility: 'robot-arm', care: 'cushion-mount', brain: 'structured-thinker' },
  },
  {
    slug: 'token-titans', name: 'Token Titans', accent: '#ffe082',
    config: { mobility: 'heavy-lift', utility: 'robot-arm', care: 'stabilizer', brain: 'verifier' },
  },
  {
    slug: 'the-verifiers', name: 'The Verifiers', accent: '#d3ff70',
    config: { mobility: 'scout-legs', utility: 'suction-cup', care: 'none', brain: 'fast-guesser' },
  },
].map((t) => ({ ...t, score: computeScoreFromConfig(t.config) }));

let activeTeams = DEMO_TEAMS;

const LS_TEAM_KEY = 'ai-club:bracketTeamSlug';

function getOrAssignTeam() {
  if (params.get('resetTeam') === '1') localStorage.removeItem(LS_TEAM_KEY);
  let slug = localStorage.getItem(LS_TEAM_KEY);
  if (!slug) {
    const idx = Math.floor(Math.random() * DEMO_TEAMS.length);
    slug = DEMO_TEAMS[idx].slug;
    localStorage.setItem(LS_TEAM_KEY, slug);
  }
  return DEMO_TEAMS.find((t) => t.slug === slug) || DEMO_TEAMS[0];
}

const state = { phase: 'assign', team: null, votes: {} };

const params = new URLSearchParams(window.location.search);
const gameDuration = params.get('voting') === 'short' ? 120 : 300;
const upgradeAnimations = params.get('upgradeAnimations') === '1'; // TODO: per-scene upgrades

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
  if (next) { next.classList.add('is-active'); state.phase = name; }
}

// ── Build groups (same order as challenge) ────────────────────────────────────
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

// ── Phase runners ─────────────────────────────────────────────────────────────

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
    lockBtn.disabled = !BUILD_GROUPS.every((g) => state.votes[g.id]);
  }

  function applyVotesToTeam() {
    const config = {
      mobility: state.votes.mobility || 'balanced-treads',
      utility:  state.votes.utility  || 'robot-arm',
      care:     state.votes.care     || 'cushion-mount',
      brain:    state.votes.brain    || 'structured-thinker',
    };
    state.team = { ...state.team, config, score: computeScoreFromConfig(config) };
  }

  function autoLockAndAdvance() {
    cleanupPreview();
    BUILD_GROUPS.forEach((g) => { if (!state.votes[g.id]) state.votes[g.id] = g.options[0].id; });
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
    if (secs <= 0) { clearInterval(timerInterval); autoLockAndAdvance(); }
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
  const quizContainer = document.getElementById('lobby-quiz-container');
  const lobbyHint = document.querySelector('.lobby-hint');

  document.getElementById('lobby-presence').textContent = '';
  window.gsap.to(bar, { width: '100%', duration: totalMs / 1000, ease: 'none' });
  const countdownEl = document.getElementById('lobby-countdown');
  if (countdownEl) {
    const endMs = Date.now() + totalMs;
    const tickCountdown = () => {
      const rem = Math.max(endMs - Date.now(), 0);
      const m = Math.floor(rem / 60000);
      const s = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
      countdownEl.textContent = `${m}:${s}`;
    };
    tickCountdown();
    const cdInterval = setInterval(() => { tickCountdown(); if (Date.now() >= endMs) clearInterval(cdInterval); }, 1000);
  }

  let quizInProgress = false;
  let quizSettled = false;
  let quizDoneResolve = null;
  const quizDonePromise = new Promise((res) => { quizDoneResolve = res; });

  document.getElementById('lobby-quiz-offer').classList.add('is-hidden');
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

  let hasAdvanced = false;
  async function doAdvance() {
    if (hasAdvanced) return;
    hasAdvanced = true;
    aioFetch('advance', { teamSlug: state.team.slug });

    if (quizInProgress && !fast) {
      const skipBanner = document.createElement('div');
      skipBanner.className = 'lobby-skip-banner';
      skipBanner.innerHTML = `
        <span>All teams are ready!</span>
        <button class="pit-btn pit-btn--primary lobby-skip-btn" type="button">Go to Bracket →</button>
      `;
      quizContainer.prepend(skipBanner);
      skipBanner.querySelector('.lobby-skip-btn').addEventListener('click', () => {
        if (!quizSettled) { quizSettled = true; quizDoneResolve(null); }
      }, { once: true });
      await quizDonePromise;
      skipBanner.remove();
      if (!quizInProgress) await new Promise((r) => { setTimeout(r, 2000); });
    } else {
      if (!quizSettled) { quizSettled = true; quizDoneResolve(null); }
    }

    counter.closest('.lobby-social').textContent = '⚡ All teams locked in — loading bracket…';
    await new Promise((r) => { setTimeout(r, 800); });
    goToPhase('bracket');
    runBracketPhase();
  }

  if (AIO_BASE) {
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

// ── Bracket logic ─────────────────────────────────────────────────────────────

function computeBracket(teams) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  if (sorted.length % 2 !== 0) {
    sorted.push({ slug: 'bye', name: 'BYE', score: -1, config: null, accent: '#444' });
  }
  const n = sorted.length;
  return Array.from({ length: n / 2 }, (_, i) => ({
    left: sorted[i],
    right: sorted[n - 1 - i],
    seed1: i + 1,
    seed2: n - i,
  }));
}

function renderBracketOverview(matches, roundLabel) {
  const eyebrow = document.getElementById('bracket-eyebrow');
  const title = document.getElementById('bracket-title');
  const container = document.getElementById('bracket-matchups');
  const mySlug = state.team.slug;

  eyebrow.textContent = 'Tournament Bracket';
  title.textContent = roundLabel;

  container.innerHTML = matches.map((m) => {
    const isMyMatch = m.left.slug === mySlug || m.right.slug === mySlug;
    const leftBye = m.left.slug === 'bye';
    const rightBye = m.right.slug === 'bye';
    return `
      <div class="bracket-matchup-row${isMyMatch ? ' is-my-match' : ''}">
        <span class="bracket-seed">#${m.seed1}</span>
        <span class="bracket-team-name" style="color:${m.left.accent}">${m.left.name}</span>
        <span class="bracket-vs">vs</span>
        ${rightBye
    ? '<span class="bracket-bye">BYE</span>'
    : `<span class="bracket-team-name" style="color:${m.right.accent}">${m.right.name}</span>
           <span class="bracket-seed">#${m.seed2}</span>`
}
      </div>
    `;
  }).join('');
}

async function runBracketPhase() {
  // Load live results if AIO is configured
  if (AIO_BASE) {
    const status = await aioFetch('status');
    if (status?.results) {
      const live = Object.entries(status.results)
        .filter(([, r]) => r.actualBuild && r.score > 0)
        .map(([slug, r]) => {
          const base = DEMO_TEAMS.find((t) => t.slug === slug) || { slug, accent: '#77f2ed' };
          return { ...base, name: r.teamName || base.name, config: r.actualBuild, score: r.score };
        });
      if (live.length) {
        activeTeams = live;
        const myLive = live.find((t) => t.slug === state.team.slug);
        if (myLive) state.team = myLive;
      }
    }
  } else {
    // In dev mode, update my team score from their voted config
    const myInActive = activeTeams.find((t) => t.slug === state.team.slug);
    if (myInActive && state.team.config) {
      const idx = activeTeams.indexOf(myInActive);
      activeTeams[idx] = { ...myInActive, config: state.team.config, score: state.team.score };
      state.team = activeTeams[idx];
    }
  }

  const matches = computeBracket(activeTeams);
  renderBracketOverview(matches, 'Round 1 Matchups');

  await new Promise((resolve) => {
    document.getElementById('bracket-start').addEventListener('click', resolve, { once: true });
  });

  const bracketLog = [];
  await runTournament(matches, 1, bracketLog);
}

async function runTournament(matches, roundNum, bracketLog) {
  const winners = [];

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    // eslint-disable-next-line no-await-in-loop
    const winner = await playMatch(m.left, m.right, roundNum, i + 1, matches.length);
    winners.push(winner);
    bracketLog.push({ round: roundNum, left: m.left, right: m.right, winner });
  }

  if (winners.length === 1) {
    runChampionPhase(winners[0], bracketLog);
    return;
  }

  // Pair winners for next round: re-seed by score
  const nextMatches = computeBracket(winners.filter((w) => w.slug !== 'bye'));

  // Show next round bracket overview
  const roundLabel = `Round ${roundNum + 1} Matchups`;
  renderBracketOverview(nextMatches, roundLabel);
  goToPhase('bracket');

  await new Promise((resolve) => {
    const btn = document.getElementById('bracket-start');
    btn.textContent = `Start Round ${roundNum + 1}`;
    btn.addEventListener('click', resolve, { once: true });
  });

  await runTournament(nextMatches, roundNum + 1, bracketLog);
}

async function playMatch(leftTeam, rightTeam, roundNum, matchNum, totalMatches) {
  goToPhase('match');

  // Handle bye match
  if (rightTeam.slug === 'bye' || leftTeam.slug === 'bye') {
    const winner = leftTeam.slug === 'bye' ? rightTeam : leftTeam;
    await showByeMatch(leftTeam, rightTeam, roundNum, matchNum, totalMatches);
    return winner;
  }

  document.getElementById('match-round-text').textContent = `Round ${roundNum}`;
  document.getElementById('match-number-text').textContent = `Match ${matchNum} of ${totalMatches}`;

  const nameLeft = document.getElementById('match-name-left');
  const nameRight = document.getElementById('match-name-right');
  const scoreLeft = document.getElementById('match-score-left');
  const scoreRight = document.getElementById('match-score-right');
  const sideLeft = document.getElementById('match-side-left');
  const sideRight = document.getElementById('match-side-right');
  const resultLeft = document.getElementById('match-result-left');
  const resultRight = document.getElementById('match-result-right');
  const countdownLabel = document.getElementById('match-countdown-label');
  const canvasLeft = document.getElementById('match-canvas-left');
  const canvasRight = document.getElementById('match-canvas-right');
  const mySlug = state.team.slug;

  // Reset state from previous match
  sideLeft.classList.remove('is-winner', 'is-loser', 'is-my-team');
  sideRight.classList.remove('is-winner', 'is-loser', 'is-my-team');
  resultLeft.className = 'match-result-badge';
  resultRight.className = 'match-result-badge';
  resultLeft.textContent = '';
  resultRight.textContent = '';
  countdownLabel.textContent = 'VS';
  countdownLabel.classList.remove('is-countdown');

  // Set team names and scores
  nameLeft.textContent = leftTeam.name;
  nameLeft.style.color = leftTeam.accent;
  scoreLeft.textContent = '';
  nameRight.textContent = rightTeam.name;
  nameRight.style.color = rightTeam.accent;
  scoreRight.textContent = '';

  if (leftTeam.slug === mySlug) sideLeft.classList.add('is-my-team');
  if (rightTeam.slug === mySlug) sideRight.classList.add('is-my-team');

  // Yield one frame so the browser flushes layout; canvas.clientWidth is 0 until then
  await new Promise((r) => { requestAnimationFrame(r); });

  const arenaL = setupArena(canvasLeft, leftTeam.config, leftTeam.accent);
  const arenaR = setupArena(canvasRight, rightTeam.config, rightTeam.accent);
  const stopL = startArenaLoop(arenaL);
  const stopR = startArenaLoop(arenaR);

  // Countdown: 3…2…1…FIGHT!
  countdownLabel.classList.add('is-countdown');
  for (const [num, color] of [['3', '#ef4444'], ['2', '#f59e0b'], ['1', '#22c55e']]) {
    countdownLabel.textContent = num;
    countdownLabel.style.color = color;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 900); });
  }
  countdownLabel.textContent = 'FIGHT!';
  countdownLabel.style.color = '#ffd700';
  await new Promise((r) => { setTimeout(r, 400); });
  countdownLabel.textContent = '';
  countdownLabel.classList.remove('is-countdown');

  // Run both missions simultaneously
  const timeScale = params.get('fast') === '1' ? 2.2 : 1;
  const scenesL = buildSceneList(leftTeam.config);
  const scenesR = buildSceneList(rightTeam.config);

  async function runMission(arena, scenes) {
    for (const sceneDef of scenes) {
      // eslint-disable-next-line no-await-in-loop
      await playArenaScene(sceneDef, arena.robot, arena.props, arena.cameraState, timeScale);
    }
    applyMissionCamera('third', arena.cameraState);
  }

  await Promise.all([
    runMission(arenaL, scenesL),
    runMission(arenaR, scenesR),
  ]);

  // Reveal scores
  scoreLeft.textContent = `${leftTeam.score} pts`;
  scoreRight.textContent = `${rightTeam.score} pts`;

  await new Promise((r) => { setTimeout(r, 600); });

  // Determine winner
  const leftWins = leftTeam.score >= rightTeam.score;
  const winner = leftWins ? leftTeam : rightTeam;

  if (leftWins) {
    sideLeft.classList.add('is-winner');
    sideRight.classList.add('is-loser');
    resultLeft.textContent = 'WINNER';
    resultLeft.classList.add('is-winner-badge');
    resultRight.textContent = 'ELIMINATED';
    resultRight.classList.add('is-loser-badge');
    spawnConfetti([0, 50]);
  } else {
    sideRight.classList.add('is-winner');
    sideLeft.classList.add('is-loser');
    resultRight.textContent = 'WINNER';
    resultRight.classList.add('is-winner-badge');
    resultLeft.textContent = 'ELIMINATED';
    resultLeft.classList.add('is-loser-badge');
    spawnConfetti([50, 100]);
  }

  await new Promise((r) => { setTimeout(r, params.get('fast') === '1' ? 1500 : 3500); });

  stopL();
  stopR();
  arenaL.renderer.dispose();
  arenaR.renderer.dispose();

  return winner;
}

async function showByeMatch(leftTeam, rightTeam, roundNum, matchNum, totalMatches) {
  document.getElementById('match-round-text').textContent = `Round ${roundNum}`;
  document.getElementById('match-number-text').textContent = `Match ${matchNum} of ${totalMatches}`;

  const activeSide = leftTeam.slug === 'bye' ? 'right' : 'left';
  const winnerId = activeSide === 'left' ? 'match-side-left' : 'match-side-right';

  document.getElementById('match-name-left').textContent = leftTeam.slug === 'bye' ? 'BYE' : leftTeam.name;
  document.getElementById('match-name-left').style.color = leftTeam.slug === 'bye' ? '#444' : leftTeam.accent;
  document.getElementById('match-name-right').textContent = rightTeam.slug === 'bye' ? 'BYE' : rightTeam.name;
  document.getElementById('match-name-right').style.color = rightTeam.slug === 'bye' ? '#444' : rightTeam.accent;
  document.getElementById('match-score-left').textContent = '';
  document.getElementById('match-score-right').textContent = '';
  document.getElementById('match-countdown-label').textContent = 'BYE';

  ['match-side-left', 'match-side-right'].forEach((id) => {
    document.getElementById(id).classList.remove('is-winner', 'is-loser', 'is-my-team');
  });

  document.getElementById(winnerId).classList.add('is-winner');
  document.getElementById(winnerId === 'match-side-left' ? 'match-side-right' : 'match-side-left').classList.add('is-loser');
  document.getElementById(activeSide === 'left' ? 'match-result-left' : 'match-result-right').textContent = 'ADVANCES';
  document.getElementById(activeSide === 'left' ? 'match-result-left' : 'match-result-right').classList.add('is-winner-badge');

  await new Promise((r) => { setTimeout(r, params.get('fast') === '1' ? 1000 : 2500); });
}

async function runChampionPhase(champion, bracketLog) {
  goToPhase('champion');

  const nameEl = document.getElementById('champion-name');
  const scoreEl = document.getElementById('champion-score');
  const canvas = document.getElementById('champion-canvas');
  const recapEl = document.getElementById('bracket-recap');

  nameEl.textContent = champion.name;
  nameEl.style.color = champion.accent;
  scoreEl.textContent = `${champion.score} pts`;

  // Robot animation
  const cW = Math.min(400, window.innerWidth - 48);
  const cH = Math.round(cW * 0.56);
  canvas.width = cW;
  canvas.height = cH;

  const { THREE } = window;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(cW, cH, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, cW / cH, 0.1, 30);
  camera.position.set(2.6, 2.8, 4.2);
  camera.lookAt(0, 1.2, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const fill = new THREE.PointLight(new THREE.Color(champion.accent), 1.0, 20);
  fill.position.set(-3, 4, 3);
  scene.add(fill);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x0d1a2a, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const robot = buildPodiumRobot(champion.config, scene, champion.accent);
  let angle = 0;
  let animId;
  function loop() {
    animId = requestAnimationFrame(loop);
    angle += 0.012;
    robot.root.rotation.y = angle;
    renderer.render(scene, camera);
  }
  loop();

  spawnConfetti();

  // Recap
  const rounds = [...new Set(bracketLog.map((e) => e.round))];
  recapEl.innerHTML = rounds.map((r) => {
    const roundMatches = bracketLog.filter((e) => e.round === r);
    return `
      <div class="bracket-recap-round">Round ${r}</div>
      ${roundMatches.map((m) => `
        <div class="bracket-recap-match">
          <span class="bracket-recap-winner" style="color:${m.winner.accent}">${m.winner.name}</span>
          <span class="bracket-recap-score">def.</span>
          <span class="bracket-recap-loser">${m.winner.slug === m.left.slug ? m.right.name : m.left.name}</span>
        </div>
      `).join('')}
    `;
  }).join('');

  void animId;
}

// ── AIO debug panel — only shown with ?debug=1 ───────────────────────────────
if (AIO_BASE && (params.get('debug') === '1' || params.get('debug') === 'true')) {
  const bar = document.createElement('div');
  bar.className = 'debug-bar';
  bar.innerHTML = `
    <span class="debug-bar-label">DEBUG</span>
    <button class="debug-btn" data-mode="seed" type="button">Seed</button>
    <button class="debug-btn" data-mode="inspect" type="button">Inspect</button>
    <button class="debug-btn" data-mode="reset" type="button">Reset</button>
  `;
  document.body.appendChild(bar);
  bar.addEventListener('click', async (e) => {
    const btn = e.target.closest('.debug-btn');
    if (!btn) return;
    const body = btn.dataset.mode === 'reset' ? { duration: gameDuration } : null;
    const result = await aioFetch(btn.dataset.mode, body);
    console.log(`[debug:${btn.dataset.mode}]`, result);
    if (btn.dataset.mode === 'inspect' || btn.dataset.mode === 'seed') {
      alert(JSON.stringify(result, null, 2));
    } else if (btn.dataset.mode === 'reset') {
      alert('State reset. Reload the page to restart.');
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  state.team = getOrAssignTeam();

  if (AIO_BASE) {
    const joined = await aioFetch('join');
    if (joined?.teamSlug) {
      const base = DEMO_TEAMS.find((t) => t.slug === joined.teamSlug) || { slug: joined.teamSlug, accent: '#77f2ed' };
      state.team = { ...base, name: joined.teamName || base.name };
      sessionStorage.setItem('ai-club:bracketSession', JSON.stringify({
        teamSlug: joined.teamSlug, teamName: state.team.name,
      }));
    }
    const serverStatus = await aioFetch('status');
    if (serverStatus?.expiresAt) {
      state.serverExpiresAt = serverStatus.expiresAt;
      state.serverPhase = serverStatus.phase;
    }
  }

  const startPhase = params.get('startPhase') || 'assign';
  goToPhase(startPhase);
  if (startPhase === 'assign') runAssignPhase();
  else if (startPhase === 'countdown') runCountdownPhase();
  else if (startPhase === 'vote') runVotePhase();
  else if (startPhase === 'lobby') runLobbyPhase();
  else if (startPhase === 'bracket') runBracketPhase();
}

init();
