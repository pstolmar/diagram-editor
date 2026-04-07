import { moveInstrumentation } from '../../scripts/scripts.js';

const PALETTES = {
  blue: ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7'],
  purple: ['#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed'],
  green: ['#86efac', '#4ade80', '#22c55e', '#16a34a'],
  gold: ['#fde68a', '#facc15', '#f59e0b', '#f97316'],
  rainbow: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'],
};

function getText(row) {
  if (!row) return '';
  return (row.querySelector('div') || row).textContent.trim();
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return {
    r: Math.floor(n / 65536) % 256,
    g: Math.floor(n / 256) % 256,
    b: n % 256,
  };
}

function mkParticle(mode, w, h, palette) {
  const color = palette[Math.floor(Math.random() * palette.length)];
  const rgb = hexToRgb(color);

  let r;
  if (mode === 'dots') r = 5 + Math.random() * 9;
  else if (mode === 'stars') r = 0.8 + Math.random() * 2.2;
  else r = 1 + Math.random() * 2;

  return {
    x: Math.random() * w,
    y: mode === 'fire' ? h + Math.random() * h * 0.5 : Math.random() * h,
    vx: (Math.random() - 0.5) * (mode === 'fire' ? 0.3 : 0.6),
    vy: mode === 'fire' ? -0.6 - Math.random() * 0.9 : (Math.random() - 0.5) * 0.6,
    r,
    opacity: 0.4 + Math.random() * 0.6,
    color,
    rgb,
    hue: Math.random() * 360,
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.015 + Math.random() * 0.03,
    heat: Math.random(),
  };
}

export default async function decorate(block) {
  const rows = [...block.children];
  const headline = getText(rows[0]) || 'Particle Field';
  const subhead = getText(rows[1]) || '';
  const modeRaw = getText(rows[2]).toLowerCase();
  const colorRaw = getText(rows[3]).toLowerCase();
  const countRaw = getText(rows[4]);

  const mode = ['web', 'stars', 'fire', 'dots'].includes(modeRaw) ? modeRaw : 'web';
  const paletteName = PALETTES[colorRaw] ? colorRaw : 'blue';
  const palette = PALETTES[paletteName];
  const count = Math.min(Math.max(parseInt(countRaw, 10) || 120, 80), 400);

  const wrap = document.createElement('div');
  wrap.className = 'pf-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'pf-canvas';

  const textEl = document.createElement('div');
  textEl.className = 'pf-text';

  const h2 = document.createElement('h2');
  moveInstrumentation(rows[0], h2);
  h2.textContent = headline;

  const p = document.createElement('p');
  moveInstrumentation(rows[1], p);
  p.textContent = subhead;

  textEl.append(h2, p);
  wrap.append(canvas, textEl);
  block.replaceChildren(wrap);

  const ctx = canvas.getContext('2d');
  const state = {
    w: 0, h: 520, particles: [], raf: 0, active: true, mx: 0, my: 0, hover: false,
  };

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nw = Math.max(rect.width, 1);
    const nh = Math.max(rect.height || 520, 520);
    if (state.w) {
      state.particles.forEach((pt) => {
        pt.x = (pt.x / state.w) * nw;
        pt.y = (pt.y / state.h) * nh;
      });
    }
    state.w = nw;
    state.h = nh;
    canvas.style.width = `${nw}px`;
    canvas.style.height = `${nh}px`;
    canvas.width = Math.floor(nw * dpr);
    canvas.height = Math.floor(nh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function attract(pt) {
    if (!state.hover) return;
    const dx = state.mx - pt.x;
    const dy = state.my - pt.y;
    const d = Math.hypot(dx, dy);
    if (d === 0 || d > 200) return;
    const f = (1 - d / 200) * 0.05;
    pt.vx += (dx / d) * f;
    pt.vy += (dy / d) * f;
  }

  function fillColor(pt) {
    if (paletteName === 'rainbow') {
      return `hsla(${pt.hue},90%,68%,${pt.opacity})`;
    }
    return `rgba(${pt.rgb.r},${pt.rgb.g},${pt.rgb.b},${pt.opacity})`;
  }

  function tick() {
    const { w, h } = state;
    ctx.clearRect(0, 0, w, h);

    if (mode === 'web') {
      ctx.lineWidth = 1;
      for (let i = 0; i < state.particles.length; i += 1) {
        const a = state.particles[i];
        for (let j = i + 1; j < state.particles.length; j += 1) {
          const b = state.particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 120) {
            ctx.globalAlpha = (1 - d / 120) * 0.35;
            ctx.strokeStyle = a.color;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    state.particles.forEach((pt) => {
      attract(pt);
      pt.x += pt.vx;
      pt.y += pt.vy;

      if (mode === 'fire') {
        pt.heat = Math.min(pt.heat + 0.01, 1);
        if (pt.y + pt.r < 0) Object.assign(pt, mkParticle('fire', w, h, palette));
        const g = Math.round(80 + 175 * pt.heat);
        const bv = Math.round(30 * pt.heat);
        ctx.fillStyle = `rgba(255,${g},${bv},${pt.opacity})`;
      } else {
        if (pt.x < -pt.r) pt.x = w + pt.r;
        else if (pt.x > w + pt.r) pt.x = -pt.r;
        if (pt.y < -pt.r) pt.y = h + pt.r;
        else if (pt.y > h + pt.r) pt.y = -pt.r;

        if (mode === 'stars') {
          pt.twinkle += pt.twinkleSpeed;
          const tw = 0.55 + 0.45 * Math.sin(pt.twinkle);
          if (paletteName === 'rainbow') {
            ctx.fillStyle = `hsla(${pt.hue},90%,68%,${pt.opacity * tw})`;
          } else {
            ctx.fillStyle = `rgba(${pt.rgb.r},${pt.rgb.g},${pt.rgb.b},${pt.opacity * tw})`;
          }
        } else {
          if (paletteName === 'rainbow') pt.hue = (pt.hue + 0.2) % 360;
          ctx.fillStyle = fillColor(pt);
        }
      }

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function loop() {
    if (!state.active) return;
    tick();
    state.raf = requestAnimationFrame(loop);
  }

  function start() {
    if (state.raf) return;
    state.active = true;
    state.raf = requestAnimationFrame(loop);
  }

  function stop() {
    state.active = false;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  resize();
  state.particles = Array.from(
    { length: count },
    () => mkParticle(mode, state.w, state.h, palette),
  );
  start();

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mx = e.clientX - rect.left;
    state.my = e.clientY - rect.top;
    state.hover = true;
  });
  canvas.addEventListener('pointerleave', () => { state.hover = false; });

  new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
    { threshold: 0.2 },
  ).observe(block);

  new ResizeObserver(resize).observe(wrap);
}
