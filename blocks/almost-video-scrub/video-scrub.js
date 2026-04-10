/**
 * Video Scrub Block
 * Renders a video player with playback speed controls and timeline scrubbing
 */

async function decorate(block) {
  let config = {};

  // Fetch demo JSON from import.meta.url
  try {
    const demoJsonPath = new URL('video-scrub-demo.json', import.meta.url).href;
    const response = await fetch(demoJsonPath);
    if (response.ok) {
      config = await response.json();
    }
  } catch (error) {
    console.warn('Could not load video-scrub-demo.json:', error);
  }

  const { videoUrl, title } = config;

  // Clear block
  block.innerHTML = '';

  // Show empty state if no videoUrl
  if (!videoUrl) {
    const emptyState = document.createElement('div');
    emptyState.className = 'viz-empty-state';
    emptyState.textContent = 'No video URL provided';
    block.appendChild(emptyState);
    return;
  }

  // Create main container
  const container = document.createElement('div');
  container.className = 'video-scrub-container';

  // Display video title if provided
  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.className = 'video-scrub-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);
  }

  // Render video element with controls
  const video = document.createElement('video');
  video.className = 'video-scrub-video';
  video.src = videoUrl;
  video.controls = true;
  container.appendChild(video);

  // Create controls section
  const controls = document.createElement('div');
  controls.className = 'video-scrub-controls';

  // Playback speed buttons (0.5x, 1x, 1.5x, 2x)
  const speedSection = document.createElement('div');
  speedSection.className = 'video-scrub-speeds';

  const speeds = [0.5, 1, 1.5, 2];
  speeds.forEach((speed) => {
    const btn = document.createElement('button');
    btn.className = 'video-scrub-speed-btn';
    btn.textContent = `${speed}x`;
    btn.dataset.speed = speed;

    if (speed === 1) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      video.playbackRate = speed;
      speedSection.querySelectorAll('.video-scrub-speed-btn').forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });

    speedSection.appendChild(btn);
  });

  controls.appendChild(speedSection);

  // Timeline scrubbing progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'video-scrub-progress';

  const progressFill = document.createElement('div');
  progressFill.className = 'video-scrub-progress-fill';
  progressBar.appendChild(progressFill);

  // Scrubbing via mouse events
  progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    if (video.duration) {
      video.currentTime = percent * video.duration;
    }
  });

  progressBar.addEventListener('mousemove', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    progressFill.style.width = `${percent * 100}%`;
  });

  progressBar.addEventListener('mouseleave', () => {
    progressFill.style.width = '0';
  });

  // Update progress during playback
  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      const percent = (video.currentTime / video.duration) * 100;
      progressFill.style.width = `${percent}%`;
    }
  });

  controls.appendChild(progressBar);
  container.appendChild(controls);

  block.appendChild(container);
}

export default decorate;
