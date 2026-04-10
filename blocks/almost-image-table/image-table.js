export default async function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = '1';
  block.innerHTML = '';
  // Resolve the demo JSON path relative to this module
  const baseUrl = new URL(import.meta.url);
  const demoJsonUrl = new URL('./image-table-demo.json', baseUrl);

  try {
    const response = await fetch(demoJsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch demo JSON: ${response.status}`);
    }
    const data = await response.json();

    // Handle empty data
    if (!data || !data.images || data.images.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'viz-empty-state';
      block.appendChild(emptyState);
      return;
    }

    // Create table
    const table = document.createElement('table');
    table.className = 'image-table-grid';

    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Thumbnail', 'Name', 'Keywords', 'Color Tags'].forEach((headerText) => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement('tbody');
    data.images.forEach((image) => {
      const row = document.createElement('tr');

      // Thumbnail column - clickable
      const thumbnailCell = document.createElement('td');
      const img = document.createElement('img');
      img.src = image.thumbnail || image.url;
      img.alt = image.name || 'Image';
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => {
        window.open(image.url, '_blank');
      });
      thumbnailCell.appendChild(img);
      row.appendChild(thumbnailCell);

      // Name column
      const nameCell = document.createElement('td');
      nameCell.textContent = image.name || '';
      row.appendChild(nameCell);

      // Keywords column (comma-separated)
      const keywordsCell = document.createElement('td');
      const keywords = image.keywords || [];
      keywordsCell.textContent = Array.isArray(keywords) ? keywords.join(', ') : keywords;
      row.appendChild(keywordsCell);

      // Color Tags column (comma-separated)
      const tagsCell = document.createElement('td');
      const colorTags = image.colorTags || [];
      tagsCell.textContent = Array.isArray(colorTags) ? colorTags.join(', ') : colorTags;
      row.appendChild(tagsCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    block.appendChild(table);
  } catch (error) {
    // Handle errors by showing empty state
    const emptyState = document.createElement('div');
    emptyState.className = 'viz-empty-state';
    block.appendChild(emptyState);
    // eslint-disable-next-line no-console
    console.error('Error loading image table:', error);
  }
}
