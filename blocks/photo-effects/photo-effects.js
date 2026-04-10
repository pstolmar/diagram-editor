export default async function decorate(block) {
  let config;

  try {
    const url = new URL(import.meta.url);
    const configPath = url.pathname.replace(/photo-effects\.js$/, 'photo-effects.json');
    const response = await fetch(configPath);
    if (response.ok) {
      config = await response.json();
    }
  } catch (e) {
    // Fallback if JSON load fails
    config = { imageUrl: null };
  }

  const imageUrl = config?.imageUrl;

  if (!imageUrl) {
    block.innerHTML = '<div class="viz-empty-state">No image</div>';
    return;
  }

  const effects = ['bokeh', 'blur', 'negative', 'grain', 'monochrome', 'vibrant'];
  const selectedEffects = new Set();

  block.innerHTML = `
    <div class="photo-effects-container">
      <div class="photo-effects-image-wrapper">
        <img class="photo-effects-image" src="${imageUrl}" alt="Photo for editing" />
      </div>
      <div class="photo-effects-controls">
        <div class="photo-effects-effects">
          ${effects.map((effect) => `
            <label class="photo-effects-checkbox">
              <input type="checkbox" data-effect="${effect}" />
              <span>${effect.charAt(0).toUpperCase() + effect.slice(1)}</span>
            </label>
          `).join('')}
        </div>
        ${sessionStorage.getItem('aem_auth') ? '<button class="aem-upload-btn">Upload to AEM</button>' : ''}
      </div>
    </div>
  `;

  const image = block.querySelector('.photo-effects-image');
  const checkboxes = block.querySelectorAll('input[type="checkbox"]');
  const uploadBtn = block.querySelector('.aem-upload-btn');

  const applyEffects = () => {
    let filterString = '';

    if (selectedEffects.has('blur')) filterString += 'blur(8px) ';
    if (selectedEffects.has('grain')) filterString += 'brightness(1.1) contrast(1.2) ';
    if (selectedEffects.has('negative')) filterString += 'invert(1) ';
    if (selectedEffects.has('monochrome')) filterString += 'grayscale(1) ';
    if (selectedEffects.has('vibrant')) filterString += 'saturate(2) contrast(1.3) ';

    image.style.filter = filterString.trim() || 'none';

    if (selectedEffects.has('bokeh')) {
      image.style.borderRadius = '50%';
      image.style.boxShadow = 'inset 0 0 30px rgba(0,0,0,0.3)';
    } else {
      image.style.borderRadius = '';
      image.style.boxShadow = '';
    }
  };

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const { effect } = e.target.dataset;
      if (e.target.checked) {
        selectedEffects.add(effect);
      } else {
        selectedEffects.delete(effect);
      }
      applyEffects();
    });
  });

  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      ctx.drawImage(image, 0, 0);

      canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'photo-effects-edited.png');

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('aem_auth')}`,
            },
          });

          if (response.ok) {
            uploadBtn.textContent = 'Uploaded!';
            uploadBtn.disabled = true;
            setTimeout(() => {
              uploadBtn.textContent = 'Upload to AEM';
              uploadBtn.disabled = false;
            }, 2000);
          }
        } catch (error) {
          console.error('Upload failed:', error);
        }
      }, 'image/png');
    });
  }
}
