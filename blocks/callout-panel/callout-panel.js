import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const rows = [...block.children];
  const [titleRow, bodyRow, ctaRow, iconRow] = rows;

  const panel = document.createElement('div');
  panel.className = 'callout-panel-inner';
  moveInstrumentation(block, panel);

  if (iconRow) {
    const iconEl = document.createElement('div');
    iconEl.className = 'callout-panel-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = iconRow.textContent.trim();
    panel.append(iconEl);
  }

  if (titleRow) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'callout-panel-title';
    titleEl.textContent = titleRow.textContent.trim();
    panel.append(titleEl);
  }

  if (bodyRow) {
    const bodyEl = document.createElement('p');
    bodyEl.className = 'callout-panel-body';
    bodyEl.textContent = bodyRow.textContent.trim();
    panel.append(bodyEl);
  }

  if (ctaRow) {
    const cols = [...ctaRow.children];
    const ctaLabel = cols[0] ? cols[0].textContent.trim() : 'Learn More';
    const ctaHref = cols[1] ? cols[1].textContent.trim() : '#';

    const cta = document.createElement('a');
    cta.className = 'callout-panel-cta button';
    cta.href = ctaHref;
    cta.textContent = ctaLabel;
    panel.append(cta);
  }

  block.replaceChildren(panel);
}
