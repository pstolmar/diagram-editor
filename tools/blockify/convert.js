/**
 * AEM to EDS Blockify — core conversion logic
 * Browser + Deno compatible ES module.
 * In Node, requires `linkedom` devDependency for HTML parsing.
 *
 * Exports:
 *   analyzeHTML(html, sourceUrl)     → Promise<analysis>  (parses + analyzes)
 *   analyzeDocument(doc, sourceUrl)  → analysis           (uses pre-parsed Document)
 *   toEDSPage(analysis)              → string (full EDS-ready HTML)
 *   toBlockStub(blockName)           → { js: string, css: string }
 *   toComponentDefinitionEntry(name) → object
 *   slugFromSource(source)           → string
 */

/* eslint-disable no-console */

// ---------------------------------------------------------------------------
// AEM component patterns
// ---------------------------------------------------------------------------

const AEM = {
  title: '.cmp-title',
  text: '.cmp-text',
  image: '.cmp-image',
  button: '.cmp-button',
  teaser: '.cmp-teaser',
  container: '.cmp-container',
  list: '.cmp-list',
  carousel: '.cmp-carousel, .cmp-tabs',
  xf: '.cmp-experiencefragment, .xf-content-container',
};

const AEM_LABELS = {
  title: 'Title',
  text: 'Text',
  image: 'Image',
  button: 'Button',
  teaser: 'Teaser',
  container: 'Container',
  list: 'List',
  carousel: 'Carousel',
  xf: 'Experience Fragment',
};

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Parse HTML to Document.
 * - Browser / Deno: uses native DOMParser (synchronous)
 * - Node: dynamically imports linkedom (requires `npm i -D linkedom`)
 *
 * @param {string} html
 * @returns {Promise<Document>}
 */
async function parseHTMLToDocument(html) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html');
  }
  // Node fallback — linkedom provides a compatible DOM API
  try {
    const { parseHTML: linkedomParse } = await import('linkedom');
    return linkedomParse(html).document;
  } catch {
    throw new Error(
      'No DOMParser available and linkedom is not installed.\n'
      + 'Run: npm install --save-dev linkedom',
    );
  }
}

function has(el, type) {
  return el.querySelector(AEM[type]) !== null;
}

function getComponentTypes(el) {
  return Object.keys(AEM).filter((type) => has(el, type));
}

/**
 * Find the top-level section containers in the AEM page.
 * Looks for the root .aem-Grid and returns its direct .aem-GridColumn children.
 * Falls back to direct children of <main> or <body>.
 *
 * @param {Document} doc
 * @returns {Element[]}
 */
function findSections(doc) {
  // Strategy 1: root .aem-Grid -> direct .aem-GridColumn children
  const rootGrid = doc.querySelector(
    'body .aem-Grid, main .aem-Grid, .root .aem-Grid, .page__content .aem-Grid',
  );
  if (rootGrid) {
    const cols = [...rootGrid.querySelectorAll(':scope > .aem-GridColumn')];
    if (cols.length > 0) return cols;
  }

  // Strategy 2: direct .aem-GridColumn anywhere at shallow depth
  const allCols = [...doc.querySelectorAll('.aem-GridColumn')];
  if (allCols.length > 0) {
    // Keep only the outermost ones (not nested inside other GridColumns)
    return allCols.filter((col) => !col.parentElement?.closest('.aem-GridColumn'));
  }

  // Strategy 3: children of <main>
  const main = doc.querySelector('main');
  if (main) {
    const children = [...main.children].filter((c) => c.nodeType === 1);
    if (children.length > 0) return children;
  }

  // Strategy 4: body children
  return [...(doc.body?.children || [])].filter((c) => c.nodeType === 1);
}

// ---------------------------------------------------------------------------
// Classification rules (section-first)
// ---------------------------------------------------------------------------

/**
 * Classify a section element into an EDS block type.
 * Rules are evaluated in priority order.
 *
 * @param {Element} el
 * @param {string[]} componentTypes — types detected in el
 * @returns {{ blockName: string|null, confidence: number, reason: string }}
 */
function classifySection(el, componentTypes) {
  const h = (t) => componentTypes.includes(t);

  // Columns: explicit multi-column grid layout (check BEFORE hero so side-by-side layouts win)
  const innerCols = el.querySelectorAll(
    ':scope > .aem-Grid > .aem-GridColumn, '
    + ':scope > .cmp-container > .responsivegrid > .aem-Grid > .aem-GridColumn',
  );
  if (innerCols.length >= 2) {
    return { blockName: 'columns', confidence: 0.90, reason: `${innerCols.length} inner columns` };
  }

  // Hero: image + title + text/button in same flat section (not multi-column)
  if (h('image') && h('title') && (h('text') || h('button'))) {
    return { blockName: 'hero', confidence: 0.95, reason: 'image+title+text/button' };
  }
  if (h('image') && h('title')) {
    return { blockName: 'hero', confidence: 0.80, reason: 'image+title' };
  }

  // Carousel / tabs
  if (h('carousel')) {
    return { blockName: 'carousel', confidence: 0.92, reason: 'carousel/tabs component' };
  }

  // Teaser
  if (h('teaser')) {
    return {
      blockName: 'teaser',
      confidence: componentTypes.length === 1 ? 0.95 : 0.78,
      reason: 'teaser component',
    };
  }

  // List
  if (h('list')) {
    return {
      blockName: 'list',
      confidence: componentTypes.length === 1 ? 0.92 : 0.75,
      reason: 'list component',
    };
  }

  // Buttons only
  if (h('button') && !h('text') && !h('title') && !h('image')) {
    return { blockName: 'buttons', confidence: 0.88, reason: 'buttons only' };
  }

  // XF — inline as its contained types
  if (h('xf')) {
    return { blockName: null, confidence: 0.90, reason: 'XF inlined' };
  }

  // Pure title (no structural components)
  if (h('title') && !h('image') && !h('teaser') && !h('carousel') && !h('list')) {
    return { blockName: null, confidence: 0.90, reason: 'plain heading' };
  }

  // Pure text
  if (h('text') && !h('image') && !h('teaser') && !h('carousel')) {
    return { blockName: null, confidence: 0.85, reason: 'plain text' };
  }

  // Image alone
  if (h('image') && componentTypes.length === 1) {
    return { blockName: null, confidence: 0.80, reason: 'standalone image' };
  }

  // Mixed / unknown → plain passthrough
  return { blockName: null, confidence: 0.55, reason: 'mixed/unknown' };
}

// ---------------------------------------------------------------------------
// Content extractors
// ---------------------------------------------------------------------------

function extractTitleHTML(el) {
  const titleEl = el.querySelector(AEM.title);
  if (!titleEl) return '';
  const heading = titleEl.querySelector('h1,h2,h3,h4,h5,h6');
  if (heading) {
    const tag = heading.tagName.toLowerCase();
    return `<${tag}>${heading.textContent.trim()}</${tag}>`;
  }
  return `<h2>${titleEl.textContent.trim()}</h2>`;
}

function extractTextHTML(el) {
  const textEl = el.querySelector(AEM.text);
  if (!textEl) return '';
  // .cmp-text contains rich text; preserve inner markup
  return textEl.innerHTML.trim();
}

function extractImageHTML(el) {
  const cmpImg = el.querySelector(AEM.image);
  if (!cmpImg) return '';
  // Look for <img> or <picture>
  const picture = cmpImg.querySelector('picture');
  if (picture) return picture.outerHTML;
  const img = cmpImg.querySelector('img');
  if (img) {
    const src = img.getAttribute('src') || img.dataset.src || img.dataset.cmpSrc || img.dataset.lazySrc || '';
    const alt = img.getAttribute('alt') || '';
    return `<img src="${src}" alt="${alt}" loading="lazy">`;
  }
  return '';
}

function extractButtonsHTML(el) {
  const btns = [...el.querySelectorAll(`${AEM.button} a, a${AEM.button}`)];
  if (btns.length === 0) {
    // Try generic CTA links
    const ctas = [...el.querySelectorAll('.cmp-button')];
    return ctas.map((b) => `<a href="#">${b.textContent.trim()}</a>`).join('\n');
  }
  return btns.map((a) => {
    const href = a.getAttribute('href') || '#';
    return `<a href="${href}">${a.textContent.trim()}</a>`;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Block HTML builders
// ---------------------------------------------------------------------------

function buildHeroHTML(el) {
  const img = extractImageHTML(el);
  const title = extractTitleHTML(el);
  const text = extractTextHTML(el);
  const btns = extractButtonsHTML(el);

  const textParts = [title, text, btns].filter(Boolean);
  const textCell = textParts.join('\n');

  if (img && textCell) {
    return [
      '<div class="hero">',
      '  <div>',
      `    <div>${img}</div>`,
      `    <div>${textCell}</div>`,
      '  </div>',
      '</div>',
    ].join('\n');
  }
  const content = img || textCell || '';
  return [
    '<div class="hero">',
    '  <div>',
    `    <div>${content}</div>`,
    '  </div>',
    '</div>',
  ].join('\n');
}

function buildColumnsHTML(el) {
  // Find the inner columns
  let cols = [...el.querySelectorAll(':scope > .aem-Grid > .aem-GridColumn')];
  if (cols.length === 0) {
    cols = [...el.querySelectorAll('.cmp-container > .responsivegrid > .aem-Grid > .aem-GridColumn')];
  }
  if (cols.length === 0) {
    cols = [...el.querySelectorAll('.aem-GridColumn')].slice(0, 2);
  }

  const cells = cols.map((col) => {
    const parts = [
      extractImageHTML(col),
      extractTitleHTML(col),
      extractTextHTML(col),
      extractButtonsHTML(col),
    ].filter(Boolean);
    return `    <div>${parts.join('\n')}</div>`;
  });

  return [
    '<div class="columns">',
    '  <div>',
    ...cells,
    '  </div>',
    '</div>',
  ].join('\n');
}

function buildTeaserHTML(el) {
  const teaserEl = el.querySelector(AEM.teaser);
  if (!teaserEl) return '<div class="teaser"><div><div></div></div></div>';

  const img = extractImageHTML(teaserEl);
  const titleEl = teaserEl.querySelector('.cmp-teaser__title, h2, h3');
  const descEl = teaserEl.querySelector('.cmp-teaser__description, p');
  const ctaEl = teaserEl.querySelector('.cmp-teaser__action-link, .cmp-teaser__action a, a');

  const textParts = [];
  if (titleEl) textParts.push(`<h3>${titleEl.textContent.trim()}</h3>`);
  if (descEl) textParts.push(`<p>${descEl.textContent.trim()}</p>`);
  if (ctaEl) textParts.push(`<a href="${ctaEl.getAttribute('href') || '#'}">${ctaEl.textContent.trim()}</a>`);

  if (img && textParts.length) {
    return [
      '<div class="teaser">',
      '  <div>',
      `    <div>${img}</div>`,
      `    <div>${textParts.join('\n')}</div>`,
      '  </div>',
      '</div>',
    ].join('\n');
  }
  const content = img || textParts.join('\n') || '';
  return [
    '<div class="teaser">',
    '  <div>',
    `    <div>${content}</div>`,
    '  </div>',
    '</div>',
  ].join('\n');
}

function buildListHTML(el) {
  const listEl = el.querySelector(AEM.list);
  if (!listEl) return '<div class="list"><div><div></div></div></div>';

  const items = [...listEl.querySelectorAll('li, .cmp-list__item')];
  if (items.length === 0) {
    return '<div class="list"><div><div></div></div></div>';
  }

  const rows = items.map((item) => {
    const a = item.querySelector('a');
    const content = a
      ? `<a href="${a.getAttribute('href') || '#'}">${a.textContent.trim()}</a>`
      : item.textContent.trim();
    return `  <div>\n    <div>${content}</div>\n  </div>`;
  });

  return ['<div class="list">', ...rows, '</div>'].join('\n');
}

function buildCarouselHTML(el) {
  const carouselEl = el.querySelector(AEM.carousel);
  if (!carouselEl) return '<div class="carousel"><div><div></div></div></div>';

  const items = [
    ...carouselEl.querySelectorAll('.cmp-carousel__item, .cmp-tabs__tabpanel, .cmp-tabs__tab'),
  ];

  if (items.length === 0) {
    return '<div class="carousel"><div><div></div></div></div>';
  }

  const rows = items.map((item) => {
    const img = extractImageHTML(item);
    const heading = item.querySelector('h1,h2,h3,h4');
    const para = item.querySelector('p');
    const parts = [
      img,
      heading ? `<h3>${heading.textContent.trim()}</h3>` : '',
      para ? `<p>${para.textContent.trim()}</p>` : '',
    ].filter(Boolean);
    const content = parts.join('\n') || item.textContent.trim().substring(0, 150);
    return `  <div>\n    <div>${content}</div>\n  </div>`;
  });

  return ['<div class="carousel">', ...rows, '</div>'].join('\n');
}

function buildButtonsHTML(el) {
  const btns = [...el.querySelectorAll(`${AEM.button} a, a.cmp-button, .cmp-button`)];
  const links = btns.map((b) => {
    const a = b.tagName === 'A' ? b : b.querySelector('a');
    if (a) return `    <div><a href="${a.getAttribute('href') || '#'}">${a.textContent.trim()}</a></div>`;
    return `    <div><a href="#">${b.textContent.trim()}</a></div>`;
  });

  return [
    '<div class="buttons">',
    '  <div>',
    ...(links.length ? links : ['    <div><a href="#">Learn More</a></div>']),
    '  </div>',
    '</div>',
  ].join('\n');
}

function buildPlainHTML(el, componentTypes) {
  const h = (t) => componentTypes.includes(t);
  const parts = [];

  if (h('image')) {
    const img = extractImageHTML(el);
    if (img) parts.push(img);
  }
  if (h('title')) {
    const title = extractTitleHTML(el);
    if (title) parts.push(title);
  }
  if (h('text')) {
    const text = extractTextHTML(el);
    if (text) parts.push(text);
  }
  if (h('button')) {
    const btns = extractButtonsHTML(el);
    if (btns) parts.push(btns);
  }
  if (parts.length === 0 && el.textContent.trim()) {
    parts.push(`<p>${el.textContent.trim().substring(0, 300)}</p>`);
  }

  return parts.join('\n');
}

/**
 * Build EDS block HTML for a section given its classification.
 */
function buildBlockHTML(el, classification, componentTypes) {
  if (classification.blockName === null) {
    return buildPlainHTML(el, componentTypes);
  }
  switch (classification.blockName) {
    case 'hero': return buildHeroHTML(el);
    case 'columns': return buildColumnsHTML(el);
    case 'teaser': return buildTeaserHTML(el);
    case 'list': return buildListHTML(el);
    case 'carousel': return buildCarouselHTML(el);
    case 'buttons': return buildButtonsHTML(el);
    default:
      return [
        `<div class="${classification.blockName}">`,
        '  <div>',
        `    <div>${el.textContent.trim().substring(0, 200)}</div>`,
        '  </div>',
        '</div>',
      ].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive a URL slug from a URL or file path.
 * @param {string} source — URL or file path
 * @returns {string}
 */
export function slugFromSource(source) {
  if (!source) return 'page';
  try {
    const url = new URL(source);
    const parts = url.pathname.replace(/\.html$/, '').split('/').filter(Boolean);
    return parts[parts.length - 1] || url.hostname.replace(/\./g, '-');
  } catch {
    // file path
    return source.split(/[/\\]/).pop().replace(/\.[^.]+$/, '') || 'page';
  }
}

/**
 * Core analysis logic — works with a pre-parsed Document.
 * Use this from Deno or Node when you supply your own parser.
 *
 * @param {Document} doc
 * @param {string} [sourceUrl]
 * @returns {{ sourceUrl, pageTitle, sections, classificationTable }}
 */
export function analyzeDocument(doc, sourceUrl = '') {
  const pageTitle = doc.querySelector('title')?.textContent?.trim()
    || doc.querySelector('h1')?.textContent?.trim()
    || slugFromSource(sourceUrl);

  const sectionEls = findSections(doc);
  const sections = [];
  const classificationTable = [];

  sectionEls.forEach((el, index) => {
    const componentTypes = getComponentTypes(el);

    // Skip completely empty sections
    if (componentTypes.length === 0 && !el.textContent.trim()) return;

    const classification = classifySection(el, componentTypes);
    const blockHtml = buildBlockHTML(el, classification, componentTypes);

    sections.push({
      index,
      aemComponents: componentTypes,
      classification,
      blockHtml,
      isPlain: classification.blockName === null,
    });

    const componentLabel = componentTypes.length
      ? componentTypes.map((t) => AEM_LABELS[t] || t).join(', ')
      : 'Empty';

    classificationTable.push({
      section: index + 1,
      components: componentLabel,
      detectedType: classification.reason,
      blockName: classification.blockName || '(plain)',
      confidence: `${Math.round(classification.confidence * 100)}%`,
    });
  });

  return {
    sourceUrl,
    pageTitle,
    sections,
    classificationTable,
  };
}

/**
 * Parse an HTML string and analyze it.
 * Returns a Promise — uses DOMParser in browser/Deno, linkedom in Node.
 *
 * @param {string} html
 * @param {string} [sourceUrl]
 * @returns {Promise<{ sourceUrl, pageTitle, sections, classificationTable }>}
 */
export async function analyzeHTML(html, sourceUrl = '') {
  const doc = await parseHTMLToDocument(html);
  return analyzeDocument(doc, sourceUrl);
}

/**
 * Convert an analyzeHTML result into a full EDS-ready HTML page string.
 *
 * EDS page structure:
 *   <main>
 *     <div>              ← section boundary
 *       <h1>...</h1>     ← plain content (no block wrapper)
 *       <div class="hero">...</div>  ← block
 *     </div>
 *   </main>
 *
 * @param {{ pageTitle: string, sections: Array, sourceUrl: string }} analysis
 * @returns {string}
 */
export function toEDSPage(analysis) {
  const { pageTitle, sections, sourceUrl } = analysis;

  // Group consecutive plain sections together, and each block section gets its own section div.
  // EDS convention: wrap blocks in section divs for proper decoration.
  const sectionDivs = [];
  let currentPlainSection = [];

  function flushPlain() {
    if (currentPlainSection.length === 0) return;
    sectionDivs.push(`<div>\n${currentPlainSection.join('\n')}\n</div>`);
    currentPlainSection = [];
  }

  sections.forEach((section) => {
    if (section.isPlain) {
      currentPlainSection.push(section.blockHtml);
    } else {
      // Flush any accumulated plain content first
      flushPlain();
      // Each block goes in its own section div
      sectionDivs.push(`<div>\n${section.blockHtml}\n</div>`);
    }
  });
  flushPlain();

  const mainContent = sectionDivs.join('\n\n');
  const sourceComment = sourceUrl ? `\n  <!-- Converted from: ${sourceUrl} -->\n` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pageTitle}</title>
  <script src="/scripts/aem.js" type="module"></script>
  <script src="/scripts/scripts.js" type="module"></script>
  <link rel="stylesheet" href="/styles/styles.css">
</head>
<body>
  <header></header>
  <main>${sourceComment}
${mainContent}
  </main>
  <footer></footer>
</body>
</html>`;
}

/**
 * Generate stub JS and CSS files for an EDS block.
 *
 * @param {string} blockName — e.g. 'hero', 'teaser'
 * @returns {{ js: string, css: string }}
 */
export function toBlockStub(blockName) {
  const title = blockName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const js = `/* ${title} block */
/* eslint-disable no-console */

/**
 * Decorate the ${title} block.
 * EDS calls this automatically when a .${blockName} element is found in the page.
 *
 * @param {HTMLElement} block — the block's root <div class="${blockName}">
 */
export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  rows.forEach((row) => {
    const cells = [...row.children];
    cells.forEach((cell) => {
      // Process each cell: images, headings, links, text
      const imgs = [...cell.querySelectorAll('img')];
      imgs.forEach((img) => {
        img.loading = 'lazy';
      });
    });

    // Add block-specific classes for CSS targeting
    if (cells.length > 1) {
      row.classList.add('${blockName}__row');
      cells.forEach((cell, i) => cell.classList.add(\`${blockName}__cell-\${i + 1}\`));
    }
  });
}
`;

  const css = `/* ${title} block styles */

.${blockName} {
  /* block container */
}

.${blockName} > div {
  /* row */
}

.${blockName} > div > div {
  /* cell */
}
`;

  return { js, css };
}

/**
 * Generate the component-definition.json entry for a new block.
 *
 * @param {string} blockName
 * @returns {object}
 */
export function toComponentDefinitionEntry(blockName) {
  const title = blockName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    title,
    id: blockName,
    plugins: {
      xwalk: {
        page: {
          resourceType: 'core/franklin/components/block/v1/block',
          template: {
            name: title,
            model: blockName,
          },
        },
      },
    },
  };
}
