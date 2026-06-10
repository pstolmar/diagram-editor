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
    </div>
  `;

  const optionBtns = containerEl.querySelectorAll('.quiz-option');
  const explanationEl = containerEl.querySelector('.quiz-explanation');
  const nextBtn = containerEl.querySelector('.quiz-next');

  optionBtns.forEach((btn) => {
    btn.addEventListener('click', () => handleAnswer(
      btn,
      optionBtns,
      explanationEl,
      nextBtn,
      q,
      state,
      opts,
    ));
  });

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
function handleAnswer(btn, allBtns, explanationEl, nextBtn, question, state, opts) {
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
    const scoreEl = btn.closest('.quiz-shell').querySelector('.quiz-score strong');
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

  // Show explanation
  explanationEl.textContent = question.explanation;
  // Trigger reflow so transition fires
  // eslint-disable-next-line no-void
  void explanationEl.offsetWidth;
  explanationEl.classList.add('is-visible');

  // Show next button
  nextBtn.classList.add('is-visible');

  if (typeof opts.onAnswer === 'function') {
    opts.onAnswer(isCorrect, state.score);
  }
}

/**
 * Render the end screen.
 */
function renderEnd(containerEl, state, total, opts) {
  let grade;
  if (state.score >= 8) {
    grade = 'Prompt Pro!';
  } else if (state.score >= 5) {
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
      // Default: restart with the same questions stored on the container
      const questions = containerEl.__quizQuestions;
      const freshState = { index: 0, score: 0 };
      renderQuestion(containerEl, questions, freshState, opts);
    }
  });

  if (typeof opts.onComplete === 'function') {
    opts.onComplete(state.score, total);
  }
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
  const state = { index: 0, score: 0 };
  // Store questions on the element for replay
  containerEl.__quizQuestions = questions; // eslint-disable-line no-param-reassign
  renderQuestion(containerEl, questions, state, opts);
}

// Self-init for standalone page
(async () => {
  const shell = document.querySelector('.quiz-shell');
  if (!shell) return;
  const res = await fetch('/tools/ai-club-quiz-data.json');
  const questions = await res.json();
  initQuiz(shell, questions);
})();
