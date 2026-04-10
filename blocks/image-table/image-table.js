import { createOptimizedPicture } from '../../scripts/aem.js';

async function loadDemoData() {
  try {
    const url = new URL('image-table.json', import.meta.url);
    const response = await fetch(url.href);
    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    console.warn('Failed to load demo data:', error);
    return [];
  }
}

export default async function decorate(block) {
  // Try to get data from block content first, fallback to demo JSON
  let data = [];

  if (block.textContent && block.textContent.trim()) {
    try {
      data = JSON.parse(block.textContent);
    } catch (e) {
      data = await loadDemoData();
    }
  } else {
    data = await loadDemoData();
  }

  if (!data || data.length === 0) {
    block.innerHTML = '<div class="viz-empty-state">No images</div>';
    return;
  }

  // Create table structure
  const table = document.createElement('table');

  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Thumbnail', 'Name', 'Keywords', 'Color Tags', 'Description'];

  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement('tbody');

  data.forEach((image) => {
    const row = document.createElement('tr');

    // Thumbnail
    const thumbnailCell = document.createElement('td');
    if (image.thumbnail || image.src) {
      const picture = createOptimizedPicture(image.thumbnail || image.src);
      thumbnailCell.appendChild(picture);
    }
    row.appendChild(thumbnailCell);

    // Name
    const nameCell = document.createElement('td');
    nameCell.textContent = image.name || '';
    row.appendChild(nameCell);

    // Keywords
    const keywordsCell = document.createElement('td');
    const keywords = Array.isArray(image.keywords) ? image.keywords.join(', ') : (image.keywords || '');
    keywordsCell.textContent = keywords;
    row.appendChild(keywordsCell);

    // Color Tags
    const colorTagsCell = document.createElement('td');
    const colorTags = Array.isArray(image.colorTags) ? image.colorTags.join(', ') : (image.colorTags || '');
    colorTagsCell.textContent = colorTags;
    row.appendChild(colorTagsCell);

    // Description
    const descriptionCell = document.createElement('td');
    descriptionCell.textContent = image.description || '';
    row.appendChild(descriptionCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  block.innerHTML = '';
  block.appendChild(table);
}
