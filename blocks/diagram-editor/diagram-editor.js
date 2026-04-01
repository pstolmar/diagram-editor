/* Minimal Diagram Editor block – v0: Mermaid-only */

const MERMAID_ESM = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

async function loadMermaid() {
  if (window.__diagramMermaid) {
    return window.__diagramMermaid;
  }
  const mod = await import(MERMAID_ESM);
  // basic safe defaults; you can enrich with theme/palette later
  mod.default.initialize({ startOnLoad: false });
  window.__diagramMermaid = mod.default;
  return window.__diagramMermaid;
}

/**
 * Main block entry point.
 * This follows the Edge Delivery convention: export default async function decorate(block) { ... }
 */
export default async function decorate(block) {
  const engine = (block.dataset.engine || 'mermaid').toLowerCase();
  if (engine !== 'mermaid') {
    console.warn('[diagram-editor] Only mermaid engine is implemented in v0.');
    return;
  }

  const pre = block.querySelector('.diagram-source, pre');
  if (!pre) {
    console.warn('[diagram-editor] No .diagram-source <pre> found.');
    return;
  }

  const source = pre.textContent.trim();
  if (!source) {
    console.warn('[diagram-editor] Empty diagram source.');
    return;
  }

  // Prepare container
  const container = document.createElement('div');
  container.className = 'diagram-render';
  pre.replaceWith(container);

  try {
    const mermaid = await loadMermaid();

    const diagramId = `diagram-${Math.random().toString(36).slice(2)}`;
    const { svg } = await mermaid.render(diagramId, source);

    container.innerHTML = svg;

    // Dispatch a custom event for instrumentation
    block.dispatchEvent(new CustomEvent('diagram:render', {
      bubbles: true,
      detail: { engine: 'mermaid', id: diagramId }
    }));
  } catch (e) {
    console.error('[diagram-editor] Failed to render mermaid diagram', e);
    container.innerHTML = '<p class="diagram-error">Error rendering diagram.</p>';

    block.dispatchEvent(new CustomEvent('diagram:error', {
      bubbles: true,
      detail: { error: e }
    }));
  }

  // TODO: v1.1 – add export buttons (PNG/JPEG/SVG) here, wiring to html2canvas or similar.
}
