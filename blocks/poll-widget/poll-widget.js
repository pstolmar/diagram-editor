function createPollId(questionText) {
  let hash = 0;
  for (let i = 0; i < questionText.length; i += 1) {
    const char = questionText.charCodeAt(i);
    // djb2-style hash without bitwise — keep as integer via modulo
    hash = Math.trunc((hash * 31) + char) % 2147483647;
  }
  return `poll-${Math.abs(hash)}`;
}

function getPeerVoteCounts(pollId, optionValue, totalVotes) {
  // Deterministic seed-based counts for consistency
  const seed = parseInt(pollId.replace('poll-', ''), 10) + optionValue.charCodeAt(0);
  const seedRandom = (Math.sin(seed) * 10000) % 1;

  const peerCount = Math.floor(seedRandom * 50) + 10; // 10-60 peer votes
  return Math.max(peerCount, totalVotes);
}

function renderResults(container, pollId, options, userVote, multiselect) {
  container.innerHTML = '';

  const voteMap = {};
  options.forEach((opt) => {
    voteMap[opt.value] = 0;
  });

  if (multiselect && Array.isArray(userVote)) {
    userVote.forEach((vote) => {
      voteMap[vote] += 1;
    });
  } else if (!multiselect) {
    voteMap[userVote] += 1;
  }

  const totalVotes = multiselect && Array.isArray(userVote) ? userVote.length : 1;

  const chartDiv = document.createElement('div');
  chartDiv.className = 'poll-chart';

  options.forEach((option) => {
    const peerCount = getPeerVoteCounts(pollId, option.value, totalVotes);
    const userCount = voteMap[option.value];
    const combinedCount = peerCount + userCount;
    const percentage = Math.round((userCount / combinedCount) * 100) || 0;

    const barItem = document.createElement('div');
    barItem.className = 'poll-bar-item';

    const barLabel = document.createElement('div');
    barLabel.className = 'poll-bar-label';
    barLabel.textContent = option.label;
    barItem.appendChild(barLabel);

    const barContainer = document.createElement('div');
    barContainer.className = 'poll-bar-container';

    const bar = document.createElement('div');
    bar.className = 'poll-bar';
    bar.style.width = '0%';
    setTimeout(() => {
      bar.style.width = `${percentage}%`;
    }, 10);

    const barText = document.createElement('div');
    barText.className = 'poll-bar-text';
    barText.textContent = `${percentage}% (${combinedCount} votes)`;

    barContainer.appendChild(bar);
    barContainer.appendChild(barText);
    barItem.appendChild(barContainer);
    chartDiv.appendChild(barItem);
  });

  container.appendChild(chartDiv);

  const changeBtn = document.createElement('button');
  changeBtn.className = 'poll-change-vote-btn';
  changeBtn.textContent = 'Change my vote';
  changeBtn.addEventListener('click', () => {
    localStorage.removeItem(pollId);
    window.location.reload();
  });
  container.appendChild(changeBtn);

  const shareBtn = document.createElement('button');
  shareBtn.className = 'poll-share-btn';
  shareBtn.textContent = 'Share results';
  shareBtn.addEventListener('click', () => {
    const resultHash = btoa(JSON.stringify({ pollId, voted: true }));
    const shareUrl = `${window.location.origin}${window.location.pathname}?poll-result=${resultHash}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      shareBtn.textContent = 'Copied!';
      setTimeout(() => {
        shareBtn.textContent = 'Share results';
      }, 2000);
    });
  });
  container.appendChild(shareBtn);
}

function buildPollUI(block, questionText, options, multiselect) {
  const pollId = createPollId(questionText);
  const userVote = JSON.parse(localStorage.getItem(pollId) || 'null');

  const form = document.createElement('form');
  form.className = 'poll-widget-form';

  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = questionText;
  fieldset.appendChild(legend);

  const inputType = multiselect ? 'checkbox' : 'radio';
  const groupName = `poll-${pollId}`;

  options.forEach((option, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'poll-option';

    const input = document.createElement('input');
    input.type = inputType;
    input.id = `option-${pollId}-${idx}`;
    input.name = groupName;
    input.value = option.value;

    if (userVote) {
      if (multiselect && Array.isArray(userVote)) {
        input.checked = userVote.includes(option.value);
      } else if (!multiselect) {
        input.checked = userVote === option.value;
      }
    }

    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = option.label;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    fieldset.appendChild(wrapper);
  });

  form.appendChild(fieldset);

  if (multiselect) {
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Vote';
    submitBtn.className = 'poll-submit-btn';
    form.appendChild(submitBtn);
  }

  const resultsDiv = document.createElement('div');
  resultsDiv.className = 'poll-results';
  resultsDiv.setAttribute('data-poll-results', '');
  resultsDiv.style.display = userVote ? 'block' : 'none';

  if (userVote) {
    renderResults(resultsDiv, pollId, options, userVote, multiselect);
  }

  block.innerHTML = '';
  block.appendChild(form);
  block.appendChild(resultsDiv);

  if (multiselect) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const checkedInputs = form.querySelectorAll('input[type="checkbox"]:checked');
      const votes = Array.from(checkedInputs).map((inp) => inp.value);
      localStorage.setItem(pollId, JSON.stringify(votes));
      resultsDiv.style.display = 'block';
      renderResults(resultsDiv, pollId, options, votes, multiselect);
      form.style.display = 'none';
    });
  } else {
    form.addEventListener('change', (e) => {
      if (e.target.type === 'radio') {
        localStorage.setItem(pollId, JSON.stringify(e.target.value));
        resultsDiv.style.display = 'block';
        renderResults(resultsDiv, pollId, options, e.target.value, false);
        form.style.display = 'none';
      }
    });
  }
}

async function decorate(block) {
  const rows = Array.from(block.querySelectorAll('tbody tr'));
  if (rows.length < 2) {
    try {
      const resp = await fetch(new URL('poll-widget-demo.json', import.meta.url));
      const json = await resp.json();
      const q = json.question || 'Vote';
      const opts = (json.options || []).map((o) => ({
        label: o.label || o,
        value: o.value || o.label || o,
      }));
      if (opts.length) {
        buildPollUI(block, q, opts, false);
      }
    } catch { /* ignore */ }
    return;
  }

  const hCells = rows[0].querySelectorAll('td');
  const questionText = hCells[0]?.textContent?.trim() || 'Vote';
  const multiselect = hCells[1]?.textContent?.toLowerCase().includes('multi') || false;

  const options = rows.slice(1).map((row) => {
    const cells = row.querySelectorAll('td');
    return {
      label: cells[0]?.textContent?.trim() || '',
      value: cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '',
    };
  });

  buildPollUI(block, questionText, options, multiselect);
}

export default decorate;
