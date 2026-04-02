// card-reveal-hero block — tabbed hero with animated popup card + celebration effects
// Ported from mermaid-rde-tools. Experian palette applied via CSS vars.
//
// Authored as EDS table:
//   Row 1: tabStyle (pill|underline|card) | defaultTab (0-based index)
//   Row 2+: icon | label | heading | body | ctaLabel | ctaUrl |
//           panelImage | popupImage | animationPreset | celebrationVariant
//
// animationPreset: bounce | slide-right | drop-camera | flip
// celebrationVariant: sparkler | confetti | balloons | none

const ANIMATION_PRESETS = {
  bounce: 'animation: crh-spring-in 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
  'slide-right': 'animation: crh-slide-right 0.4s ease-out both',
  'drop-camera': 'animation: crh-drop-camera 0.6s cubic-bezier(0.22,1,0.36,1) both',
  flip: 'animation: crh-flip 0.45s ease-out both',
};

function parseConfig(block) {
  const cells = [...block.querySelectorAll(':scope > div:first-child > div')];
  const raw = cells.map((c) => c.textContent.trim());
  return {
    tabStyle: ['pill', 'underline', 'card'].includes(raw[0]) ? raw[0] : 'pill',
    defaultTab: parseInt(raw[1], 10) || 0,
  };
}

function parseTabs(block) {
  return [...block.children].slice(1).map((row) => {
    const cells = [...row.children];
    const t = (i) => cells[i]?.textContent.trim() || '';
    const imgSrc = (i) => cells[i]?.querySelector('img')?.src || cells[i]?.textContent.trim() || '';
    const validPresets = Object.keys(ANIMATION_PRESETS);
    const validCelebrations = ['sparkler', 'confetti', 'balloons', 'none'];
    // ctaHref: separate field (cell 5) when authored via JCR model;
    // fall back to <a> href in cell 4 for EDS document authoring
    const ctaHref = t(5) || cells[4]?.querySelector('a')?.href || '#';
    return {
      icon: t(0),
      label: t(1),
      heading: t(2),
      bodyText: t(3),
      ctaLabel: t(4),
      ctaHref,
      panelImage: imgSrc(6),
      popupImage: imgSrc(7),
      animationPreset: validPresets.includes(t(8)) ? t(8) : 'bounce',
      celebrationVariant: validCelebrations.includes(t(9)) ? t(9) : 'none',
    };
  });
}

function buildNav(tabs, config) {
  const nav = document.createElement('nav');
  nav.className = `crh-tabs crh-tabs-${config.tabStyle}`;
  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = `crh-tab${i === config.defaultTab ? ' crh-tab-active' : ''}`;
    btn.dataset.index = i;
    btn.innerHTML = `<span class="crh-tab-icon">${tab.icon}</span><span class="crh-tab-label">${tab.label}</span>`;
    nav.appendChild(btn);
  });
  return nav;
}

function applyUeAttrs(el, attrs) {
  if (!attrs?.resource) return;
  el.dataset.aueResource = attrs.resource;
  el.dataset.aueType = attrs.type || 'component';
  el.dataset.aueModel = attrs.model || 'card-reveal-hero-tab';
  if (attrs.label) el.dataset.aueLabel = attrs.label;
  if (attrs.prop) el.dataset.aueProp = attrs.prop;
  if (attrs.behavior) el.dataset.aueBehavior = attrs.behavior;
}

function buildPanel(tab, ueAttrs) {
  const panel = document.createElement('div');
  panel.className = 'crh-panel';
  applyUeAttrs(panel, ueAttrs);

  const left = document.createElement('div');
  left.className = 'crh-panel-left';
  left.innerHTML = `
    <h2 class="crh-heading">${tab.heading}</h2>
    <p class="crh-body">${tab.bodyText}</p>
    <a class="crh-cta" href="${tab.ctaHref}">${tab.ctaLabel}</a>`;

  const right = document.createElement('div');
  right.className = 'crh-panel-right';

  const mainPanel = document.createElement('div');
  mainPanel.className = 'crh-main-panel';
  if (tab.panelImage) {
    const img = document.createElement('img');
    img.src = tab.panelImage;
    img.alt = tab.label;
    mainPanel.appendChild(img);
  } else {
    mainPanel.innerHTML = `<div class="crh-main-panel-placeholder"><span>${tab.label}</span></div>`;
  }

  const popup = document.createElement('div');
  popup.className = 'crh-popup';
  if (tab.popupImage) {
    const img = document.createElement('img');
    img.src = tab.popupImage;
    img.alt = `${tab.label} card`;
    popup.appendChild(img);
  } else {
    popup.innerHTML = '<div class="crh-popup-placeholder"></div>';
  }

  right.append(mainPanel, popup);
  panel.append(left, right);
  return panel;
}

function applyPopupAnimation(popupEl, preset) {
  popupEl.style.cssText = '';
  // Force reflow so animation replays on tab switch
  // eslint-disable-next-line no-unused-expressions
  popupEl.offsetWidth;
  popupEl.style.cssText = ANIMATION_PRESETS[preset] || ANIMATION_PRESETS.bounce;
}

async function triggerCelebration(variant, mainPanelEl) {
  const fx = await import('../../scripts/fx-canvas.js');
  fx.clearFx();
  if (variant === 'sparkler') fx.fireSparkler(mainPanelEl);
  else if (variant === 'confetti') fx.fireConfetti();
  else if (variant === 'balloons') fx.fireBalloons();
}

export default function decorate(block) {
  const config = parseConfig(block);
  const tabs = parseTabs(block);
  if (!tabs.length) return;

  // Capture UE instrumentation attrs from original tab rows before wiping DOM
  const itemAttrs = [...block.children].slice(1).map((row) => ({
    resource: row.dataset.aueResource,
    type: row.dataset.aueType || 'component',
    model: row.dataset.aueModel || 'card-reveal-hero-tab',
    label: row.dataset.aueLabel,
    prop: row.dataset.aueProp,
    behavior: row.dataset.aueBehavior,
  }));

  // Also capture container-level UE attrs
  const blockResource = block.dataset.aueResource;
  const blockModel = block.dataset.aueModel || 'card-reveal-hero';

  // Restore previously active tab if decorate() was re-run by UE after a property save.
  // block.dataset survives block.innerHTML = '' (innerHTML only wipes children).
  const storedIdx = parseInt(block.dataset.crhActive || '', 10);
  const defaultIdx = Number.isNaN(storedIdx) ? config.defaultTab : storedIdx;
  const activeIdx = Math.min(Math.max(0, defaultIdx), tabs.length - 1);
  block.innerHTML = '';

  // Re-apply container UE attrs (innerHTML wipe removes dataset too)
  if (blockResource) {
    block.dataset.aueResource = blockResource;
    block.dataset.aueModel = blockModel;
    block.dataset.aueType = 'component';
    block.dataset.aueBehavior = 'component';
  }

  const nav = buildNav(tabs, { ...config, defaultTab: activeIdx });
  // No UE attrs on nav buttons — lets clicks pass through to our handler in author mode.

  const panelContainer = document.createElement('div');
  panelContainer.className = 'crh-panel-container';

  let currentPanel = buildPanel(tabs[activeIdx], itemAttrs[activeIdx]);
  panelContainer.appendChild(currentPanel);
  block.append(nav, panelContainer);

  requestAnimationFrame(() => {
    const popup = currentPanel.querySelector('.crh-popup');
    if (popup) applyPopupAnimation(popup, tabs[activeIdx].animationPreset);
    triggerCelebration(tabs[activeIdx].celebrationVariant, currentPanel.querySelector('.crh-main-panel'));
  });

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.crh-tab');
    if (!btn || btn.classList.contains('crh-tab-active')) return;
    const idx = parseInt(btn.dataset.index, 10);

    block.dataset.crhActive = idx; // survives re-decoration on UE property save
    nav.querySelectorAll('.crh-tab').forEach((t) => t.classList.remove('crh-tab-active'));
    btn.classList.add('crh-tab-active');

    currentPanel.remove();
    currentPanel = buildPanel(tabs[idx], itemAttrs[idx]);
    panelContainer.appendChild(currentPanel);

    const popup = currentPanel.querySelector('.crh-popup');
    if (popup) applyPopupAnimation(popup, tabs[idx].animationPreset);
    triggerCelebration(tabs[idx].celebrationVariant, currentPanel.querySelector('.crh-main-panel'));
  });
}
