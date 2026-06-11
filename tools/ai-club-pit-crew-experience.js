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

async function runPodiumSequence() { /* implemented in Task 8 */ }

function showFinalLeaderboard() { /* implemented in Task 9 */ }

document.addEventListener('click', (e) => {
  if (e.target.id === 'replay-experience') {
    localStorage.removeItem('ai-club:pitTeamSlug');
    window.location.href = `${window.location.pathname}?resetTeam=1`;
  }
});

init();
