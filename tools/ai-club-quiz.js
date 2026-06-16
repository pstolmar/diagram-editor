/* eslint-disable no-use-before-define */
const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Render the quiz question card into containerEl.
 * @param {HTMLElement} containerEl
 * @param {object[]} questions
 * @param {object} state
 * @param {object} opts
 */
function renderQuestion(containerEl, questions, state, opts) {
  const q = questions[state.index];
  const progressText = `Question ${state.index + 1} of ${questions.length}`;

  containerEl.innerHTML = `
    <div class="quiz-score" aria-live="polite">
      Score: <strong>${state.score}</strong> / ${questions.length}
    </div>
    <div class="quiz-card">
      <div class="quiz-meta">${q.category} &mdash; ${progressText}</div>
      <p class="quiz-question">${q.question}</p>
      <ul class="quiz-options">
        ${q.options.map((opt, i) => `
          <li>
            <button class="quiz-option" data-index="${i}" aria-label="Option ${LETTERS[i]}: ${opt}">
              <span class="quiz-option-letter">${LETTERS[i]}</span>
              <span class="quiz-option-text">${opt}</span>
            </button>
          </li>
        `).join('')}
      </ul>
      <p class="quiz-explanation" aria-live="polite"></p>
      <button class="quiz-next" aria-label="Next question">Next &rarr;</button>
      <button class="quiz-next-corner" aria-label="Next question" aria-hidden="true">&rarr;</button>
    </div>
  `;

  const optionBtns = containerEl.querySelectorAll('.quiz-option');
  const explanationEl = containerEl.querySelector('.quiz-explanation');
  const nextBtn = containerEl.querySelector('.quiz-next');
  const cornerBtn = containerEl.querySelector('.quiz-next-corner');

  optionBtns.forEach((btn) => {
    btn.addEventListener('click', () => handleAnswer(
      btn,
      optionBtns,
      explanationEl,
      nextBtn,
      cornerBtn,
      q,
      state,
      opts,
    ));
  });

  cornerBtn.addEventListener('click', () => nextBtn.click());

  nextBtn.addEventListener('click', () => {
    state.index += 1;
    if (state.index >= questions.length) {
      renderEnd(containerEl, state, questions.length, opts);
    } else {
      renderQuestion(containerEl, questions, state, opts);
    }
  });
}

/**
 * Handle an option button click.
 */
function handleAnswer(btn, allBtns, explanationEl, nextBtn, cornerBtn, question, state, opts) {
  const chosen = Number(btn.dataset.index);
  const isCorrect = chosen === question.correctIndex;

  // Disable all buttons to prevent re-clicks
  allBtns.forEach((b) => {
    b.disabled = true;
  });

  if (isCorrect) {
    btn.classList.add('is-correct');
    state.score += 1;
    // Update score display
    const scoreEl = explanationEl.closest('.quiz-card')?.parentElement?.querySelector('.quiz-score strong');
    if (scoreEl) scoreEl.textContent = String(state.score);
  } else {
    // Fade wrong options (all buttons that are not the selected one)
    allBtns.forEach((b) => {
      if (b !== btn) {
        if (Number(b.dataset.index) === question.correctIndex) {
          b.classList.add('is-correct-highlight');
        } else {
          b.classList.add('is-wrong');
        }
      } else {
        b.classList.add('is-wrong');
      }
    });
  }

  // Show explanation (with optional source citation link)
  if (question.source) {
    explanationEl.innerHTML = `${question.explanation} <a class="quiz-source-link" href="${question.source.url}" target="_blank" rel="noopener noreferrer">[${question.source.label} ↗]</a>`;
  } else {
    explanationEl.textContent = question.explanation;
  }
  // Trigger reflow so transition fires
  // eslint-disable-next-line no-void
  void explanationEl.offsetWidth;
  explanationEl.classList.add('is-visible');

  // Show next button (both bottom and corner arrow)
  nextBtn.classList.add('is-visible');
  cornerBtn.classList.add('is-visible');

  if (typeof opts.onAnswer === 'function') {
    opts.onAnswer(isCorrect, state.score);
  }
}

/**
 * Render the end screen.
 */
function renderEnd(containerEl, state, total, opts) {
  let grade;
  if (state.score >= 9) {
    grade = 'Prompt Pro!';
  } else if (state.score >= 6) {
    grade = 'Good instincts!';
  } else {
    grade = 'Keep exploring!';
  }

  containerEl.innerHTML = `
    <div class="quiz-end" role="region" aria-label="Quiz complete">
      <div class="quiz-end-score">${state.score} / ${total}</div>
      <div class="quiz-end-grade">${grade}</div>
      <p class="quiz-end-label">${state.score} correct out of ${total} questions</p>
      <button class="quiz-replay">Play again</button>
    </div>
  `;

  containerEl.querySelector('.quiz-replay').addEventListener('click', () => {
    if (typeof opts.onReplay === 'function') {
      opts.onReplay();
    } else {
      const freshQuestions = selectQuestions(
        containerEl.__quizPool,
        containerEl.__quizReplayCitedPool,
      );
      containerEl.__quizQuestions = freshQuestions; // eslint-disable-line no-param-reassign
      const freshState = { index: 0, score: 0 };
      renderQuestion(containerEl, freshQuestions, freshState, opts);
    }
  });

  if (typeof opts.onComplete === 'function') {
    opts.onComplete(state.score, total);
  }
}

/**
 * Shuffle a question's options randomly and update correctIndex to match.
 * Prevents length/position tells across sessions.
 */
function shuffleQuestion(q) {
  const idxs = q.options.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return {
    ...q,
    options: idxs.map((i) => q.options[i]),
    correctIndex: idxs.indexOf(q.correctIndex),
    source: q.source,
  };
}

/**
 * Select questions maintaining difficulty tiers (2 easy + 5 medium + 3 hard).
 * When citedPool is provided, 7 of 10 come from it:
 *   easy:   1 cited + 1 regular
 *   medium: 4 cited + 1 regular
 *   hard:   2 cited + 1 regular
 * Falls back to single-pool selection when citedPool is absent.
 */
function selectQuestions(pool, citedPool) {
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const pick = (src, diff, n) => shuffle(src.filter((q) => q.difficulty === diff)).slice(0, n);

  let selected;
  if (citedPool && citedPool.length) {
    selected = shuffle([
      ...pick(citedPool, 'easy', 2),
      ...pick(citedPool, 'medium', 5),
      ...pick(citedPool, 'hard', 3),
    ]);
  } else if (!pool.some((q) => q.difficulty)) {
    selected = shuffle(pool).slice(0, 10);
  } else {
    selected = [
      ...pick(pool, 'easy', 2),
      ...pick(pool, 'medium', 5),
      ...pick(pool, 'hard', 3),
    ];
  }

  // Shuffle options within each question so A/B/C/D positions are random each game
  return selected.map(shuffleQuestion);
}

/**
 * Public API — initialise the quiz widget.
 * @param {HTMLElement} containerEl - target element to render into
 * @param {object[]} questions - array of question objects
 * @param {object} [opts] - optional callbacks
 * @param {function} [opts.onComplete] - called with (score, total) at end
 * @param {function} [opts.onAnswer] - called with (isCorrect, currentScore) after each answer
 * @param {function} [opts.onReplay] - called when replay button is clicked
 */
export function initQuiz(containerEl, questions, opts = {}) {
  const selectedQuestions = selectQuestions(questions, opts.citedPool);
  const state = { index: 0, score: 0 };
  containerEl.__quizQuestions = selectedQuestions; // eslint-disable-line no-param-reassign
  containerEl.__quizPool = questions; // eslint-disable-line no-param-reassign
  containerEl.__quizCitedPool = opts.citedPool; // eslint-disable-line no-param-reassign
  containerEl.__quizReplayCitedPool = opts.replayCitedPool || opts.citedPool; // eslint-disable-line no-param-reassign
  renderQuestion(containerEl, selectedQuestions, state, opts);
}

// Self-init for standalone page
(async () => {
  const shell = document.querySelector('.quiz-shell');
  if (!shell) return;
  const [questions, citedPool] = await Promise.all([
    fetch('/tools/ai-club-quiz-data.json').then((r) => r.json()),
    fetch('/tools/ai-club-quiz-cited.json').then((r) => r.json()),
  ]);
  const primaryCited = citedPool.filter((q) => q.id.startsWith('d'));
  initQuiz(shell, questions, { citedPool: primaryCited, replayCitedPool: citedPool });
})();
