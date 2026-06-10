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

function runAssignPhase() { /* placeholder */ }
function runCountdownPhase() { /* placeholder */ }
function runVotePhase() { /* placeholder */ }
function runLobbyPhase() { /* placeholder */ }
function runArenaPhase() { /* placeholder */ }

document.addEventListener('click', (e) => {
  if (e.target.id === 'replay-experience') {
    localStorage.removeItem('ai-club:pitTeamSlug');
    window.location.href = `${window.location.pathname}?resetTeam=1`;
  }
});

init();
