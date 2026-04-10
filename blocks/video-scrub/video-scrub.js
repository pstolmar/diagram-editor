async function loadVideoData() {
  // Try to load from video-data.json in block directory
  try {
    const jsonUrl = new URL('./video-data.json', import.meta.url).href;
    const response = await fetch(jsonUrl);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // Fall through to default
  }

  // Default BigBuckBunny demo
  return {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny',
  };
}

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default async function decorate(block) {
  const data = await loadVideoData();

  // Handle empty state
  if (!data || !data.src) {
    block.innerHTML = '<div class="viz-empty-state">No video</div>';
    return;
  }

  // Clear block
  block.innerHTML = '';
  block.classList.add('video-scrub-block');

  // Create video element
  const video = document.createElement('video');
  video.src = data.src;
  video.className = 'video-scrub-video';
  block.appendChild(video);

  // Create controls
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'video-scrub-controls';

  // Speed buttons
  const speedDiv = document.createElement('div');
  speedDiv.className = 'video-scrub-speeds';
  [0.5, 1, 2].forEach((speed) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `speed-button ${speed === 1 ? 'active' : ''}`;
    btn.textContent = `${speed}x`;
    btn.addEventListener('click', () => {
      video.playbackRate = speed;
      speedDiv.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    speedDiv.appendChild(btn);
  });
  controlsDiv.appendChild(speedDiv);

  // Time display
  const timeDiv = document.createElement('div');
  timeDiv.className = 'video-scrub-time';
  timeDiv.textContent = '0:00 / 0:00';
  controlsDiv.appendChild(timeDiv);

  // Scrub bar
  const scrubBar = document.createElement('input');
  scrubBar.type = 'range';
  scrubBar.min = '0';
  scrubBar.max = '100';
  scrubBar.value = '0';
  scrubBar.className = 'video-scrub-bar';

  // Update display during playback
  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      const percent = (video.currentTime / video.duration) * 100;
      scrubBar.value = percent;
      timeDiv.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    }
  });

  // Handle scrubbing
  scrubBar.addEventListener('input', (e) => {
    if (video.duration) {
      video.currentTime = (e.target.value / 100) * video.duration;
    }
  });

  // Initialize metadata
  video.addEventListener('loadedmetadata', () => {
    timeDiv.textContent = `0:00 / ${formatTime(video.duration)}`;
  });

  controlsDiv.appendChild(scrubBar);
  block.appendChild(controlsDiv);
}
