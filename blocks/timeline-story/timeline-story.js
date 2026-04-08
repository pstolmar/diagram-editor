import { loadCSS } from '../../scripts/aem.js';

export default async function decorate(block) {
  loadCSS(`${import.meta.url.replace(/\.js$/, '.css')}`);

  // Parse table data
  let rows = Array.from(block.querySelectorAll('tr')).map((row) => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    return {
      date: cells[0]?.textContent?.trim() || '',
      category: cells[1]?.textContent?.trim() || '',
      title: cells[2]?.textContent?.trim() || '',
      body: cells[3]?.textContent?.trim() || '',
      icon: cells[4]?.textContent?.trim() || '',
    };
  }).filter((r) => r.title || r.date);
  if (!rows.length) {
    try {
      const resp = await fetch(new URL('timeline-story-demo.json', import.meta.url));
      const json = await resp.json();
      rows = (Array.isArray(json) ? json : json.entries ?? []);
    } catch { /* ignore */ }
  }

  block.innerHTML = '';

  // Get unique categories
  const categories = ['all', ...new Set(rows.map((r) => r.category))];

  // Create filter pills
  const filterContainer = document.createElement('div');
  filterContainer.className = 'timeline-filters';

  categories.forEach((cat) => {
    const pill = document.createElement('button');
    pill.className = `timeline-filter ${cat === 'all' ? 'active' : ''}`;
    pill.textContent = cat === 'all' ? 'All' : cat;
    pill.setAttribute('data-timeline-filter', cat);

    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-timeline-filter]').forEach((p) => {
        p.classList.remove('active');
      });
      pill.classList.add('active');

      document.querySelectorAll('[data-timeline-entry]').forEach((entry) => {
        const entryCat = entry.getAttribute('data-timeline-category');
        if (cat === 'all' || entryCat === cat) {
          entry.style.display = '';
        } else {
          entry.style.display = 'none';
        }
      });
    });

    filterContainer.appendChild(pill);
  });

  block.appendChild(filterContainer);

  // Create progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'timeline-progress-bar';
  progressBar.setAttribute('data-timeline-progress', '');
  block.appendChild(progressBar);

  // Get unique years for nav
  const years = [...new Set(
    rows.map((r) => {
      const year = r.date.split('-')[0];
      return year;
    }),
  )].filter((y) => y && !Number.isNaN(Number(y))).sort();

  // Create year nav if multi-year
  if (years.length > 1) {
    const yearNav = document.createElement('div');
    yearNav.className = 'timeline-years';
    yearNav.setAttribute('data-timeline-years', '');

    years.forEach((year) => {
      const btn = document.createElement('button');
      btn.className = 'timeline-year-item';
      btn.textContent = year;
      btn.setAttribute('data-timeline-year-item', year);

      btn.addEventListener('click', () => {
        const firstEntryForYear = document.querySelector(
          `[data-timeline-entry][data-timeline-year="${year}"]`,
        );
        if (firstEntryForYear) {
          firstEntryForYear.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      yearNav.appendChild(btn);
    });

    block.appendChild(yearNav);
  }

  // Create timeline entries
  const timeline = document.createElement('div');
  timeline.className = 'timeline';

  const entries = [];

  rows.forEach((row, idx) => {
    const entry = document.createElement('div');
    entry.className = 'timeline-entry';
    entry.setAttribute('data-timeline-entry', '');
    entry.setAttribute('data-timeline-category', row.category);
    entry.setAttribute('data-timeline-index', idx);

    const year = row.date.split('-')[0];
    if (year) {
      entry.setAttribute('data-timeline-year', year);
    }

    entry.tabIndex = 0;

    const entryContent = document.createElement('div');
    entryContent.className = 'timeline-entry-content';

    const entryHeader = document.createElement('div');
    entryHeader.className = 'timeline-entry-header';

    const dateEl = document.createElement('div');
    dateEl.className = 'timeline-date';
    dateEl.setAttribute('data-timeline-date', '');
    dateEl.textContent = row.date;

    const categoryEl = document.createElement('span');
    categoryEl.className = 'timeline-category';
    categoryEl.setAttribute('data-timeline-category', '');
    categoryEl.textContent = row.category;

    const titleEl = document.createElement('h3');
    titleEl.className = 'timeline-title';
    titleEl.setAttribute('data-timeline-title', '');
    titleEl.textContent = row.title;

    entryHeader.appendChild(dateEl);
    entryHeader.appendChild(categoryEl);
    entryHeader.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'timeline-body';
    bodyEl.setAttribute('data-timeline-body', '');
    bodyEl.textContent = row.body;

    entryContent.appendChild(entryHeader);
    entryContent.appendChild(bodyEl);

    if (row.icon) {
      const iconEl = document.createElement('div');
      iconEl.className = 'timeline-icon';
      iconEl.textContent = row.icon;
      entryContent.insertBefore(iconEl, entryHeader);
    }

    entry.appendChild(entryContent);
    entries.push(entry);
    timeline.appendChild(entry);
  });

  block.appendChild(timeline);

  // Add expand/collapse behavior
  entries.forEach((entry) => {
    entry.addEventListener('click', (e) => {
      if (e.target.closest('.timeline-entry-header')) {
        entry.classList.toggle('expanded');
      }
    });

    entry.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        entry.classList.toggle('expanded');
      }
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    const activeEntry = document.activeElement?.closest('[data-timeline-entry]');
    if (!activeEntry) return;

    const visibleEntries = Array.from(
      document.querySelectorAll('[data-timeline-entry]:not([style*="display: none"])'),
    );
    const currentIdx = visibleEntries.indexOf(activeEntry);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIdx < visibleEntries.length - 1) {
        visibleEntries[currentIdx + 1].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIdx > 0) {
        visibleEntries[currentIdx - 1].focus();
      }
    }
  });

  // Scroll animation with IntersectionObserver
  const observer = new IntersectionObserver((intersections) => {
    intersections.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('[data-timeline-entry]').forEach((entry) => {
    observer.observe(entry);
  });

  // Progress bar update on scroll
  const updateProgressBar = () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = (window.scrollY / scrollHeight) * 100;
    const bar = document.querySelector('[data-timeline-progress]');
    if (bar) {
      bar.style.height = `${scrolled}%`;
    }
  };

  window.addEventListener('scroll', updateProgressBar);
}
