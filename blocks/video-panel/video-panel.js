/* eslint-disable no-console */
export default async function decorate(block) {
  const DEMO = new URL('video-panel-demo.json', import.meta.url);
  let cfg = {};
  try {
    const resp = await fetch(DEMO);
    cfg = await resp.json();
  } catch { /* ignore */ }

  // Also try reading first child text as video URL override
  const urlOverride = block.firstElementChild?.firstElementChild?.textContent?.trim();
  if (urlOverride && urlOverride.startsWith('http')) cfg.videoUrl = urlOverride;

  if (!cfg.videoUrl) {
    block.innerHTML = '<div class="viz-empty-state">Add a video URL to the first row</div>';
    return;
  }

  block.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'video-panel';
  container.style.height = cfg.height || '600px';

  if (!cfg.videoUrl) {
    const emptyState = document.createElement('div');
    emptyState.className = 'viz-empty-state';
    emptyState.textContent = '▶';
    container.appendChild(emptyState);
    block.appendChild(container);
    return;
  }

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsinline = true;

  if (cfg.posterUrl) {
    video.poster = cfg.posterUrl;
  }

  const source = document.createElement('source');
  source.src = cfg.videoUrl;
  source.type = 'video/mp4';
  video.appendChild(source);
  container.appendChild(video);

  const overlay = document.createElement('div');
  overlay.className = 'video-overlay';

  if (cfg.overlayHeading || cfg.overlayBody || cfg.ctaLabel) {
    const overlayContent = document.createElement('div');
    overlayContent.className = 'video-overlay-content';

    if (cfg.overlayHeading) {
      const heading = document.createElement('h2');
      heading.textContent = cfg.overlayHeading;
      overlayContent.appendChild(heading);
    }

    if (cfg.overlayBody) {
      const body = document.createElement('p');
      body.textContent = cfg.overlayBody;
      overlayContent.appendChild(body);
    }

    if (cfg.ctaLabel && cfg.ctaUrl) {
      const cta = document.createElement('a');
      cta.href = cfg.ctaUrl;
      cta.className = 'button';
      cta.textContent = cfg.ctaLabel;
      overlayContent.appendChild(cta);
    }

    overlay.appendChild(overlayContent);
  }

  container.appendChild(overlay);

  const unmuteBtn = document.createElement('button');
  unmuteBtn.className = 'video-unmute-btn';
  unmuteBtn.setAttribute('aria-label', 'Toggle video sound');
  unmuteBtn.textContent = '🔇';

  unmuteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
    unmuteBtn.textContent = video.muted ? '🔇' : '🔊';
  });

  container.appendChild(unmuteBtn);

  const playBtn = document.createElement('button');
  playBtn.className = 'video-play-btn';
  playBtn.setAttribute('aria-label', 'Play video');
  playBtn.innerHTML = '▶';

  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    video.play().catch((err) => console.warn('Play failed:', err));
    playBtn.style.display = 'none';
  });

  video.addEventListener('play', () => {
    playBtn.style.display = 'none';
  });

  video.addEventListener('pause', () => {
    if (video.currentTime === 0) {
      playBtn.style.display = 'flex';
    }
  });

  container.appendChild(playBtn);

  if (cfg.mode === 'contain') {
    video.style.objectFit = 'contain';
  } else {
    video.style.objectFit = 'cover';
  }

  block.appendChild(container);
}
