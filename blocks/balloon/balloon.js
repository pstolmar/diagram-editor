const ADOBE_RED = '#EB1000';
const W = 100;
const H = 240;
const BCX = 50;
const BCY = 65;
const BRX = 42;
const BRY = 52;
const KNOT_Y = BCY + BRY + 5; // 122
const ANCHOR_Y = H - 5; // 235
const SVG_NS = 'http://www.w3.org/2000/svg';

class Spring {
  constructor(k = 0.04, d = 0.15) {
    this.pos = 0;
    this.vel = 0;
    this.k = k;
    this.d = d;
    this.target = 0;
  }

  tick() {
    const acc = -this.k * (this.pos - this.target) - this.d * this.vel;
    this.vel += acc;
    this.pos += this.vel;
  }

  push(v) {
    this.vel += v;
  }
}

function hexDarken(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

function buildSvg(color) {
  const knotColor = hexDarken(color, 0.72);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.style.cssText = 'overflow:visible;cursor:grab;display:block';

  const strPath = document.createElementNS(SVG_NS, 'path');
  strPath.classList.add('b-string');
  strPath.setAttribute('d', `M${BCX},${KNOT_Y} Q${BCX},${(KNOT_Y + ANCHOR_Y) / 2} ${BCX},${ANCHOR_Y}`);
  strPath.setAttribute('stroke', '#666');
  strPath.setAttribute('stroke-width', '1.5');
  strPath.setAttribute('fill', 'none');
  strPath.setAttribute('stroke-linecap', 'round');

  const bodyG = document.createElementNS(SVG_NS, 'g');
  bodyG.classList.add('b-body');

  const ellipse = document.createElementNS(SVG_NS, 'ellipse');
  ellipse.setAttribute('cx', String(BCX));
  ellipse.setAttribute('cy', String(BCY));
  ellipse.setAttribute('rx', String(BRX));
  ellipse.setAttribute('ry', String(BRY));
  ellipse.setAttribute('fill', color);

  const glare = document.createElementNS(SVG_NS, 'ellipse');
  glare.setAttribute('cx', String(BCX - 13));
  glare.setAttribute('cy', String(BCY - 17));
  glare.setAttribute('rx', '13');
  glare.setAttribute('ry', '8');
  glare.setAttribute('fill', 'rgba(255,255,255,0.38)');
  glare.setAttribute('transform', `rotate(-22 ${BCX - 13} ${BCY - 17})`);

  const knot = document.createElementNS(SVG_NS, 'path');
  knot.setAttribute(
    'd',
    `M${BCX - 4},${BCY + BRY - 3} C${BCX - 4},${BCY + BRY + 8} ${BCX + 4},${BCY + BRY + 8} ${BCX + 4},${BCY + BRY - 3} L${BCX},${KNOT_Y} Z`,
  );
  knot.setAttribute('fill', knotColor);

  bodyG.append(ellipse, glare, knot);
  svg.append(strPath, bodyG);
  return { svg, strPath, bodyG };
}

function getContainerStyles(position, sticky) {
  const m = '20px';
  const base = {
    position: sticky ? 'fixed' : 'absolute',
    zIndex: '9999',
    width: `${W}px`,
    height: `${H}px`,
    pointerEvents: 'none',
  };
  if (position === 'bottom-left') return { ...base, bottom: m, left: m };
  if (position === 'top-right') return { ...base, top: 'max(180px, 15vh)', right: m };
  if (position === 'top-left') return { ...base, top: 'max(180px, 15vh)', left: m };
  return { ...base, bottom: m, right: m }; // bottom-right default
}

function attachBalloon(container, color, floatUp) {
  const { svg, strPath, bodyG } = buildSvg(color);
  svg.style.pointerEvents = 'all';

  if (floatUp) {
    svg.style.transform = 'translateY(110vh)';
    svg.style.transition = 'transform 0.85s cubic-bezier(0.34, 1.56, 0.64, 1)';
    // Double rAF ensures the initial transform is painted before we remove it
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        svg.style.transform = '';
      });
    });
    setTimeout(() => {
      svg.style.transition = '';
    }, 900);
  }
  container.appendChild(svg);

  const sx = new Spring(0.04, 0.15);
  const sy = new Spring(0.03, 0.14);
  let idleT = Math.random() * Math.PI * 2;
  let dragging = false;
  let dx0 = 0;
  let dy0 = 0;
  let destroyed = false;
  let raf = 0;
  const cleanups = [];

  function listen(el, type, fn, opts) {
    el.addEventListener(type, fn, opts);
    cleanups.push(() => el.removeEventListener(type, fn, opts));
  }

  function redraw() {
    const ox = sx.pos;
    const oy = sy.pos;
    bodyG.setAttribute('transform', `translate(${ox},${oy})`);
    const kx = BCX + ox;
    const ky = KNOT_Y + oy;
    const cpx = (kx + BCX) / 2 + (ky - ANCHOR_Y) * 0.12;
    const cpy = (ky + ANCHOR_Y) / 2;
    strPath.setAttribute('d', `M${kx},${ky} Q${cpx},${cpy} ${BCX},${ANCHOR_Y}`);
  }

  function loop() {
    if (destroyed) return;
    idleT += 0.007;
    if (!dragging) {
      sx.target = Math.sin(idleT) * 5;
      sy.target = Math.sin(idleT * 0.67 + 1.2) * 2.5;
    }
    sx.tick();
    sy.tick();
    redraw();
    raf = requestAnimationFrame(loop);
  }
  loop();

  let lastScrollY = window.scrollY;
  function onScroll() {
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    sy.push(delta * 0.05);
  }
  listen(window, 'scroll', onScroll, { passive: true });

  function startDrag(cx, cy) {
    dragging = true;
    dx0 = cx - sx.pos;
    dy0 = cy - sy.pos;
    svg.style.cursor = 'grabbing';
  }
  function moveDrag(cx, cy) {
    if (!dragging) return;
    sx.pos = Math.max(-65, Math.min(65, cx - dx0));
    sy.pos = Math.max(-70, Math.min(80, cy - dy0));
    sx.vel = 0;
    sy.vel = 0;
    sx.target = 0;
    sy.target = 0;
    redraw();
  }
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    svg.style.cursor = 'grab';
  }

  listen(svg, 'mousedown', (e) => { startDrag(e.clientX, e.clientY); e.preventDefault(); });
  listen(window, 'mousemove', (e) => moveDrag(e.clientX, e.clientY));
  listen(window, 'mouseup', endDrag);
  listen(svg, 'touchstart', (e) => { startDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  listen(window, 'touchmove', (e) => {
    if (dragging) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  }, { passive: false });
  listen(window, 'touchend', endDrag);

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
  }

  function pop() {
    destroy();

    const transformStr = bodyG.getAttribute('transform') || '';
    const nums = transformStr.match(/-?\d+\.?\d*/g) || [];
    const ox = parseFloat(nums[0]) || 0;
    const oy = parseFloat(nums[1]) || 0;

    // Scale burst
    bodyG.style.transformOrigin = `${BCX + ox}px ${BCY + oy}px`;
    bodyG.style.transition = 'transform 0.08s ease-out, opacity 0.12s 0.06s ease-out';
    bodyG.style.transform = 'scale(1.3)';

    // Particle scatter
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 35 + Math.random() * 35;
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(BCX + ox));
      c.setAttribute('cy', String(BCY + oy));
      c.setAttribute('r', String(3 + Math.random() * 4));
      c.setAttribute('fill', color);
      c.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
      svg.appendChild(c);
      requestAnimationFrame(() => {
        c.style.transform = `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px)`;
        c.style.opacity = '0';
      });
      setTimeout(() => c.remove(), 600);
    }

    // Fade body + droop string
    setTimeout(() => {
      bodyG.style.opacity = '0';
      strPath.setAttribute(
        'd',
        `M${BCX + ox},${KNOT_Y + oy} Q${BCX + ox + 18},${KNOT_Y + oy + 45} ${BCX},${ANCHOR_Y}`,
      );
    }, 70);

    // Respawn
    setTimeout(() => {
      svg.remove();
      attachBalloon(container, color, true);
    }, 650);
  }

  listen(svg, 'dblclick', pop);
}

export default async function decorate(block) {
  const params = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    const cells = row.querySelectorAll(':scope > div');
    if (cells.length >= 2) {
      params[cells[0].textContent.trim()] = cells[1].textContent.trim();
    }
  });

  const color = params.color || ADOBE_RED;
  const position = params.position || 'bottom-right';
  const sticky = params.sticky !== 'false';

  block.innerHTML = '';
  block.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'balloon-widget';
  Object.assign(container.style, getContainerStyles(position, sticky));

  if (sticky) {
    document.body.appendChild(container);
  } else {
    const anchor = block.closest('.section') || block.parentElement;
    anchor.style.position = 'relative';
    anchor.appendChild(container);
  }

  attachBalloon(container, color, false);
}
