/**
 * Photo Effects Block
 * Displays an image with selectable visual effects
 * (bokeh, blur, negative, grain, monochrome, vibrant)
 * Supports uploading effect configurations to AEM DAM when the user is authenticated
 */

const EFFECTS = ['bokeh', 'blur', 'negative', 'grain', 'monochrome', 'vibrant'];

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `photo-effects-toast${isError ? ' photo-effects-toast-error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
async function isUserAuthenticated() {
  try {
    const response = await fetch('/api/auth/user', {
      credentials: 'include',
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load demo data from JSON file alongside the block
 * @returns {Promise<{imageUrl: string, effects: string[]}>}
 */
async function loadDemoData() {
  try {
    const jsPath = import.meta.url;
    const demoPath = jsPath.replace(/\.js$/, '-demo.json');

    const response = await fetch(demoPath);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Could not load demo data:', error);
  }

  return { imageUrl: '', effects: [] };
}

/**
 * Create empty state indicator
 * @returns {HTMLElement}
 */
function createEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'viz-empty-state';
  emptyState.innerHTML = '<p>No image selected. Please configure the photo-effects-demo.json file.</p>';
  return emptyState;
}

/**
 * Create a checkbox control for an effect
 * @param {string} effect - Effect name
 * @param {boolean} isSelected - Whether the effect is initially selected
 * @returns {HTMLElement}
 */
function createEffectCheckbox(effect, isSelected = false) {
  const label = document.createElement('label');
  label.className = 'effect-checkbox';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = effect;
  checkbox.checked = isSelected;
  checkbox.dataset.effect = effect;

  const labelText = document.createElement('span');
  labelText.textContent = effect.charAt(0).toUpperCase() + effect.slice(1);

  label.appendChild(checkbox);
  label.appendChild(labelText);

  return label;
}

/**
 * Apply CSS classes for selected effects to image
 * @param {HTMLImageElement} img - Image element
 * @param {string[]} selectedEffects - Array of effect names to apply
 */
function applyEffects(img, selectedEffects) {
  EFFECTS.forEach((effect) => {
    img.classList.remove(`effect-${effect}`);
  });

  selectedEffects.forEach((effect) => {
    img.classList.add(`effect-${effect}`);
  });
}

/**
 * Upload effect configuration to AEM DAM
 * @param {string} imageUrl - Original image URL
 * @param {string[]} selectedEffects - Array of applied effects
 * @param {boolean} isAuthenticated - Whether user is authenticated
 */
async function uploadToAEM(imageUrl, selectedEffects, isAuthenticated) {
  if (!isAuthenticated) {
    showToast('Please log in to upload effects to AEM.', true);
    return;
  }

  try {
    const effectFileName = `photo-effect-${Date.now()}-${selectedEffects.join('-')}.json`;
    const effectsData = {
      originalImageUrl: imageUrl,
      effects: selectedEffects,
      timestamp: new Date().toISOString(),
    };

    // Check if this effect configuration already exists in AEM DAM
    const checkUrl = `/api/dam/check?path=/content/dam/photo-effects/${effectFileName}`;
    const checkResponse = await fetch(checkUrl, { credentials: 'include' });

    if (checkResponse.ok) {
      const existingData = await checkResponse.json();
      // eslint-disable-next-line no-use-before-define
      showPreviewModal(existingData);
      return;
    }

    // Upload new effect to AEM DAM
    const uploadResponse = await fetch('/api/dam/photo-effects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: effectFileName,
        path: '/content/dam/photo-effects',
        data: effectsData,
      }),
    });

    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      showToast('Effect uploaded to AEM successfully!');
      // eslint-disable-next-line no-use-before-define
      showPreviewModal(result);
    } else {
      const errorText = await uploadResponse.text();
      // eslint-disable-next-line no-console
      console.error('Upload failed:', errorText);
      showToast('Failed to upload effect to AEM.', true);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Upload error:', error);
    showToast('Error uploading effect to AEM.', true);
  }
}

/**
 * Display a modal with preview of the uploaded effect
 * @param {Object} effectData - Effect data from AEM
 */
function showPreviewModal(effectData) {
  const existing = document.querySelector('.effects-preview-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'effects-preview-modal';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = () => modal.remove();

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.onclick = (e) => e.stopPropagation();

  const header = document.createElement('div');
  header.className = 'modal-header';

  const title = document.createElement('h2');
  title.textContent = 'Effect Preview';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close modal');
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => modal.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = `
    <div class="effect-detail">
      <label>Image:</label>
      <p>${effectData.originalImageUrl}</p>
    </div>
    <div class="effect-detail">
      <label>Effects Applied:</label>
      <p>${effectData.effects && effectData.effects.length > 0 ? effectData.effects.join(', ') : 'None'}</p>
    </div>
    <div class="effect-detail">
      <label>Uploaded:</label>
      <p>${new Date(effectData.timestamp).toLocaleString()}</p>
    </div>
  `;

  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(overlay);
  modal.appendChild(content);

  document.body.appendChild(modal);
}

/**
 * Main decorate function for the photo-effects block
 * @param {HTMLElement} block - The block element to decorate
 */
export default async function decorate(block) {
  const data = await loadDemoData();
  const isAuthenticated = await isUserAuthenticated();

  block.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'photo-effects-container';

  if (!data.imageUrl) {
    container.appendChild(createEmptyState());
    block.appendChild(container);
    return;
  }

  // Image display section
  const imageSection = document.createElement('div');
  imageSection.className = 'photo-effects-image-section';

  const img = document.createElement('img');
  img.src = data.imageUrl;
  img.alt = 'Photo for effects editing';
  img.className = 'effect-image';

  imageSection.appendChild(img);
  container.appendChild(imageSection);

  // Effects controls section
  const controlsSection = document.createElement('div');
  controlsSection.className = 'photo-effects-controls-section';

  const controlsTitle = document.createElement('h3');
  controlsTitle.textContent = 'Select Effects';
  controlsSection.appendChild(controlsTitle);

  const checkboxGroup = document.createElement('div');
  checkboxGroup.className = 'effect-checkboxes';

  const selectedEffects = new Set(data.effects || []);

  EFFECTS.forEach((effect) => {
    const label = createEffectCheckbox(effect, selectedEffects.has(effect));
    const checkbox = label.querySelector('input');

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedEffects.add(effect);
      } else {
        selectedEffects.delete(effect);
      }
      applyEffects(img, Array.from(selectedEffects));
    });

    checkboxGroup.appendChild(label);
  });

  controlsSection.appendChild(checkboxGroup);

  // Upload button (only show if authenticated)
  if (isAuthenticated) {
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-upload-aem';
    uploadBtn.textContent = 'Upload to AEM';
    uploadBtn.type = 'button';
    // eslint-disable-next-line max-len
    uploadBtn.onclick = () => uploadToAEM(data.imageUrl, Array.from(selectedEffects), isAuthenticated);

    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'upload-button-wrapper';
    buttonWrapper.appendChild(uploadBtn);
    controlsSection.appendChild(buttonWrapper);
  }

  container.appendChild(controlsSection);

  applyEffects(img, Array.from(selectedEffects));

  block.appendChild(container);
}
