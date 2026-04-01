// blocks/shared/fx-canvas.js

let particles = [];
let animId = null;
let canvas = null;
let ctx = null;

function getCanvas() {
  if (canvas) return canvas;
  canvas = document.getElementById('mermaid-fx-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'mermaid-fx-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
  }
  ctx = canvas.getContext('2d');
  return canvas;
}

function resizeCanvas() {
  const c = getCanvas();
  c.width = window.innerWidth;
  c.height = window.innerHeight;
}

export function fireSparkler(originEl, opts = {}) {
  resizeCanvas();
  const rect = originEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#fff7a1','#ffe066','#ffb830','#ff8c42','#ffffff','#ffd600','#ffec8b','#fffde7'];
  // 90 radial sparks
  for (let i = 0; i < 90; i++) {
    const angle = (Math.PI * 2 * i) / 90 + (Math.random() - 0.5) * 0.3;
    const speed = 1.5 + Math.random() * 5;
    particles.push({ type: 'sparkle', x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5,
      r: 1.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1, decay: 0.022 + Math.random() * 0.018, gravity: 0.08 });
  }
  // 30 bright star core
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    particles.push({ type: 'star', x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
      r: 1 + Math.random() * 1.5, color: '#ffffff',
      life: 1, decay: 0.03 + Math.random() * 0.02, gravity: 0.1 });
  }
  runLoop();
}

export function fireConfetti(opts = {}) {
  resizeCanvas();
  const c = getCanvas();
  const colors = ['#4f6ef7','#a855f7','#6ee7b7','#fcd34d','#f472b6','#fb923c','#34d399','#f87171','#38bdf8','#a3e635'];
  for (let i = 0; i < 160; i++) {
    particles.push({
      type: Math.random() > 0.5 ? 'rect' : 'circle',
      x: Math.random() * c.width,
      y: -20 - Math.random() * c.height * 0.3,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 2.5 + Math.random() * 3.5,
      r: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1, decay: 0.004 + Math.random() * 0.003, gravity: 0.04,
      tilt: Math.random() * Math.PI, tiltSpeed: (Math.random() - 0.5) * 0.12,
      wobble: Math.random() * Math.PI * 2, wobbleSpeed: 0.04 + Math.random() * 0.04,
    });
  }
  runLoop();
}

export function fireBalloons(opts = {}) {
  const count = 14;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'mermaid-balloon';
    el.textContent = '🎈';
    const startX = 5 + Math.random() * 90;
    const duration = 3 + Math.random() * 2;
    const delay = Math.random() * 1.5;
    el.style.cssText = `position:fixed;bottom:-60px;left:${startX}%;font-size:${1.5 + Math.random()}rem;`
      + `animation:mermaidBalloonFloat ${duration}s ease-out ${delay}s forwards;`
      + `pointer-events:none;z-index:9999;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), (duration + delay + 0.5) * 1000);
  }
  // Inject keyframes once
  if (!document.getElementById('mermaid-balloon-style')) {
    const style = document.createElement('style');
    style.id = 'mermaid-balloon-style';
    style.textContent = `@keyframes mermaidBalloonFloat {
      0%   { transform: translateY(0) rotate(-5deg); opacity: 1; }
      50%  { transform: translateY(-50vh) rotate(5deg); opacity: 1; }
      100% { transform: translateY(-110vh) rotate(-3deg); opacity: 0; }
    }`;
    document.head.appendChild(style);
  }
}

export function clearFx() {
  particles = [];
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.querySelectorAll('.mermaid-balloon').forEach(el => el.remove());
}

// Test-only export — not part of public API
export function _getParticles() { return particles; }

function runLoop() {
  if (animId) cancelAnimationFrame(animId);
  function tick() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0.01);
    if (!particles.length) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    for (const p of particles) {
      p.life -= p.decay;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.type === 'sparkle' || p.type === 'star') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === 'star' ? 8 : 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.r * p.life), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.r * 0.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      } else if (p.type === 'rect') {
        p.tilt += p.tiltSpeed;
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 0.8;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        ctx.restore();
      } else {
        p.wobble = (p.wobble || 0) + 0.05;
        p.x += Math.sin(p.wobble) * 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    animId = requestAnimationFrame(tick);
  }
  animId = requestAnimationFrame(tick);
}

if (typeof window !== 'undefined') window.addEventListener('resize', resizeCanvas);
