import { moveInstrumentation } from '../../scripts/scripts.js';

const PALETTES = {
  blue: ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7'],
  purple: ['#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed'],
  green: ['#86efac', '#4ade80', '#22c55e', '#16a34a'],
  gold: ['#fde68a', '#facc15', '#f59e0b', '#f97316'],
  rainbow: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'],
};

function getRowText(row) {
  if (!row) return '';
  const cell = row.querySelector('div') || row;
  return cell.textContent.trim();
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return { r: 255, g: 255, b: 255 };
  const num = parseInt(normalized, 16);
  return {
    r: Math.floor(num / 65536) % 256,
    g: Math.floor(num / 256) % 256,
    b: num % 256,
  };
}

function buildParticle(mode, width, height, paletteName) {
  const palette = PALETTES[paletteName] || PALETTES.blue;
  const color = palette[Math.floor(Math.random() * palette.length)];
  const base = {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    r: 1 + Math.random() * 2,
    opacity: 0.4 + Math.random() * 0.6,
    color,
    rgb: hexToRgb(color),
    hue: Math.random() * 360,
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.015 + Math.random() * 0.03,
    heat: Math.random(),
  };

  if (mode === 'fire') {
    return {
      ...base,
      x: Math.random() * width,
      y: height + Math.random() * height * 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.6 - Math.random() * 0.9,
      r: 1 + Math.random() * 2.5,
      opacity: 0.4 + Math.random() * 0.6,
      heat: Math.random(),
    };
  }

  if (mode === 'stars') {
    return {
      ...base,
      r: 0.8 + Math.random() * 2.2,
      opacity: 0.5 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
    };
  }

  if (mode === 'dots') {
    return {
      ...base,
      r: 1 + Math.random() * 2.2,
    };
  }

  return base;
}

export default function decorate(block) {
  const rows = [...block.children];
  const headlineRow = rows[0];
  const subheadRow = rows[1];
  const modeRow = rows[2];
  const colorRow = rows[3];
  const countRow = rows[4];

  const headline = getRowText(headlineRow) || 'Particle Field';
  const subhead = getRowText(subheadRow) || 'A living canvas of motion.';
  const modeRaw = getRowText(modeRow).toLowerCase();
  const colorRaw = getRowText(colorRow).toLowerCase();
  const countRaw = getRowText(countRow).toLowerCase();

  const mode = ['web', 'stars', 'fire', 'dots'].includes(modeRaw) ? modeRaw : 'web';
  const paletteName = PALETTES[colorRaw] ? colorRaw : 'blue';
  const count = clamp(parseInt(countRaw, 10) || 90, 24, 220);

  const wrap = document.createElement('div');
  wrap.className = 'pf-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'pf-canvas';

  const text = document.createElement('div');
  text.className = 'pf-text';

  const h2 = document.createElement('h2');
  moveInstrumentation(headlineRow, h2);
  h2.textContent = headline;

  const p = document.createElement('p');
  moveInstrumentation(subheadRow, p);
  p.textContent = subhead;

  text.append(h2, p);
  wrap.append(canvas, text);
  block.replaceChildren(wrap);

  const ctx = canvas.getContext('2d');
  const state = {
    width: 0,
    height: 520,
    particles: [],
    rafId: 0,
    visible: true,
    mouse: { x: 0, y: 0, active: false },
  };

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const nextWidth = Math.max(rect.width, 1);
    const nextHeight = Math.max(rect.height || 520, 520);
    const dpr = window.devicePixelRatio || 1;
    const prevWidth = state.width || nextWidth;
    const prevHeight = state.height || nextHeight;

    state.width = nextWidth;
    state.height = nextHeight;

    canvas.style.width = `${nextWidth}px`;
    canvas.style.height = `${nextHeight}px`;
    canvas.width = Math.floor(nextWidth * dpr);
    canvas.height = Math.floor(nextHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state.particles.length) {
      state.particles.forEach((particle) => {
        particle.x = (particle.x / prevWidth) * nextWidth;
        particle.y = (particle.y / prevHeight) * nextHeight;
      });
    }
  }

  function initParticles() {
    state.particles = new Array(count)
      .fill(0)
      .map(() => buildParticle(mode, state.width, state.height, paletteName));
  }

  function applyMouseAttraction(particle) {
    if (!state.mouse.active) return;
    const dx = state.mouse.x - particle.x;
    const dy = state.mouse.y - particle.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0 || dist > 200) return;
    const force = (1 - dist / 200) * 0.05;
    particle.vx += (dx / dist) * force;
    particle.vy += (dy / dist) * force;
  }

  function updateParticles() {
    const { width, height } = state;
    state.particles.forEach((particle) => {
      applyMouseAttraction(particle);
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (mode === 'fire') {
        particle.heat = clamp(particle.heat + 0.01, 0, 1);
        if (particle.y + particle.r < 0) {
          Object.assign(particle, buildParticle('fire', width, height, paletteName));
        }
      } else {
        if (particle.x < -particle.r) particle.x = width + particle.r;
        if (particle.x > width + particle.r) particle.x = -particle.r;
        if (particle.y < -particle.r) particle.y = height + particle.r;
        if (particle.y > height + particle.r) particle.y = -particle.r;
      }

      if (mode === 'stars') {
        particle.twinkle += particle.twinkleSpeed;
      }
    });
  }

  function drawWeb() {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    for (let i = 0; i < state.particles.length; i += 1) {
      const a = state.particles[i];
      for (let j = i + 1; j < state.particles.length; j += 1) {
        const b = state.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          const alpha = (1 - dist / 120) * 0.35;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = a.color;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    state.particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawStars() {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);
    state.particles.forEach((particle) => {
      const twinkle = 0.55 + 0.45 * Math.sin(particle.twinkle);
      const alpha = particle.opacity * twinkle;
      const color = paletteName === 'rainbow'
        ? `hsla(${particle.hue}, 90%, 70%, ${alpha})`
        : `rgba(${particle.rgb.r}, ${particle.rgb.g}, ${particle.rgb.b}, ${alpha})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawDots() {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);
    state.particles.forEach((particle) => {
      const alpha = particle.opacity;
      const color = paletteName === 'rainbow'
        ? `hsla(${particle.hue}, 85%, 65%, ${alpha})`
        : `rgba(${particle.rgb.r}, ${particle.rgb.g}, ${particle.rgb.b}, ${alpha})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawFire() {
    const { width, height } = state;
    ctx.clearRect(0, 0, width, height);
    state.particles.forEach((particle) => {
      const heat = clamp(particle.heat, 0, 1);
      const g = Math.round(80 + 175 * heat);
      const b = Math.round(30 * heat);
      ctx.fillStyle = `rgba(255, ${g}, ${b}, ${particle.opacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function render() {
    updateParticles();
    if (mode === 'web') drawWeb();
    else if (mode === 'stars') drawStars();
    else if (mode === 'fire') drawFire();
    else drawDots();
  }

  function loop() {
    if (!state.visible) return;
    render();
    state.rafId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (state.rafId) return;
    state.visible = true;
    state.rafId = window.requestAnimationFrame(loop);
  }

  function stop() {
    state.visible = false;
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  resize();
  initParticles();
  start();

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = event.clientX - rect.left;
    state.mouse.y = event.clientY - rect.top;
    state.mouse.active = true;
  });

  canvas.addEventListener('pointerleave', () => {
    state.mouse.active = false;
  });

  const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) start();
      else stop();
    });
  }, { threshold: 0.2 });
  intersectionObserver.observe(block);

  const resizeObserver = new ResizeObserver(() => {
    resize();
  });
  resizeObserver.observe(wrap);
}
