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

function goToPhase(name) {
  const current = document.querySelector('.pit-phase.is-active');
  if (current) current.classList.remove('is-active');
  const next = document.querySelector(`[data-phase="${name}"]`);
  if (next) {
    next.classList.add('is-active');
    state.phase = name;
  }
}

function init() {
  const params = new URLSearchParams(window.location.search);
  state.team = getOrAssignTeam();
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

  let secs = 300;
  const timerEl = document.getElementById('vote-timer');
  const timerInterval = setInterval(() => {
    secs -= 1;
    if (secs <= 0) { clearInterval(timerInterval); return; }
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
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
  });

  lockBtn.addEventListener('click', () => {
    if (Object.keys(state.votes).length < BUILD_GROUPS.length) return;
    clearInterval(timerInterval);
    goToPhase('lobby');
    runLobbyPhase();
  });
}
function runLobbyPhase() {
  const params = new URLSearchParams(window.location.search);
  const fast = params.get('fastLobby') === '1';
  const totalMs = fast ? 2000 : 12000;

  const bar = document.getElementById('lobby-bar');
  const counter = document.getElementById('teams-locked-count');
  const quizOffer = document.getElementById('lobby-quiz-offer');
  const quizContainer = document.getElementById('lobby-quiz-container');
  const lobbyHint = document.querySelector('.lobby-hint');
  const presenceEl = document.getElementById('lobby-presence');

  // ── Presence heartbeat (localStorage cross-tab) ──
  const presenceKey = `ai-club:lobbyPresence:${crypto.randomUUID()}`;
  function writePresence() {
    localStorage.setItem(presenceKey, String(Date.now()));
  }
  function readPresenceCount() {
    const now = Date.now();
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ai-club:lobbyPresence:')) {
        const ts = Number(localStorage.getItem(k));
        if (now - ts < 15000) count += 1;
      }
    }
    return count;
  }
  writePresence();
  const presenceInterval = setInterval(() => {
    writePresence();
    const n = readPresenceCount();
    presenceEl.textContent = n > 1 ? `~${n} players in lobby right now` : '';
  }, 3000);
  window.addEventListener('beforeunload', () => localStorage.removeItem(presenceKey), { once: true });

  // ── Fake team trickle ──
  // Natural-variance delays: 7 more teams to lock in across totalMs
  const fractions = [0.08, 0.18, 0.30, 0.44, 0.57, 0.70, 0.84];
  let locked = 1;
  const trickleTimeouts = fractions.map((frac) => setTimeout(() => {
    locked += 1;
    counter.textContent = locked;
    counter.closest('.lobby-social').classList.add('lobby-pulse');
    setTimeout(() => counter.closest('.lobby-social').classList.remove('lobby-pulse'), 400);
  }, frac * totalMs));

  // ── Progress bar ──
  window.gsap.to(bar, { width: '100%', duration: totalMs / 1000, ease: 'none' });

  // ── Quiz offer (after 4s, or 0.6s in fast mode) ──
  const quizDelay = fast ? 600 : 4000;
  let quizInProgress = false;
  let quizSettled = false;
  let quizDoneResolve = null;
  const quizDonePromise = new Promise((res) => { quizDoneResolve = res; });

  const quizOfferTimeout = setTimeout(() => {
    quizOffer.classList.remove('is-hidden');
    window.gsap.from(quizOffer, { y: 12, opacity: 0, duration: 0.4 });

    document.getElementById('start-quiz-btn').addEventListener('click', async () => {
      quizOffer.classList.add('is-hidden');
      lobbyHint.classList.add('is-hidden');
      quizContainer.classList.remove('is-hidden');
      quizInProgress = true;

      // Dynamically import the quiz module and init it
      const { initQuiz } = await import('/tools/ai-club-quiz.js');
      const questions = await fetch('/tools/ai-club-quiz-data.json').then((r) => r.json());
      initQuiz(quizContainer, questions, {
        onComplete: (score, total) => {
          quizInProgress = false;
          if (!quizSettled) { quizSettled = true; quizDoneResolve({ score, total }); }
        },
      });
    }, { once: true });

    document.getElementById('skip-quiz-btn').addEventListener('click', () => {
      quizOffer.classList.add('is-hidden');
      if (!quizSettled) { quizSettled = true; quizDoneResolve(null); }
    }, { once: true });
  }, quizDelay);

  // ── Auto-advance after totalMs + 2s dramatic pause ──
  const advanceTimeout = setTimeout(async () => {
    // If quiz is still in progress, wait for it to finish
    if (quizInProgress) {
      await quizDonePromise;
      // Show score briefly
      await new Promise((r) => { setTimeout(r, 2500); });
    } else {
      if (!quizSettled) { quizSettled = true; quizDoneResolve(null); }
    }

    // Clean up
    clearInterval(presenceInterval);
    trickleTimeouts.forEach(clearTimeout);
    clearTimeout(quizOfferTimeout);
    localStorage.removeItem(presenceKey);

    // "Loading arena" stinger
    counter.closest('.lobby-social').textContent = '⚡ All teams locked in — loading arena…';
    await new Promise((r) => { setTimeout(r, 800); });

    goToPhase('arena');
    runArenaPhase();
  }, totalMs + 2000);

  // suppress unused variable warning
  void advanceTimeout;
}
async function runArenaPhase() {
  await revealScoreCards();
  await showPodiumBanner();
  await runPodiumSequence();
  showFinalLeaderboard();
}

async function revealScoreCards() {
  const container = document.getElementById('score-reveal-container');
  const nonPodium = FAKE_TEAMS
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
    container.appendChild(card);
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
  container.classList.remove('is-hidden');

  const W = Math.min(window.innerWidth - 32, 800);
  const H = Math.round(W * 0.56);
  canvas.width = W;
  canvas.height = H;

  const { THREE } = window;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 50);
  camera.position.set(0, 3.5, 9);
  camera.lookAt(0, 1, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(4, 8, 5);
  sun.castShadow = true;
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x0d1a2a, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let animFrameId;
  function renderLoop() {
    animFrameId = requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  }
  renderLoop();

  const podiumTeams = FAKE_TEAMS.filter((t) => t.place <= 3).sort((a, b) => b.place - a.place);
  await podiumTeams.reduce((chain, team) => chain.then(async () => {
    await playOnePodiumSlot(team, scene);
    await new Promise((r) => { setTimeout(r, 600); });
  }), Promise.resolve());

  cancelAnimationFrame(animFrameId);
  renderer.dispose();
}

async function playOnePodiumSlot(team, scene) {
  const robot = buildPodiumRobot(team.config, scene, team.accent);
  robot.root.position.y = -4;
  await window.gsap.to(robot.root.position, { y: 0, duration: 0.8, ease: 'back.out(1.2)' });

  if (team.config.utility === 'robot-arm' && robot.armBase) {
    await window.gsap.to(robot.armBase.rotation, { z: -1.0, duration: 0.55, ease: 'power2.inOut' });
    await window.gsap.to(robot.armBase.rotation, { z: 0, duration: 0.4 });
  } else if (team.config.utility === 'grapple-hook') {
    await window.gsap.to(robot.root.rotation, { y: Math.PI * 2, duration: 0.7, ease: 'power2.inOut' });
    robot.root.rotation.y = 0;
  } else {
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

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.9), bodyMat);
  body.position.y = 1.15;
  body.castShadow = true;
  root.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.52, 0.62), darkMat);
  head.position.y = 1.93;
  head.castShadow = true;
  root.add(head);

  const wGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.20, 12);
  const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  [[-0.62, 0.27, 0.5], [0.62, 0.27, 0.5], [-0.62, 0.27, -0.5], [0.62, 0.27, -0.5]].forEach((pos) => {
    const wg = new THREE.Group();
    wg.position.set(...pos);
    wg.rotation.z = Math.PI / 2;
    const w = new THREE.Mesh(wGeo, wMat);
    w.castShadow = true;
    wg.add(w);
    root.add(wg);
  });

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
  }

  scene.add(root);
  return { root, armBase };
}

const PLACE_EMOJIS = ['🥇', '🥈', '🥉'];

function showMedalCard(team) {
  const cardsRow = document.getElementById('podium-medal-cards');
  cardsRow.classList.remove('is-hidden');
  const medalClass = ['gold', 'silver', 'bronze'][team.place - 1];
  const card = document.createElement('div');
  card.className = `medal-card medal-card--${medalClass}`;
  card.innerHTML = `
    <div class="medal-place">${PLACE_EMOJIS[team.place - 1]}</div>
    <div class="medal-team-name">${team.name}</div>
    <div class="medal-score">${team.score} pts</div>
    <div class="medal-config">
      ${Object.values(team.config).map((v) => `<span class="medal-tag">${v.replace(/-/g, ' ')}</span>`).join('')}
    </div>
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
  const sorted = [...FAKE_TEAMS].sort((a, b) => a.place - b.place);
  list.innerHTML = sorted.map((team) => `
    <li class="lb-row${team.place <= 3 ? ' lb-row--podium' : ''}">
      <span class="lb-place">#${team.place}</span>
      <span class="lb-name" style="color:${team.accent}">${team.name}</span>
      <span class="lb-score">${team.score}</span>
    </li>
  `).join('');
  window.gsap.from(finalEl, { opacity: 0, y: 20, duration: 0.5 });
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'replay-experience') {
    localStorage.removeItem('ai-club:pitTeamSlug');
    window.location.href = `${window.location.pathname}?resetTeam=1`;
  }
});

init();
