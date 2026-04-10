const DEMO_JSON_PATH = 'image-explorer-demo.json';

async function loadImageData(block) {
  try {
    const url = new URL(DEMO_JSON_PATH, import.meta.url);
    const response = await fetch(url);
    if (response.ok) {
      const json = await response.json();
      return Array.isArray(json) ? json : json.items || [];
    }
  } catch (error) {
    console.warn('Failed to load image explorer demo data:', error);
  }

  const dataAttr = block.dataset.images;
  if (dataAttr) {
    try {
      return JSON.parse(dataAttr);
    } catch (e) {
      console.warn('Invalid data-images attribute:', e);
    }
  }

  return [];
}

function renderTable(data) {
  const table = document.createElement('table');
  table.className = 'image-explorer-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Image', 'Color Tags', 'AI Keywords'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.forEach((item) => {
    const row = document.createElement('tr');
    row.className = 'image-explorer-row';

    const imgCell = document.createElement('td');
    if (item.src || item.image) {
      const img = document.createElement('img');
      img.src = item.src || item.image;
      img.alt = item.alt || item.name || 'Image';
      img.style.maxWidth = '100px';
      img.style.height = 'auto';
      imgCell.appendChild(img);
    }
    row.appendChild(imgCell);

    const tagsCell = document.createElement('td');
    if (item.colorTags) {
      if (Array.isArray(item.colorTags)) {
        item.colorTags.forEach((tag) => {
          const span = document.createElement('span');
          span.className = 'color-tag';
          span.textContent = tag;
          span.style.display = 'inline-block';
          span.style.padding = '4px 8px';
          span.style.margin = '2px';
          span.style.backgroundColor = '#f0f0f0';
          span.style.borderRadius = '4px';
          tagsCell.appendChild(span);
        });
      } else {
        tagsCell.textContent = String(item.colorTags);
      }
    }
    row.appendChild(tagsCell);

    const keywordsCell = document.createElement('td');
    if (item.aiKeywords) {
      if (Array.isArray(item.aiKeywords)) {
        keywordsCell.textContent = item.aiKeywords.join(', ');
      } else {
        keywordsCell.textContent = String(item.aiKeywords);
      }
    }
    row.appendChild(keywordsCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  return table;
}

function renderEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'viz-empty-state';
  empty.innerHTML = '<p>No images available.</p><button class="dam-browse-btn">Browse DAM</button>';
  return empty;
}

export default async function decorate(block) {
  const data = await loadImageData(block);

  block.innerHTML = '';

  if (!data || data.length === 0) {
    const emptyState = renderEmptyState();
    block.appendChild(emptyState);
    const browseBtn = emptyState.querySelector('.dam-browse-btn');
    // eslint-disable-next-line no-use-before-define
    browseBtn.addEventListener('click', handleDAMBrowse);
  } else {
    block.appendChild(renderTable(data));
  }
}

function handleDAMBrowse() {
  console.log('Opening DAM browser...');
}
