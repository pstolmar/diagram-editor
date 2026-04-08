const SCROLL_DEMO_URL = new URL('scroll-reveal-demo.json', import.meta.url);

export default async function decorate(block) {
  const table = block.querySelector('table');
  let panels = [];
  if (table) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    panels = rows.map((row) => {
      const cells = row.querySelectorAll('td');
      return {
        label: cells[0]?.textContent?.trim() || '',
        heading: cells[1]?.textContent?.trim() || '',
        body: cells[2]?.innerHTML || '',
        visual: cells[3]?.textContent?.trim() || '',
      };
    });
  }
  if (!panels.length) {
    try {
      const resp = await fetch(SCROLL_DEMO_URL);
      const json = await resp.json();
      panels = json.panels ?? json;
    } catch { /* ignore */ }
  }
  if (!panels.length) return;

  if (panels.length === 0) return;

  // Remove original table if present
  if (table) table.remove();

  // Create structure
  const container = document.createElement('div');
  container.className = 'scroll-reveal-container';

  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-reveal-progress';
  container.appendChild(progressBar);

  // Main content wrapper
  const mainWrapper = document.createElement('div');
  mainWrapper.className = 'scroll-reveal-main';

  // Sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'scroll-reveal-sidebar';

  // Panels container
  const panelsContainer = document.createElement('div');
  panelsContainer.className = 'scroll-reveal-panels';

  // Create sidebar labels and panels
  panels.forEach((panel, index) => {
    // Sidebar label
    const label = document.createElement('button');
    label.className = 'scroll-reveal-label';
    label.textContent = panel.label;
    label.dataset.index = index;
    label.addEventListener('click', () => {
      const targetPanel = panelsContainer.querySelector(
        `[data-index="${index}"]`,
      );
      if (targetPanel) {
        targetPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    sidebar.appendChild(label);

    // Panel
    const panelEl = document.createElement('section');
    panelEl.className = 'scroll-reveal-panel';
    panelEl.dataset.index = index;

    const heading = document.createElement('h2');
    heading.className = 'scroll-reveal-heading';
    heading.textContent = panel.heading;

    const body = document.createElement('div');
    body.className = 'scroll-reveal-body';
    body.innerHTML = panel.body;

    const visual = document.createElement('div');
    visual.className = 'scroll-reveal-visual';

    // Determine if visual is URL or color
    if (
      panel.visual.startsWith('http://')
      || panel.visual.startsWith('https://')
      || panel.visual.startsWith('/')
    ) {
      const img = document.createElement('img');
      img.src = panel.visual;
      img.alt = panel.heading;
      visual.appendChild(img);
    } else if (panel.visual.startsWith('#') || panel.visual.includes('rgb')) {
      visual.style.backgroundColor = panel.visual;
    }

    panelEl.appendChild(heading);
    panelEl.appendChild(body);
    panelEl.appendChild(visual);
    panelsContainer.appendChild(panelEl);
  });

  mainWrapper.appendChild(sidebar);
  mainWrapper.appendChild(panelsContainer);
  container.appendChild(mainWrapper);
  block.appendChild(container);

  // IntersectionObserver for active label
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const { index } = entry.target.dataset;
          sidebar.querySelectorAll('.scroll-reveal-label').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.index === index);
          });
        }
      });
    },
    { threshold: 0.3 },
  );

  panelsContainer
    .querySelectorAll('.scroll-reveal-panel')
    .forEach((panel) => observer.observe(panel));

  // Progress bar scroll tracking
  const updateProgress = () => {
    const panelsRect = panelsContainer.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollProgress = Math.max(
      0,
      Math.min(
        1,
        1 - panelsRect.bottom / (containerRect.height * 2),
      ),
    ) * 100;
    progressBar.style.width = `${scrollProgress}%`;
  };

  window.addEventListener('scroll', updateProgress, { passive: true });

  // Back to top button (appears after first panel)
  const backToTopBtn = document.createElement('button');
  backToTopBtn.className = 'scroll-reveal-back-to-top';
  backToTopBtn.textContent = '↑ Back to top';
  backToTopBtn.addEventListener('click', () => {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const secondPanel = panelsContainer.querySelector(
    '.scroll-reveal-panel[data-index="1"]',
  );
  if (secondPanel) {
    secondPanel.insertAdjacentElement('beforebegin', backToTopBtn);
  } else {
    panelsContainer.appendChild(backToTopBtn);
  }

  // Observe back-to-top visibility
  const backToTopObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      backToTopBtn.style.display = entry.isIntersecting ? 'none' : 'block';
    });
  });
  const firstPanel = panelsContainer.querySelector(
    '.scroll-reveal-panel[data-index="0"]',
  );
  if (firstPanel) {
    backToTopObserver.observe(firstPanel);
  }

  // Trigger animation on panel scroll into view
  const animationObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !entry.target.classList.contains('reveal')) {
          entry.target.classList.add('reveal');
        }
      });
    },
    { threshold: 0.2 },
  );

  panelsContainer
    .querySelectorAll('.scroll-reveal-panel')
    .forEach((panel) => animationObserver.observe(panel));
}
