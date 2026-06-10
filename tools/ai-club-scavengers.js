const DEFAULT_TEAM_DEFS = [
  { slug: 'llm-dreamers', name: 'LLM Dreamers', seed: 11, accent: '#6ca7ff' },
  { slug: 'agents-of-chaos', name: 'Agents of Chaos', seed: 17, accent: '#ff925c' },
  { slug: 'token-titans', name: 'Token Titans', seed: 23, accent: '#d3ff70' },
  { slug: 'prompt-engineers', name: 'Prompt Engineers', seed: 29, accent: '#77f2ed' },
  { slug: 'the-verifiers', name: 'The Verifiers', seed: 31, accent: '#ffe082' },
  { slug: 'search-party', name: 'Search Party', seed: 37, accent: '#ffb4eb' },
  { slug: 'context-window-warriors', name: 'Context Window Warriors', seed: 41, accent: '#9cf7b2' },
  { slug: 'mixture-of-experts', name: 'Mixture of Experts', seed: 47, accent: '#c3a3ff' },
  { slug: 'latency-legends', name: 'Latency Legends', seed: 53, accent: '#6de2a7' },
  { slug: 'toolchain-thunder', name: 'Toolchain Thunder', seed: 59, accent: '#ffdd7a' },
  { slug: 'prompt-pirates', name: 'Prompt Pirates', seed: 61, accent: '#8bd0ff' },
  { slug: 'model-mayhem', name: 'Model Mayhem', seed: 67, accent: '#f7a8ff' },
];

const { gsap } = window;
const DEFAULT_CONFIG_URL = '/tools/ai-club-config.json';
const DEFAULT_EVENT_CONFIG = {
  event: {
    eyebrow: 'Customer Success AI Club',
    title: 'AI Pit Crew Challenge',
    heroCopy: 'Build your team robot, vote on its attachments, and watch it tackle a scavenger mission in the arena.',
    teamIntroTitle: 'Join Your Team',
    teamIntroCopy: 'Each team gets its own bay, democratic vote, and cinematic scavenger run.',
  },
  submitDefaults: {
    mode: 'mock',
    url: '',
    mirrorToMock: false,
  },
  teams: DEFAULT_TEAM_DEFS,
};

const BUILD_GROUPS = [
  {
    id: 'mobility',
    title: 'Mobility',
    description: 'How your robot moves through the arena when time pressure hits.',
    options: [
      {
        id: 'scout-legs',
        title: 'Scout Legs',
        tagline: 'Burst speed',
        description: 'A springy wheel-and-strut setup for racing across the floor.',
        stats: { speed: 3, precision: -1, lift: 0, style: 'speed' },
      },
      {
        id: 'balanced-treads',
        title: 'Balanced Treads',
        tagline: 'Steady all-rounder',
        description: 'Tracks and stabilizers that keep the body planted during tricky maneuvers.',
        stats: { speed: 1, precision: 1, lift: 1, style: 'balanced' },
      },
      {
        id: 'heavy-lift',
        title: 'Heavy Lift Chassis',
        tagline: 'Crate hauler',
        description: 'Slow, strong, and able to bully through heavy-object scenes.',
        stats: { speed: -1, precision: 0, lift: 3, style: 'heavy' },
      },
    ],
  },
  {
    id: 'utility',
    title: 'Agentic Tools',
    description: 'These are your serious attachments: visible proof that tool access unlocks more value.',
    options: [
      {
        id: 'robot-arm',
        title: 'Robot Arm',
        tagline: 'High reach',
        description: 'An articulated arm that stretches up to mantles, ledges, and hidden shelves.',
        stats: { reach: 3, precision: 1, scene: 'high-reach' },
      },
      {
        id: 'grapple',
        title: 'Grappling Hook',
        tagline: 'Barrier breach',
        description: 'A retractable cable and hook for grate, gap, and vent retrieval shots.',
        stats: { reach: 2, utility: 3, scene: 'grapple' },
      },
      {
        id: 'scanner',
        title: 'Search Scanner',
        tagline: 'Hidden item reveal',
        description: 'A swiveling sensor dish that lights up hidden compartments and decoys.',
        stats: { search: 3, precision: 1, scene: 'scanner' },
      },
    ],
  },
  {
    id: 'care',
    title: 'Care Package',
    description: 'How gently the robot handles high-value, fragile, or customer-facing work.',
    options: [
      {
        id: 'stabilizer',
        title: 'Stabilizer Pillow Rig',
        tagline: 'Fragile precision',
        description: 'A tiny pillow cradle and gyro brace to carry eggs, gems, and delicate finds.',
        stats: { precision: 3, risk: -2, scene: 'egg' },
      },
      {
        id: 'mag-clamp',
        title: 'Mag Clamp',
        tagline: 'Heavy confidence',
        description: 'A chunky magnetic clamp for crates, anvils, and treasure boxes.',
        stats: { lift: 2, precision: -1, scene: 'heavy' },
      },
      {
        id: 'default-bin',
        title: 'Basic Cargo Bin',
        tagline: 'Starter kit',
        description: 'The fallback tray. It works, but it is not winning any highlight reels.',
        stats: { precision: 0, lift: 0, scene: 'starter' },
      },
    ],
  },
  {
    id: 'brain',
    title: 'Reasoning Style',
    description: 'This is the prompt posture and validation habit embodied as robot behavior.',
    options: [
      {
        id: 'fast-guesser',
        title: 'Fast Guesser',
        tagline: 'Move now',
        description: 'Rushes into decisions. Great for momentum, dangerous for high-value accuracy.',
        stats: { speed: 2, risk: 3, precision: -2, scene: 'dash' },
      },
      {
        id: 'structured-thinker',
        title: 'Structured Thinker',
        tagline: 'Plan then act',
        description: 'Keeps the mission flowing while still checking the map and attachments.',
        stats: { speed: 1, precision: 1, risk: 0, scene: 'balanced' },
      },
      {
        id: 'verifier',
        title: 'Verifier',
        tagline: 'Trust but verify',
        description: 'Takes a beat, lines up the shot, and avoids the flashy unforced errors.',
        stats: { speed: -1, precision: 3, risk: -3, scene: 'verify' },
      },
    ],
  },
];

const SCENE_LIBRARY = {
  intro: {
    id: 'intro',
    title: 'Warmup Stretch',
    description: 'Your robot pops its suspension, stretches its armature, and bounces into the arena like it means it.',
    camera: 'top',
    score: 0,
  },
  'high-reach': {
    id: 'high-reach',
    title: 'Mantle Grab',
    description: 'The robot arm extends toward the fireplace mantle and plucks the hidden relic cleanly off the ledge.',
    camera: 'cinematic',
    score: 5,
  },
  grapple: {
    id: 'grapple',
    title: 'Hook Through The Grate',
    description: 'Cable out, hook through, spark of contact, then the prize slides back under the bars.',
    camera: 'close',
    score: 6,
  },
  scanner: {
    id: 'scanner',
    title: 'Compartment Reveal',
    description: 'The sensor dish pulses blue and a false wall lights up with a hidden stash behind it.',
    camera: 'top',
    score: 4,
  },
  egg: {
    id: 'egg',
    title: 'Dragon Egg Delivery',
    description: 'The stabilizer lowers a glowing egg onto its tiny pillow cradle and carries it softly to the waiter window.',
    camera: 'close',
    score: 7,
  },
  heavy: {
    id: 'heavy',
    title: 'Crate Heave',
    description: 'The clamp locks on and drags a heavy crate over the line with all the subtlety of a forklift hero shot.',
    camera: 'third',
    score: 5,
  },
  dash: {
    id: 'dash',
    title: 'Conveyor Sprint',
    description: 'A quick burst across the arena grabs a low-value pickup before the door closes.',
    camera: 'third',
    score: 3,
  },
  verify: {
    id: 'verify',
    title: 'Slow Confirm',
    description: 'Reticle. Pause. Check. Then a precise pickup that avoids the decoy entirely.',
    camera: 'close',
    score: 4,
  },
  balanced: {
    id: 'balanced',
    title: 'Clean Traverse',
    description: 'No drama, just a tidy route across the tiles with a practical mid-value pickup.',
    camera: 'top',
    score: 3,
  },
  starter: {
    id: 'starter',
    title: 'Starter Shuffle',
    description: 'The base bin collects a couple of floor pickups, but the premium loot stays out of reach.',
    camera: 'top',
    score: 1,
  },
  fail: {
    id: 'fail',
    title: 'Decoy Wobble',
    description: 'The robot commits too early, grabs a decoy, and loses precious mission time.',
    camera: 'close',
    score: -4,
  },
  finale: {
    id: 'finale',
    title: 'Scoreboard Pose',
    description: 'Lights up, wheels set, little victory bounce. The haul is tallied and the crew gets the bragging rights.',
    camera: 'top',
    score: 0,
  },
  base: {
    id: 'base',
    title: 'Basic Rollaround',
    description: 'No pit crew input means the default bot just rolls around scooping up a few floor scraps.',
    camera: 'third',
    score: 2,
  },
};

const SCENE_ALIASES = {
  '1': 'intro',
  '2': 'high-reach',
  '3': 'grapple',
  '4': 'scanner',
  '5': 'egg',
  '6': 'heavy',
  '7': 'dash',
  '8': 'verify',
  '9': 'fail',
  '10': 'finale',
};

const dom = {
  shell: document.querySelector('.pit-shell'),
  sections: [...document.querySelectorAll('[data-step-section]')],
  eventEyebrow: document.getElementById('event-eyebrow'),
  eventTitle: document.getElementById('event-title'),
  eventHeroCopy: document.getElementById('event-hero-copy'),
  teamIntroTitle: document.getElementById('team-intro-title'),
  teamIntroCopy: document.getElementById('team-intro-copy'),
  teamGrid: document.getElementById('team-grid'),
  teamSlugBadge: document.getElementById('team-slug-badge'),
  activeTeamName: document.getElementById('active-team-name'),
  activeTeamSeed: document.getElementById('active-team-seed'),
  voteGroups: document.getElementById('vote-groups'),
  voteTallies: document.getElementById('vote-tallies'),
  winningBuild: document.getElementById('winning-build'),
  sceneQueue: document.getElementById('scene-queue'),
  projectedScore: document.getElementById('projected-score'),
  serverStatusLabel: document.getElementById('server-status-label'),
  serverStatusDetail: document.getElementById('server-status-detail'),
  previewPayload: document.getElementById('preview-payload'),
  copyPayload: document.getElementById('copy-payload'),
  copyTeamLink: document.getElementById('copy-team-link'),
  submitScore: document.getElementById('submit-score'),
  payloadPanel: document.getElementById('payload-panel'),
  payloadMode: document.getElementById('payload-mode'),
  payloadPreview: document.getElementById('payload-preview'),
  missionLog: document.getElementById('mission-log'),
  startMission: document.getElementById('start-mission'),
  lockBuild: document.getElementById('lock-build'),
  clearVotes: document.getElementById('clear-votes'),
  arenaTitle: document.getElementById('arena-title'),
  cameraChip: document.getElementById('camera-chip'),
  cameraButtons: document.getElementById('camera-buttons'),
  sceneTitle: document.getElementById('scene-title'),
  sceneDescription: document.getElementById('scene-description'),
  canvas: document.getElementById('arena-canvas'),
  debugPanel: document.getElementById('debug-panel'),
  debugQueryReadout: document.getElementById('debug-query-readout'),
  debugSceneReadout: document.getElementById('debug-scene-readout'),
  sceneDebugButtons: document.getElementById('scene-debug-buttons'),
  serverDebugButtons: document.getElementById('server-debug-buttons'),
  submitDebugButtons: document.getElementById('submit-debug-buttons'),
  teamStepLink: document.getElementById('team-step-link'),
  buildStepLink: document.getElementById('build-step-link'),
  missionStepLink: document.getElementById('mission-step-link'),
  arenaStepLink: document.getElementById('arena-step-link'),
  sandboxLink: document.getElementById('sandbox-link'),
};

const state = {
  activeTeam: null,
  personalVotes: {},
  winningBuild: {},
  lastScenes: [],
  lastScore: 0,
  sceneRunning: false,
  arena: null,
  preferredCamera: 'top',
  queryMode: {
    sandbox: false,
    step: '',
    scene: '',
    autorun: false,
    server: 'idle',
    submitMode: 'mock',
    submitUrl: '',
    mirrorToMock: false,
    configUrl: '',
    layout: '',
  },
  appConfig: DEFAULT_EVENT_CONFIG,
};

const LEADERBOARD_STORAGE_KEY = 'ai-club-scavengers:leaderboard';

function currentTeams() {
  return state.appConfig?.teams?.length ? state.appConfig.teams : DEFAULT_TEAM_DEFS;
}

function createSlugLookup() {
  const map = new Map();
  currentTeams().forEach((team) => map.set(team.slug, team));
  return map;
}

function getInitialTeam() {
  const teamLookup = createSlugLookup();
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('team');
  if (slug && teamLookup.has(slug)) return teamLookup.get(slug);
  return currentTeams()[0];
}

function readQueryMode() {
  const params = new URLSearchParams(window.location.search);
  const rawScene = (params.get('scene') || '').toLowerCase();
  return {
    sandbox: params.get('sandbox') === '1',
    step: (params.get('step') || '').toLowerCase(),
    scene: SCENE_ALIASES[rawScene] || rawScene,
    autorun: ['1', 'true', 'yes'].includes((params.get('autorun') || '').toLowerCase()),
    server: (params.get('server') || 'idle').toLowerCase(),
    submitMode: (params.get('submitMode') || '').toLowerCase(),
    submitUrl: params.get('submitUrl') || '',
    mirrorToMock: ['1', 'true', 'yes'].includes((params.get('mirrorToMock') || '').toLowerCase()),
    configUrl: params.get('config') || '',
    layout: (params.get('layout') || '').toLowerCase(),
  };
}

async function loadAppConfig() {
  const configUrl = state.queryMode.configUrl || DEFAULT_CONFIG_URL;
  try {
    const response = await fetch(configUrl);
    if (!response.ok) throw new Error(`Config fetch failed: ${response.status}`);
    const json = await response.json();
    state.appConfig = {
      ...DEFAULT_EVENT_CONFIG,
      ...json,
      event: {
        ...DEFAULT_EVENT_CONFIG.event,
        ...(json.event || {}),
      },
      submitDefaults: {
        ...DEFAULT_EVENT_CONFIG.submitDefaults,
        ...(json.submitDefaults || {}),
      },
      teams: Array.isArray(json.teams) && json.teams.length ? json.teams : DEFAULT_TEAM_DEFS,
    };
  } catch (error) {
    console.error('Failed to load AI Club config:', error);
    state.appConfig = DEFAULT_EVENT_CONFIG;
  }
}

function applyAppConfigToDom() {
  const { event } = state.appConfig;
  dom.eventEyebrow.textContent = event.eyebrow;
  dom.eventTitle.textContent = event.title;
  dom.eventHeroCopy.textContent = event.heroCopy;
  dom.teamIntroTitle.textContent = event.teamIntroTitle;
  dom.teamIntroCopy.textContent = event.teamIntroCopy;
}

function voteStorageKey(teamSlug) {
  return `ai-club-scavengers:${teamSlug}:votes`;
}

function personalVoteKey(teamSlug) {
  return `ai-club-scavengers:${teamSlug}:personal`;
}

function defaultVoteStore() {
  const store = {};
  BUILD_GROUPS.forEach((group) => {
    store[group.id] = {};
    group.options.forEach((option) => {
      store[group.id][option.id] = 0;
    });
  });
  return store;
}

function loadVoteStore(teamSlug) {
  try {
    const raw = localStorage.getItem(voteStorageKey(teamSlug));
    const parsed = raw ? JSON.parse(raw) : {};
    const merged = defaultVoteStore();
    BUILD_GROUPS.forEach((group) => {
      group.options.forEach((option) => {
        const existing = parsed[group.id]?.[option.id];
        if (Number.isFinite(existing)) merged[group.id][option.id] = existing;
      });
    });
    return merged;
  } catch {
    return defaultVoteStore();
  }
}

function saveVoteStore(teamSlug, store) {
  localStorage.setItem(voteStorageKey(teamSlug), JSON.stringify(store));
}

function loadPersonalVotes(teamSlug) {
  try {
    const raw = localStorage.getItem(personalVoteKey(teamSlug));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePersonalVotes(teamSlug) {
  localStorage.setItem(personalVoteKey(teamSlug), JSON.stringify(state.personalVotes));
}

function setActiveTeam(team) {
  state.activeTeam = team;
  state.personalVotes = loadPersonalVotes(team.slug);

  const params = new URLSearchParams(window.location.search);
  params.set('team', team.slug);
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', nextUrl);

  document.documentElement.style.setProperty('--pit-cyan', team.accent);
  dom.teamSlugBadge.textContent = `?team=${team.slug}`;
  dom.activeTeamName.textContent = team.name;
  dom.activeTeamSeed.textContent = `${team.seed}`;

  [...dom.teamGrid.querySelectorAll('.team-card')].forEach((button) => {
    button.classList.toggle('active', button.dataset.teamSlug === team.slug);
  });

  updateHeroLinks();
  renderVoteGroups();
  renderTallies();
  computeWinningBuild();
}

function renderTeamGrid() {
  dom.teamGrid.innerHTML = '';
  currentTeams().forEach((team) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'team-card';
    button.dataset.teamSlug = team.slug;
    button.innerHTML = `
      <strong>${team.name}</strong>
      <span>${team.slug}</span>
    `;
    button.addEventListener('click', () => setActiveTeam(team));
    dom.teamGrid.append(button);
  });
}

function applyStepMode(step) {
  if (!step || step === 'all') {
    dom.sections.forEach((section) => section.classList.remove('is-hidden'));
    return;
  }

  const stepMap = {
    '1': ['hero', 'team', 'arena'],
    team: ['hero', 'team', 'arena'],
    '2': ['hero', 'build', 'arena', 'tally'],
    build: ['hero', 'build', 'arena', 'tally'],
    '3': ['hero', 'mission', 'arena'],
    mission: ['hero', 'mission', 'arena'],
    '4': ['hero', 'arena', 'debug', 'mission'],
    arena: ['hero', 'arena', 'debug', 'mission'],
    debug: ['hero', 'arena', 'debug', 'mission'],
  };

  const visible = new Set(stepMap[step] || ['hero', 'team', 'build', 'mission', 'arena', 'tally', 'debug']);
  dom.sections.forEach((section) => {
    const key = section.dataset.stepSection;
    section.classList.toggle('is-hidden', !visible.has(key));
  });
}

function applyLayoutMode() {
  dom.shell.classList.toggle('focus-step', ['focus', 'single'].includes(state.queryMode.layout));
}

function castVote(groupId, optionId) {
  const teamSlug = state.activeTeam.slug;
  const store = loadVoteStore(teamSlug);
  const previousVote = state.personalVotes[groupId];

  if (previousVote && store[groupId]?.[previousVote] > 0) {
    store[groupId][previousVote] -= 1;
  }

  store[groupId][optionId] += 1;
  saveVoteStore(teamSlug, store);

  state.personalVotes[groupId] = optionId;
  savePersonalVotes(teamSlug);

  renderVoteGroups();
  renderTallies();
  computeWinningBuild();
}

function clearPersonalVotes() {
  const teamSlug = state.activeTeam.slug;
  const store = loadVoteStore(teamSlug);
  Object.entries(state.personalVotes).forEach(([groupId, optionId]) => {
    if (store[groupId]?.[optionId] > 0) {
      store[groupId][optionId] -= 1;
    }
  });
  saveVoteStore(teamSlug, store);
  state.personalVotes = {};
  savePersonalVotes(teamSlug);
  renderVoteGroups();
  renderTallies();
  computeWinningBuild();
}

function renderVoteGroups() {
  dom.voteGroups.innerHTML = '';
  BUILD_GROUPS.forEach((group) => {
    const wrapper = document.createElement('section');
    wrapper.className = 'vote-group';
    wrapper.innerHTML = `
      <h3>${group.title}</h3>
      <p>${group.description}</p>
      <div class="option-grid"></div>
    `;
    const grid = wrapper.querySelector('.option-grid');
    group.options.forEach((option) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `option-card ${state.personalVotes[group.id] === option.id ? 'selected' : ''}`;
      card.innerHTML = `
        <span class="tagline">${option.tagline}</span>
        <strong>${option.title}</strong>
        <div class="description">${option.description}</div>
      `;
      card.addEventListener('click', () => castVote(group.id, option.id));
      grid.append(card);
    });
    dom.voteGroups.append(wrapper);
  });
}

function breakTie(options, teamSeed) {
  return [...options].sort((a, b) => {
    const scoreA = (teamSeed * 17 + a.id.length * 11) % 97;
    const scoreB = (teamSeed * 17 + b.id.length * 11) % 97;
    return scoreA - scoreB;
  })[0];
}

function computeWinningBuild() {
  const voteStore = loadVoteStore(state.activeTeam.slug);
  const winning = {};
  const grandTotalVotes = BUILD_GROUPS.reduce(
    (groupTotal, group) => groupTotal + group.options.reduce((sum, option) => sum + (voteStore[group.id]?.[option.id] || 0), 0),
    0,
  );

  BUILD_GROUPS.forEach((group) => {
    const counts = voteStore[group.id];
    const max = Math.max(...group.options.map((option) => counts[option.id] || 0));
    const winners = group.options.filter((option) => (counts[option.id] || 0) === max);
    winning[group.id] = max === 0 ? group.options[0] : (winners.length === 1 ? winners[0] : breakTie(winners, state.activeTeam.seed));
  });

  state.winningBuild = winning;
  const mission = buildMissionPlan(winning, grandTotalVotes);
  state.lastScenes = mission.scenes;
  state.lastScore = mission.totalScore;

  renderMissionSummary(mission);
}

function buildMissionPlan(winningBuild, grandTotalVotes) {
  if (grandTotalVotes === 0) {
    return {
      scenes: [SCENE_LIBRARY.intro, SCENE_LIBRARY.base, SCENE_LIBRARY.finale],
      totalScore: 2,
      log: [
        { scene: SCENE_LIBRARY.intro, runningTotal: 0 },
        { scene: SCENE_LIBRARY.base, runningTotal: 2 },
        { scene: SCENE_LIBRARY.finale, runningTotal: 2 },
      ],
    };
  }

  const picked = Object.values(winningBuild);
  const scenes = [SCENE_LIBRARY.intro];
  const scoreMods = { speed: 0, precision: 0, lift: 0, risk: 0, reach: 0, search: 0, utility: 0 };

  picked.forEach((option) => {
    Object.entries(option.stats || {}).forEach(([key, value]) => {
      if (key in scoreMods) scoreMods[key] += value;
    });
  });

  const utilitySceneIds = picked
    .map((option) => option.stats?.scene)
    .filter(Boolean)
    .filter((sceneId, index, arr) => arr.indexOf(sceneId) === index);

  utilitySceneIds.forEach((sceneId) => {
    if (SCENE_LIBRARY[sceneId] && sceneId !== 'balanced') scenes.push(SCENE_LIBRARY[sceneId]);
  });

  if (!utilitySceneIds.includes('balanced')) {
    scenes.push(scoreMods.speed > 2 ? SCENE_LIBRARY.dash : SCENE_LIBRARY.balanced);
  }

  if (scoreMods.risk >= 3 && scoreMods.precision <= 0) {
    scenes.push(SCENE_LIBRARY.fail);
  } else if (scoreMods.precision >= 3) {
    scenes.push(SCENE_LIBRARY.verify);
  }

  scenes.push(SCENE_LIBRARY.finale);

  let totalScore = 0;
  const log = scenes.map((scene) => {
    totalScore += scene.score;
    return {
      scene,
      runningTotal: totalScore,
    };
  });

  totalScore += Math.max(0, scoreMods.search);
  totalScore += Math.max(0, scoreMods.reach - 1);
  totalScore += Math.max(0, scoreMods.lift - 1);

  return { scenes, totalScore, log };
}

function renderMissionSummary(mission) {
  dom.winningBuild.innerHTML = '';
  dom.sceneQueue.innerHTML = '';
  dom.missionLog.innerHTML = '';
  dom.projectedScore.textContent = `${mission.totalScore}`;

  Object.values(state.winningBuild).forEach((option) => {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = option.title;
    dom.winningBuild.append(pill);
  });

  mission.scenes.forEach((scene) => {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = scene.title;
    dom.sceneQueue.append(pill);
  });

  mission.log.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'mission-log-entry';
    row.innerHTML = `
      <strong>Scene ${index + 1}</strong>
      <div>
        <div>${entry.scene.title}</div>
        <span>${entry.scene.description}</span>
      </div>
    `;
    dom.missionLog.append(row);
  });

  updatePayloadPreview();
}

function setServerState(mode) {
  const normalized = ['idle', 'pending', 'success', 'error'].includes(mode) ? mode : 'idle';
  state.queryMode.server = normalized;
  dom.submitScore.classList.remove('is-success', 'is-error');

  if (normalized === 'pending') {
    dom.serverStatusLabel.textContent = 'Submitting';
    dom.serverStatusDetail.textContent = 'Pretending to send the winning build and score to a live form endpoint.';
    dom.submitScore.disabled = true;
  } else if (normalized === 'success') {
    dom.serverStatusLabel.textContent = 'Submitted';
    dom.serverStatusDetail.textContent = 'Mock success response received. Leaderboard row would be appended here.';
    dom.submitScore.disabled = false;
    dom.submitScore.classList.add('is-success');
  } else if (normalized === 'error') {
    dom.serverStatusLabel.textContent = 'Retry Needed';
    dom.serverStatusDetail.textContent = 'Mock server failure. Great for testing the unhappy path before wiring real submit.';
    dom.submitScore.disabled = false;
    dom.submitScore.classList.add('is-error');
  } else {
    dom.serverStatusLabel.textContent = 'Idle';
    dom.serverStatusDetail.textContent = 'No submission simulated yet.';
    dom.submitScore.disabled = false;
  }
}

function buildSubmissionPayload() {
  return {
    teamSlug: state.activeTeam.slug,
    teamName: state.activeTeam.name,
    submittedAt: new Date().toISOString(),
    projectedScore: state.lastScore,
    scenes: state.lastScenes.map((scene) => scene.id),
    build: Object.fromEntries(
      Object.entries(state.winningBuild).map(([groupId, option]) => [groupId, option.id]),
    ),
    queryMode: {
      step: state.queryMode.step || 'all',
      scene: state.queryMode.scene || '',
      sandbox: state.queryMode.sandbox,
    },
    submitConfig: {
      mode: state.queryMode.submitMode,
      url: state.queryMode.submitUrl || '',
      mirrorToMock: state.queryMode.mirrorToMock,
    },
  };
}

function updatePayloadPreview() {
  const payload = buildSubmissionPayload();
  dom.payloadMode.textContent = state.queryMode.submitMode;
  dom.payloadPreview.textContent = JSON.stringify(payload, null, 2);
}

function setPayloadVisibility(visible) {
  dom.payloadPanel.classList.toggle('is-hidden', !visible);
  if (visible) updatePayloadPreview();
}

function loadLeaderboardRows() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboardRows(rows) {
  localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(rows));
}

async function copyText(value, successLabel) {
  try {
    await navigator.clipboard.writeText(value);
    dom.serverStatusLabel.textContent = successLabel;
    dom.serverStatusDetail.textContent = 'Copied to clipboard for quick testing and host rehearsal.';
  } catch {
    dom.serverStatusLabel.textContent = 'Copy Failed';
    dom.serverStatusDetail.textContent = 'Clipboard access was blocked in this browser context.';
  }
}

function getTeamLink() {
  const url = new URL(`/tools/ai-club-bays/${state.activeTeam.slug}.html`, window.location.origin);
  const params = new URLSearchParams();
  if (state.queryMode.configUrl) params.set('config', state.queryMode.configUrl);
  if (state.queryMode.step) params.set('step', state.queryMode.step);
  if (state.queryMode.scene) params.set('scene', state.queryMode.scene);
  if (state.queryMode.layout) params.set('layout', state.queryMode.layout);
  if (state.queryMode.sandbox) params.set('sandbox', '1');
  if (state.queryMode.server && state.queryMode.server !== 'idle') params.set('server', state.queryMode.server);
  if (state.queryMode.autorun) params.set('autorun', '1');
  if (state.queryMode.submitMode && state.queryMode.submitMode !== 'mock') params.set('submitMode', state.queryMode.submitMode);
  if (state.queryMode.submitUrl) params.set('submitUrl', state.queryMode.submitUrl);
  if (state.queryMode.mirrorToMock) params.set('mirrorToMock', '1');
  if (params.toString()) url.search = params.toString();
  return url.toString();
}

function buildStepLink(step, extras = {}) {
  const url = new URL(window.location.pathname, window.location.origin);
  const params = new URLSearchParams();
  params.set('team', state.activeTeam.slug);
  if (step) params.set('step', step);
  if (state.queryMode.configUrl) params.set('config', state.queryMode.configUrl);
  if (state.queryMode.submitMode && state.queryMode.submitMode !== 'mock') params.set('submitMode', state.queryMode.submitMode);
  if (state.queryMode.submitUrl) params.set('submitUrl', state.queryMode.submitUrl);
  if (state.queryMode.mirrorToMock) params.set('mirrorToMock', '1');
  Object.entries(extras).forEach(([key, value]) => {
    if (value === true) {
      params.set(key, '1');
    } else if (value) {
      params.set(key, value);
    }
  });
  url.search = params.toString();
  return url.toString();
}

function updateHeroLinks() {
  dom.teamStepLink.href = buildStepLink('team', { layout: 'focus' });
  dom.buildStepLink.href = buildStepLink('build', { layout: 'focus' });
  dom.missionStepLink.href = buildStepLink('mission', { layout: 'focus' });
  dom.arenaStepLink.href = buildStepLink('arena', { sandbox: true, layout: 'focus' });

  const sandboxUrl = new URL('/tools/ai-club-sandbox.html', window.location.origin);
  if (state.queryMode.configUrl) sandboxUrl.searchParams.set('config', state.queryMode.configUrl);
  dom.sandboxLink.href = sandboxUrl.toString();
}

function finalizeMockSubmission(payload) {
  const rows = loadLeaderboardRows();
  const deduped = rows.filter((row) => row.teamSlug !== payload.teamSlug);
  deduped.push(payload);
  deduped.sort((a, b) => b.projectedScore - a.projectedScore || a.teamName.localeCompare(b.teamName));
  saveLeaderboardRows(deduped);
  setServerState('success');
  setPayloadVisibility(true);
}

function buildFormDataFromPayload(payload) {
  const formData = new FormData();
  formData.append('teamSlug', payload.teamSlug);
  formData.append('teamName', payload.teamName);
  formData.append('submittedAt', payload.submittedAt);
  formData.append('projectedScore', String(payload.projectedScore));
  formData.append('scenes', payload.scenes.join(','));
  formData.append('buildJson', JSON.stringify(payload.build));
  formData.append('payloadJson', JSON.stringify(payload));
  Object.entries(payload.build).forEach(([groupId, optionId]) => {
    formData.append(`build_${groupId}`, optionId);
  });
  return formData;
}

async function submitToEndpoint(payload) {
  if (!state.queryMode.submitUrl) {
    throw new Error('Missing submitUrl');
  }

  if (state.queryMode.submitMode === 'json') {
    const response = await fetch(state.queryMode.submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Submit failed with status ${response.status}`);
    }
    return response;
  }

  const response = await fetch(state.queryMode.submitUrl, {
    method: 'POST',
    body: buildFormDataFromPayload(payload),
  });
  if (!response.ok) {
    throw new Error(`Submit failed with status ${response.status}`);
  }
  return response;
}

async function submitScore() {
  const payload = buildSubmissionPayload();
  const requestedServerMode = readQueryMode().server;
  setPayloadVisibility(true);
  setServerState('pending');

  await new Promise((resolve) => setTimeout(resolve, 450));

  if (requestedServerMode === 'error') {
    setServerState('error');
    return;
  }

  if (state.queryMode.submitMode === 'mock') {
    finalizeMockSubmission(payload);
    return;
  }

  try {
    await submitToEndpoint(payload);
    if (state.queryMode.mirrorToMock) {
      finalizeMockSubmission(payload);
    } else {
      setServerState('success');
      setPayloadVisibility(true);
      dom.serverStatusDetail.textContent = `Posted successfully to ${state.queryMode.submitUrl}.`;
    }
  } catch (error) {
    console.error('Submit failed:', error);
    setServerState('error');
    dom.serverStatusDetail.textContent = error.message || 'Submit failed.';
  }
}

function renderTallies() {
  const voteStore = loadVoteStore(state.activeTeam.slug);
  dom.voteTallies.innerHTML = '';

  BUILD_GROUPS.forEach((group) => {
    const card = document.createElement('section');
    card.className = 'tally-card';
    const totalVotes = group.options.reduce((sum, option) => sum + (voteStore[group.id]?.[option.id] || 0), 0);

    card.innerHTML = `
      <header>
        <h3>${group.title}</h3>
        <span>${totalVotes} vote${totalVotes === 1 ? '' : 's'}</span>
      </header>
      <div class="tally-bars"></div>
    `;
    const bars = card.querySelector('.tally-bars');
    group.options.forEach((option) => {
      const votes = voteStore[group.id]?.[option.id] || 0;
      const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
      const bar = document.createElement('div');
      bar.className = 'tally-bar';
      bar.innerHTML = `
        <div class="tally-bar-row">
          <span>${option.title}</span>
          <span>${votes} · ${pct}%</span>
        </div>
        <div class="tally-track"><div class="tally-fill" style="width:${pct}%"></div></div>
      `;
      bars.append(bar);
    });
    dom.voteTallies.append(card);
  });
}

function createArena() {
  const { canvas } = dom;
  const renderer = new window.THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;

  const scene = new window.THREE.Scene();
  scene.fog = new window.THREE.Fog(0x07101d, 18, 38);

  const camera = new window.THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 14, 13);
  camera.lookAt(0, 0, 0);

  const ambient = new window.THREE.HemisphereLight(0x9fd0ff, 0x09111f, 1.15);
  scene.add(ambient);

  const keyLight = new window.THREE.SpotLight(0xffffff, 2.6, 60, 0.5, 0.45, 1.4);
  keyLight.position.set(8, 16, 10);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const rim = new window.THREE.PointLight(0xff925c, 1.1, 30);
  rim.position.set(-8, 6, -8);
  scene.add(rim);

  const arena = new window.THREE.Group();
  scene.add(arena);

  const floorMat = new window.THREE.MeshStandardMaterial({
    color: 0x10203b,
    metalness: 0.15,
    roughness: 0.9,
  });
  const floor = new window.THREE.Mesh(new window.THREE.BoxGeometry(18, 0.8, 14), floorMat);
  floor.receiveShadow = true;
  floor.position.y = -0.4;
  arena.add(floor);

  const grid = new window.THREE.GridHelper(18, 18, 0x5cecff, 0x173250);
  grid.position.y = 0.02;
  arena.add(grid);

  const mantle = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(3.4, 0.45, 1.1),
    new window.THREE.MeshStandardMaterial({ color: 0x73553d, roughness: 0.85 }),
  );
  mantle.position.set(4.6, 2.8, -3.6);
  mantle.castShadow = true;
  scene.add(mantle);

  const grate = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(0.3, 2.8, 5),
    new window.THREE.MeshStandardMaterial({ color: 0x40566d, metalness: 0.65, roughness: 0.4 }),
  );
  grate.position.set(-4.5, 1.5, 0);
  scene.add(grate);
  for (let i = -2; i <= 2; i += 1) {
    const bar = new window.THREE.Mesh(
      new window.THREE.BoxGeometry(0.16, 2.3, 0.14),
      new window.THREE.MeshStandardMaterial({ color: 0x7d95ab, metalness: 0.75, roughness: 0.3 }),
    );
    bar.position.set(-4.3, 1.5, i);
    scene.add(bar);
  }

  const waiterWindow = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(2.4, 1.3, 0.2),
    new window.THREE.MeshStandardMaterial({ color: 0xeed9aa, emissive: 0x674318, emissiveIntensity: 0.4 }),
  );
  waiterWindow.position.set(0, 1.8, 5.4);
  scene.add(waiterWindow);

  const robot = buildRobot();
  scene.add(robot.root);

  const props = buildProps();
  Object.values(props).forEach((mesh) => scene.add(mesh));

  const atmosphere = new window.THREE.Points(
    new window.THREE.BufferGeometry(),
    new window.THREE.PointsMaterial({
      color: 0x77f2ed,
      size: 0.08,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  const positions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i += 1) {
    positions[(i * 3)] = (Math.random() - 0.5) * 30;
    positions[(i * 3) + 1] = Math.random() * 4 + 5.5;
    positions[(i * 3) + 2] = -8 - Math.random() * 14;
  }
  atmosphere.geometry.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));
  scene.add(atmosphere);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  const clock = new window.THREE.Clock();
  const target = new window.THREE.Vector3(0, 0.9, 0);
  const cameraState = {
    position: camera.position.clone(),
    target: target.clone(),
    fov: 42,
  };

  function renderLoop() {
    const t = clock.getElapsedTime();
    robot.wheels.forEach((wheel, index) => {
      wheel.rotation.y += 0.042 + (index % 2) * 0.004;
    });
    robot.bobGroup.position.y = Math.sin(t * 2.6) * 0.06;
    atmosphere.rotation.y += 0.0008;
    camera.position.lerp(cameraState.position, 0.08);
    target.lerp(cameraState.target, 0.08);
    camera.fov += (cameraState.fov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    renderer.render(scene, camera);
    window.requestAnimationFrame(renderLoop);
  }
  renderLoop();

  return {
    scene,
    renderer,
    camera,
    robot,
    props,
    cameraState,
  };
}

function buildRobot() {
  const root = new window.THREE.Group();
  const bobGroup = new window.THREE.Group();
  root.add(bobGroup);

  const body = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(2.2, 1.1, 2.7),
    new window.THREE.MeshStandardMaterial({
      color: 0x5b7dff,
      metalness: 0.25,
      roughness: 0.5,
      emissive: 0x102458,
      emissiveIntensity: 0.65,
    }),
  );
  body.castShadow = true;
  body.position.y = 1.15;
  bobGroup.add(body);

  const head = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(1.05, 0.55, 1.05),
    new window.THREE.MeshStandardMaterial({
      color: 0xd5ecff,
      emissive: 0x345d9a,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    }),
  );
  head.position.set(0, 1.95, 0.15);
  head.castShadow = true;
  bobGroup.add(head);

  const eyeGeo = new window.THREE.BoxGeometry(0.18, 0.12, 0.08);
  const eyeMat = new window.THREE.MeshStandardMaterial({ color: 0x77f2ed, emissive: 0x77f2ed, emissiveIntensity: 1.2 });
  const eyeL = new window.THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.22, 1.96, 0.62);
  eyeR.position.set(0.22, 1.96, 0.62);
  bobGroup.add(eyeL, eyeR);

  const armBase = new window.THREE.Group();
  armBase.position.set(1.22, 1.42, -0.1);
  bobGroup.add(armBase);

  const upperArm = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(0.28, 1.4, 0.28),
    new window.THREE.MeshStandardMaterial({ color: 0xffc56b, roughness: 0.45 }),
  );
  upperArm.position.y = 0.7;
  upperArm.castShadow = true;
  armBase.add(upperArm);

  const forearmPivot = new window.THREE.Group();
  forearmPivot.position.y = 1.35;
  armBase.add(forearmPivot);

  const forearm = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(0.22, 1.2, 0.22),
    new window.THREE.MeshStandardMaterial({ color: 0xff925c, roughness: 0.45 }),
  );
  forearm.position.y = 0.6;
  forearm.castShadow = true;
  forearmPivot.add(forearm);

  const claw = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(0.5, 0.14, 0.14),
    new window.THREE.MeshStandardMaterial({ color: 0xf9efe2, roughness: 0.4 }),
  );
  claw.position.y = 1.23;
  forearmPivot.add(claw);

  const hookPivot = new window.THREE.Group();
  hookPivot.position.set(-1.14, 1.42, -0.2);
  bobGroup.add(hookPivot);

  const cable = new window.THREE.Mesh(
    new window.THREE.CylinderGeometry(0.04, 0.04, 1.6, 10),
    new window.THREE.MeshStandardMaterial({ color: 0x87a8bf, metalness: 0.7, roughness: 0.35 }),
  );
  cable.position.y = -0.8;
  hookPivot.add(cable);

  const hook = new window.THREE.Mesh(
    new window.THREE.TorusGeometry(0.18, 0.06, 10, 18, Math.PI * 1.35),
    new window.THREE.MeshStandardMaterial({ color: 0xd3ff70, metalness: 0.65, roughness: 0.25 }),
  );
  hook.rotation.z = Math.PI / 2;
  hook.position.y = -1.58;
  hookPivot.add(hook);

  const scannerPivot = new window.THREE.Group();
  scannerPivot.position.set(0, 2.15, -0.5);
  bobGroup.add(scannerPivot);
  const scannerDish = new window.THREE.Mesh(
    new window.THREE.CylinderGeometry(0.45, 0.2, 0.16, 24),
    new window.THREE.MeshStandardMaterial({ color: 0x77f2ed, emissive: 0x184a4d, emissiveIntensity: 0.55 }),
  );
  scannerDish.rotation.z = Math.PI / 2;
  scannerPivot.add(scannerDish);

  const pillow = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(0.85, 0.16, 0.85),
    new window.THREE.MeshStandardMaterial({ color: 0xf6d7ef, roughness: 0.95 }),
  );
  pillow.position.set(0, 0.66, 0.65);
  bobGroup.add(pillow);

  const wheels = [];
  const wheelGeo = new window.THREE.CylinderGeometry(0.48, 0.48, 0.34, 20);
  const wheelMat = new window.THREE.MeshStandardMaterial({ color: 0x141d2b, roughness: 0.9 });
  const wheelPositions = [
    [-1.05, 0.55, 1.02],
    [1.05, 0.55, 1.02],
    [-1.05, 0.55, -1.02],
    [1.05, 0.55, -1.02],
  ];
  wheelPositions.forEach((position) => {
    const wheelGroup = new window.THREE.Group();
    wheelGroup.position.set(...position);
    wheelGroup.rotation.z = Math.PI / 2;
    const wheel = new window.THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    wheelGroup.add(wheel);
    root.add(wheelGroup);
    wheels.push(wheel);
  });

  return {
    root,
    bobGroup,
    armBase,
    forearmPivot,
    hookPivot,
    cable,
    hook,
    scannerPivot,
    scannerDish,
    pillow,
    wheels,
    eyeL,
    eyeR,
  };
}

function buildProps() {
  const mantlePrize = new window.THREE.Mesh(
    new window.THREE.OctahedronGeometry(0.28, 0),
    new window.THREE.MeshStandardMaterial({ color: 0xffc76a, emissive: 0x5a3100, emissiveIntensity: 0.55 }),
  );
  mantlePrize.position.set(4.65, 3.35, -3.55);

  const gratePrize = new window.THREE.Mesh(
    new window.THREE.DodecahedronGeometry(0.25, 0),
    new window.THREE.MeshStandardMaterial({ color: 0xd3ff70, emissive: 0x334a00, emissiveIntensity: 0.55 }),
  );
  gratePrize.position.set(-5.55, 0.95, 0.55);

  const egg = new window.THREE.Mesh(
    new window.THREE.SphereGeometry(0.28, 24, 24),
    new window.THREE.MeshStandardMaterial({ color: 0xd88cff, emissive: 0x5c287d, emissiveIntensity: 0.9 }),
  );
  egg.scale.set(0.82, 1.15, 0.82);
  egg.position.set(1.6, 0.92, 2.45);

  const crate = new window.THREE.Mesh(
    new window.THREE.BoxGeometry(0.85, 0.85, 0.85),
    new window.THREE.MeshStandardMaterial({ color: 0x8f6a42, roughness: 0.85 }),
  );
  crate.position.set(-1.6, 0.43, -2.6);

  const decoy = new window.THREE.Mesh(
    new window.THREE.ConeGeometry(0.25, 0.6, 4),
    new window.THREE.MeshStandardMaterial({ color: 0xff566f, emissive: 0x5b1120, emissiveIntensity: 0.5 }),
  );
  decoy.position.set(0.45, 0.38, -0.6);

  [mantlePrize, gratePrize, egg, crate, decoy].forEach((mesh) => {
    mesh.castShadow = true;
  });

  return {
    mantlePrize,
    gratePrize,
    egg,
    crate,
    decoy,
  };
}

function setCameraButtons(kind) {
  [...dom.cameraButtons.querySelectorAll('.camera-button')].forEach((button) => {
    button.classList.toggle('active', button.dataset.cameraView === kind);
  });
}

function moveCamera(kind, force = false) {
  if (!force && state.sceneRunning) return;

  const { cameraState } = state.arena;
  if (kind === 'close') {
    cameraState.position.set(3.4, 4.6, 8.4);
    cameraState.target.set(1.2, 1.3, 1.8);
    cameraState.fov = 34;
    dom.cameraChip.textContent = 'Close';
  } else if (kind === 'cinematic') {
    cameraState.position.set(6.2, 5.4, 5.9);
    cameraState.target.set(4.2, 2.7, -3.5);
    cameraState.fov = 32;
    dom.cameraChip.textContent = 'Cinematic';
  } else if (kind === 'driver') {
    cameraState.position.set(0, 2.45, 2.2);
    cameraState.target.set(0, 1.7, -4.2);
    cameraState.fov = 56;
    dom.cameraChip.textContent = 'Driver Cam';
  } else if (kind === 'third') {
    cameraState.position.set(-5.6, 4.8, 9.5);
    cameraState.target.set(0, 1.2, 0);
    cameraState.fov = 42;
    dom.cameraChip.textContent = 'Third Person';
  } else {
    cameraState.position.set(0, 14, 13);
    cameraState.target.set(0, 0.9, 0);
    cameraState.fov = 42;
    dom.cameraChip.textContent = 'Top Down';
  }

  if (!['close', 'cinematic'].includes(kind) || !state.sceneRunning) {
    state.preferredCamera = kind;
    setCameraButtons(kind);
  }
}

function previewScene(sceneId) {
  if (!SCENE_LIBRARY[sceneId] || !state.arena || state.sceneRunning) return;
  state.sceneRunning = true;
  dom.debugSceneReadout.textContent = sceneId;
  playScene(SCENE_LIBRARY[sceneId]).finally(() => {
    state.sceneRunning = false;
    moveCamera(state.preferredCamera, true);
  });
}

function resetArenaPoses() {
  const { robot, props } = state.arena;
  gsap.killTweensOf([
    robot.root.position,
    robot.root.rotation,
    robot.armBase.rotation,
    robot.forearmPivot.rotation,
    robot.hookPivot.rotation,
    robot.cable.scale,
    robot.hook.position,
    robot.scannerPivot.rotation,
    robot.scannerDish.scale,
    robot.pillow.position,
    props.mantlePrize.position,
    props.gratePrize.position,
    props.egg.position,
    props.crate.position,
    props.decoy.rotation,
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
  robot.pillow.position.set(0, 0.66, 0.65);

  props.mantlePrize.position.set(4.65, 3.35, -3.55);
  props.gratePrize.position.set(-5.55, 0.95, 0.55);
  props.egg.position.set(1.6, 0.92, 2.45);
  props.crate.position.set(-1.6, 0.43, -2.6);
  props.decoy.rotation.set(0, 0, 0);
}

function playScene(sceneDef) {
  const { robot, props } = state.arena;
  resetArenaPoses();
  moveCamera(sceneDef.camera, true);
  dom.arenaTitle.textContent = `${state.activeTeam.name} Arena`;
  dom.sceneTitle.textContent = sceneDef.title;
  dom.sceneDescription.textContent = sceneDef.description;

  const tl = gsap.timeline();

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
    tl.to(robot.root.position, { x: 3.25, z: -2.2, duration: 1.1, ease: 'power2.inOut' })
      .to(robot.armBase.rotation, { z: -1.22, duration: 0.55 }, '-=0.2')
      .to(robot.forearmPivot.rotation, { z: 0.3, duration: 0.55 }, '<')
      .to(props.mantlePrize.position, {
        x: 3.95, y: 2.25, z: -2.1, duration: 0.55, ease: 'power1.inOut',
      }, '-=0.08')
      .to(state.arena.cameraState, { fov: 27, duration: 0.2 }, '-=0.25')
      .to(robot.root.position, { x: 1.5, z: -0.6, duration: 0.8 })
      .to(robot.armBase.rotation, { z: -0.22, duration: 0.45 }, '<')
      .to(robot.forearmPivot.rotation, { z: 0.18, duration: 0.45 }, '<');
  } else if (sceneDef.id === 'grapple') {
    tl.to(robot.root.position, { x: -2.65, z: 0.3, duration: 0.85, ease: 'power2.inOut' })
      .to(robot.hookPivot.rotation, { z: 0.25, duration: 0.25 })
      .to(robot.cable.scale, { y: 1.9, duration: 0.4 }, '<')
      .to(robot.hook.position, { y: -2.55, x: -1.1, duration: 0.4 }, '<')
      .to(props.gratePrize.position, {
        x: -2.75, y: 1.05, z: 0.3, duration: 0.28, ease: 'steps(4)',
      })
      .to(state.arena.cameraState, { fov: 24, duration: 0.18 }, '<')
      .to(robot.cable.scale, { y: 1, duration: 0.35 }, '<')
      .to(robot.hook.position, { y: -1.58, x: 0, duration: 0.35 }, '<');
  } else if (sceneDef.id === 'scanner') {
    tl.to(robot.scannerPivot.rotation, { y: Math.PI * 2, duration: 1.15, ease: 'none' })
      .to(robot.scannerDish.scale, { x: 1.4, z: 1.4, duration: 0.25, yoyo: true, repeat: 3 }, 0.15)
      .to(props.decoy.rotation, { y: Math.PI * 0.5, duration: 0.5 }, 0.25)
      .to(props.mantlePrize.position, { y: props.mantlePrize.position.y + 0.12, duration: 0.3, yoyo: true, repeat: 2 }, 0.45);
  } else if (sceneDef.id === 'egg') {
    tl.to(robot.root.position, { x: 1.2, z: 1.35, duration: 0.85, ease: 'power1.inOut' })
      .to(robot.pillow.position, { y: 0.88, duration: 0.35 }, '-=0.12')
      .to(props.egg.position, { x: 0.02, y: 1.02, z: 0.62, duration: 0.5 })
      .to(state.arena.cameraState, { fov: 26, duration: 0.18 }, '-=0.2')
      .to(robot.root.position, { x: 0.12, z: 3.8, duration: 1.15, ease: 'power1.inOut' })
      .to(props.egg.position, { x: 0.04, y: 1.82, z: 5.1, duration: 0.55, ease: 'power1.out' })
      .to(robot.pillow.position, { y: 0.66, duration: 0.2 });
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
  } else if (sceneDef.id === 'starter') {
    tl.to(robot.root.position, { x: 0.8, z: 0.8, duration: 0.45 })
      .to(robot.root.position, { x: -0.2, z: 1.25, duration: 0.45 })
      .to(robot.root.position, { x: 0.2, z: 0.4, duration: 0.38 });
  } else if (sceneDef.id === 'base') {
    tl.to(robot.root.position, { x: -0.8, z: 0.4, duration: 0.45 })
      .to(robot.root.position, { x: 0.95, z: 1.15, duration: 0.5 })
      .to(robot.root.position, { x: 0.1, z: 0.2, duration: 0.45 });
  } else if (sceneDef.id === 'fail') {
    tl.to(robot.root.position, { x: 0.65, z: -0.22, duration: 0.35 })
      .to(props.decoy.rotation, { z: 1.2, duration: 0.2 }, '-=0.05')
      .to(state.arena.cameraState, { fov: 28, duration: 0.15 }, '<')
      .to(robot.root.rotation, { z: 0.18, duration: 0.15, yoyo: true, repeat: 3 }, '-=0.08')
      .to(robot.root.position, { x: -0.55, z: 0.45, duration: 0.5 });
  } else if (sceneDef.id === 'finale') {
    tl.to(robot.root.position, { y: 0.18, duration: 0.28, yoyo: true, repeat: 1 })
      .to(robot.root.rotation, { y: Math.PI * 2, duration: 1.2, ease: 'power1.inOut' }, 0)
      .to(robot.scannerDish.scale, { x: 1.35, z: 1.35, duration: 0.22, yoyo: true, repeat: 3 }, 0.15);
  }

  return new Promise((resolve) => {
    tl.eventCallback('onComplete', resolve);
  });
}

async function runMission() {
  if (state.sceneRunning) return;
  state.sceneRunning = true;
  dom.startMission.disabled = true;
  dom.lockBuild.disabled = true;

  computeWinningBuild();
  for (const scene of state.lastScenes) {
    await playScene(scene);
  }

  dom.sceneTitle.textContent = 'Mission Complete';
  dom.sceneDescription.textContent = `${state.activeTeam.name} finishes with a projected score of ${state.lastScore}. High-value scenes came from visible tool choices, not luck.`;
  moveCamera(state.preferredCamera, true);
  dom.cameraChip.textContent = 'Score Locked';
  dom.startMission.disabled = false;
  dom.lockBuild.disabled = false;
  state.sceneRunning = false;
}

function renderDebugPanel() {
  dom.debugPanel.classList.toggle('is-hidden', !state.queryMode.sandbox);
  dom.debugQueryReadout.textContent = window.location.search || '?default';
  dom.debugSceneReadout.textContent = state.queryMode.scene || 'full mission';

  if (!state.queryMode.sandbox) return;

  dom.sceneDebugButtons.innerHTML = '';
  Object.values(SCENE_LIBRARY).forEach((scene) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'debug-button';
    button.textContent = scene.title;
    button.addEventListener('click', () => previewScene(scene.id));
    dom.sceneDebugButtons.append(button);
  });

  dom.serverDebugButtons.innerHTML = '';
  ['idle', 'pending', 'success', 'error'].forEach((mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'debug-button';
    button.textContent = mode;
    button.addEventListener('click', () => setServerState(mode));
    dom.serverDebugButtons.append(button);
  });

  dom.submitDebugButtons.innerHTML = '';
  [
    { label: 'Preview Payload', action: () => setPayloadVisibility(true) },
    { label: 'Submit Score', action: () => submitScore() },
    { label: 'Copy Team Link', action: () => copyText(getTeamLink(), 'Link Copied') },
    { label: 'Hide Payload', action: () => setPayloadVisibility(false) },
  ].forEach((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'debug-button';
    button.textContent = entry.label;
    button.addEventListener('click', entry.action);
    dom.submitDebugButtons.append(button);
  });
}

function initInteractions() {
  dom.clearVotes.addEventListener('click', clearPersonalVotes);
  dom.startMission.addEventListener('click', runMission);
  dom.lockBuild.addEventListener('click', () => {
    computeWinningBuild();
    runMission();
  });
  [...dom.cameraButtons.querySelectorAll('.camera-button')].forEach((button) => {
    button.addEventListener('click', () => moveCamera(button.dataset.cameraView));
  });
  dom.previewPayload.addEventListener('click', () => setPayloadVisibility(true));
  dom.copyPayload.addEventListener('click', () => copyText(JSON.stringify(buildSubmissionPayload(), null, 2), 'Payload Copied'));
  dom.copyTeamLink.addEventListener('click', () => copyText(getTeamLink(), 'Link Copied'));
  dom.submitScore.addEventListener('click', submitScore);
}

async function init() {
  state.queryMode = readQueryMode();
  await loadAppConfig();
  applyAppConfigToDom();
  if (!state.queryMode.submitUrl) {
    state.queryMode.submitUrl = state.appConfig.submitDefaults.url || '';
  }
  if (!state.queryMode.submitMode) {
    state.queryMode.submitMode = state.appConfig.submitDefaults.mode;
  }
  if (!state.queryMode.mirrorToMock) {
    state.queryMode.mirrorToMock = Boolean(state.appConfig.submitDefaults.mirrorToMock);
  }
  dom.submitScore.textContent = state.queryMode.submitMode === 'mock' ? 'Mock Submit Score' : 'Submit Score';
  dom.payloadMode.textContent = state.queryMode.submitMode;
  applyLayoutMode();
  renderTeamGrid();
  initInteractions();
  setActiveTeam(getInitialTeam());
  updateHeroLinks();
  applyStepMode(state.queryMode.step);
  renderDebugPanel();
  setServerState(state.queryMode.server);
  try {
    state.arena = createArena();
    playScene(SCENE_LIBRARY.intro);
    if (state.queryMode.scene && SCENE_LIBRARY[state.queryMode.scene]) {
      previewScene(state.queryMode.scene);
    } else if (state.queryMode.autorun) {
      runMission();
    }
  } catch (error) {
    console.error('Arena failed to initialize:', error);
    dom.cameraChip.textContent = 'Fallback Mode';
    dom.arenaTitle.textContent = 'Arena Offline';
    dom.sceneTitle.textContent = 'UI Ready';
    dom.sceneDescription.textContent = 'The team voting controls are live, but this browser did not finish the 3D arena setup.';
  }
}

init();
