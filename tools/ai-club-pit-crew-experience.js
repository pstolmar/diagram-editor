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
