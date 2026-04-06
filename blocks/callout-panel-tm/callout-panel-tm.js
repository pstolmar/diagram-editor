export default function decorate(block) {
  const rows = [...block.children];

  const title = rows[0]?.children[0]?.textContent.trim() || '';
  const body = rows[1]?.children[0]?.innerHTML || '';
  const ctaLabel = rows[2]?.children[0]?.textContent.trim() || 'Learn More';
  const ctaUrl = rows[2]?.children[1]?.textContent.trim() || '#';
  const icon = rows[3]?.children[0]?.textContent.trim() || '';

  block.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'cp-tm-panel';

  if (icon) {
    const iconEl = document.createElement('div');
    iconEl.className = 'cp-tm-icon';
    iconEl.textContent = icon;
    panel.append(iconEl);
  }

  const content = document.createElement('div');
  content.className = 'cp-tm-content';

  if (title) {
    const h2 = document.createElement('h2');
    h2.className = 'cp-tm-title';
    h2.textContent = title;
    content.append(h2);
  }

  if (body) {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'cp-tm-body';
    bodyEl.innerHTML = body;
    content.append(bodyEl);
  }

  const cta = document.createElement('a');
  cta.className = 'cp-tm-cta';
  cta.href = ctaUrl;
  cta.textContent = ctaLabel;

  content.append(cta);
  panel.append(content);
  block.append(panel);
}
