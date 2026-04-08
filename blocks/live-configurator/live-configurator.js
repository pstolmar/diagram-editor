async function decorate(block) {
  const configUrl = block.querySelector('a')?.href || null;
  let config;

  try {
    if (configUrl) {
      const response = await fetch(configUrl);
      config = await response.json();
    } else {
      // Fallback to demo config
      const demoUrl = new URL('live-configurator-demo.json', import.meta.url);
      const response = await fetch(demoUrl);
      config = await response.json();
    }
  } catch (error) {
    console.error('Failed to load configurator config:', error);
    return;
  }

  // Initialize state from sessionStorage or empty
  const state = JSON.parse(sessionStorage.getItem('configurator-state') || '{}');
  let currentStep = state.currentStep || 0;

  // Build DOM structure
  const wrapper = document.createElement('div');
  wrapper.className = 'configurator-wrapper';

  // Progress indicator
  const progress = document.createElement('div');
  progress.className = 'configurator-progress';
  progress.setAttribute('data-testid', 'configurator-progress');
  config.steps.forEach((_, idx) => {
    const step = document.createElement('div');
    step.className = `progress-step ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`;
    step.setAttribute('data-testid', 'progress-step');
    step.innerHTML = `<span class="step-number">${idx + 1}</span>`;
    progress.appendChild(step);
  });
  wrapper.appendChild(progress);

  // Step content container
  const stepContent = document.createElement('div');
  stepContent.className = 'step-content';

  // Price summary panel
  const pricePanel = document.createElement('div');
  pricePanel.className = 'price-summary-panel';
  pricePanel.innerHTML = `
    <div class="price-header">Price Summary</div>
    <div class="price-items"></div>
    <div class="price-total">
      <strong>Total: $<span data-testid="price-total">0</span></strong>
    </div>
  `;
  wrapper.appendChild(pricePanel);

  function updatePrice() {
    let total = 0;
    const priceItems = [];

    config.steps.forEach((step) => {
      if (step.type === 'cards') {
        const selected = step.options.find((o) => o.id === state[step.id]);
        if (selected) {
          total += selected.price;
          priceItems.push({ label: selected.label, price: selected.price });
        }
      } else if (step.type === 'toggles') {
        step.options.forEach((option) => {
          if (state[`${step.id}:${option.id}`]) {
            total += option.price;
            priceItems.push({ label: option.label, price: option.price });
          }
        });
      }
    });

    pricePanel.querySelector('[data-testid="price-total"]').textContent = total;
    const itemsContainer = pricePanel.querySelector('.price-items');
    itemsContainer.innerHTML = priceItems
      .map((item) => `<div class="price-item"><span>${item.label}</span><span>$${item.price}</span></div>`)
      .join('');
  }

  function updateNextButton() {
    const step = config.steps[currentStep];
    const nextBtn = wrapper.querySelector('.btn-next');
    if (!nextBtn) return;
    nextBtn.disabled = step.type === 'cards' && !state[step.id];
  }

  // Render current step
  function renderStep() {
    stepContent.innerHTML = '';
    const step = config.steps[currentStep];
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';

    const title = document.createElement('h2');
    title.textContent = step.title;
    stepDiv.appendChild(title);

    if (step.type === 'cards') {
      const grid = document.createElement('div');
      grid.className = 'card-grid';
      step.options.forEach((option) => {
        const card = document.createElement('div');
        card.className = 'card-option';
        card.setAttribute('data-testid', 'card-option');
        card.setAttribute('data-id', option.id);
        if (state[step.id] === option.id) {
          card.classList.add('selected');
        }
        card.innerHTML = `
          <div class="card-content">
            <h3>${option.label}</h3>
            <p>${option.description}</p>
            <span class="card-price">$${option.price}</span>
            <div class="card-check-icon">✓</div>
          </div>
        `;
        card.addEventListener('click', () => {
          document.querySelectorAll('.card-option').forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          state[step.id] = option.id;
          state.currentStep = currentStep;
          sessionStorage.setItem('configurator-state', JSON.stringify(state));
          updatePrice();
          updateNextButton();
        });
        grid.appendChild(card);
      });
      stepDiv.appendChild(grid);
    } else if (step.type === 'toggles') {
      const togglesContainer = document.createElement('div');
      togglesContainer.className = 'toggles-container';
      step.options.forEach((option) => {
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'toggle-option';
        const isChecked = state[`${step.id}:${option.id}`] || false;
        toggleDiv.innerHTML = `
          <label class="toggle-switch">
            <input type="checkbox" ${isChecked ? 'checked' : ''} data-id="${option.id}" />
            <span class="slider"></span>
          </label>
          <div class="toggle-label">
            <span>${option.label}</span>
            <span class="toggle-price">+$${option.price}</span>
          </div>
        `;
        const checkbox = toggleDiv.querySelector('input');
        checkbox.addEventListener('change', () => {
          state[`${step.id}:${option.id}`] = checkbox.checked;
          state.currentStep = currentStep;
          sessionStorage.setItem('configurator-state', JSON.stringify(state));
          updatePrice();
        });
        togglesContainer.appendChild(toggleDiv);
      });
      stepDiv.appendChild(togglesContainer);
    } else if (step.type === 'slider') {
      const sliderDiv = document.createElement('div');
      sliderDiv.className = 'slider-container';
      const currentValue = state[step.id] || step.min;
      sliderDiv.innerHTML = `
        <label>${step.label}</label>
        <input type="range" class="range-slider" min="${step.min}" max="${step.max}" value="${currentValue}" />
        <div class="slider-value-display">${currentValue} ${step.unit || ''}</div>
      `;
      const slider = sliderDiv.querySelector('input');
      slider.addEventListener('input', (e) => {
        state[step.id] = parseInt(e.target.value, 10);
        state.currentStep = currentStep;
        sessionStorage.setItem('configurator-state', JSON.stringify(state));
        sliderDiv.querySelector('.slider-value-display').textContent = `${e.target.value} ${step.unit || ''}`;
        updatePrice();
      });
      stepDiv.appendChild(sliderDiv);
    } else if (step.type === 'summary') {
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'summary-animation';
      summaryDiv.innerHTML = '<h3>Your Configuration</h3><div class="summary-items"></div>';
      const summaryItems = summaryDiv.querySelector('.summary-items');
      config.steps.forEach((s) => {
        if (s.type === 'cards') {
          const selected = s.options.find((o) => o.id === state[s.id]);
          if (selected) {
            const item = document.createElement('div');
            item.className = 'summary-item';
            item.textContent = `${s.title}: ${selected.label}`;
            summaryItems.appendChild(item);
          }
        }
      });
      stepDiv.appendChild(summaryDiv);
    }

    stepContent.appendChild(stepDiv);
  }

  // stepDiv rendered inside renderStep()
  wrapper.appendChild(stepContent);

  // Navigation buttons
  const navButtons = document.createElement('div');
  navButtons.className = 'configurator-nav';
  navButtons.innerHTML = `
    <button class="btn-prev" ${currentStep === 0 ? 'disabled' : ''}>Previous</button>
    <button class="btn-next" ${currentStep === config.steps.length - 1 ? 'style=display:none' : ''}>Next</button>
    <button class="btn-submit" ${currentStep === config.steps.length - 1 ? '' : 'style=display:none'}>
      ${config.submitLabel || 'Submit'}
    </button>
  `;

  const prevBtn = navButtons.querySelector('.btn-prev');
  const nextBtn = navButtons.querySelector('.btn-next');
  const submitBtn = navButtons.querySelector('.btn-submit');

  function updateButtons() {
    prevBtn.disabled = currentStep === 0;
    nextBtn.style.display = currentStep === config.steps.length - 1 ? 'none' : '';
    submitBtn.style.display = currentStep === config.steps.length - 1 ? '' : 'none';
    updateNextButton();
  }

  prevBtn.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep -= 1;
      state.currentStep = currentStep;
      sessionStorage.setItem('configurator-state', JSON.stringify(state));
      renderStep();
      updatePrice();
      updateButtons();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentStep < config.steps.length - 1) {
      currentStep += 1;
      state.currentStep = currentStep;
      sessionStorage.setItem('configurator-state', JSON.stringify(state));
      renderStep();
      updatePrice();
      updateButtons();
    }
  });

  submitBtn.addEventListener('click', () => {
    if (config.submitUrl) {
      window.location.href = config.submitUrl;
    } else {
      block.dispatchEvent(new CustomEvent('configurator:submit', { detail: state }));
    }
  });

  wrapper.appendChild(navButtons);
  block.appendChild(wrapper);

  // Initial render
  renderStep();
  updatePrice();
  updateButtons();
}

export default decorate;
