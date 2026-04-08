const DEMO_URL = new URL('data-explorer-demo.json', import.meta.url);

function parseConfig(block) {
  const rows = [...block.children];
  const dataUrl = rows[0]?.children[0]?.textContent?.trim() || '';
  const columns = (rows[1]?.children[0]?.textContent?.trim() || '')
    .split(',').filter(Boolean).map((c) => {
      const [field, label] = c.split(':');
      return { field: field.trim(), label: (label || field).trim() };
    });
  const filterFields = (rows[2]?.children[0]?.textContent?.trim() || '')
    .split(',').filter(Boolean).map((f) => f.trim());
  const pageSize = parseInt(rows[3]?.children[0]?.textContent?.trim() || '10', 10);
  return {
    dataUrl, columns, filterFields, pageSize,
  };
}

export default async function decorate(block) {
  const config = parseConfig(block);
  block.innerHTML = '<div class="data-explorer-loading">Loading…</div>';

  let data = [];
  try {
    const url = config.dataUrl || DEMO_URL;
    const resp = await fetch(url);
    const json = await resp.json();
    data = Array.isArray(json) ? json : (json.data ?? json.rows ?? []);
  } catch {
    block.innerHTML = '<div class="viz-empty-state">Failed to load data.</div>';
    return;
  }
  if (!data.length) { block.innerHTML = '<div class="viz-empty-state">No data.</div>'; return; }

  const columns = config.columns.length
    ? config.columns
    : Object.keys(data[0]).map((k) => ({ field: k, label: k }));

  let sortField = '';
  let sortAsc = true;
  const filters = {};
  let search = '';
  let page = 0;
  const { pageSize } = config;

  const filtered = () => data.filter((row) => {
    const matchSearch = !search
      || columns.some(({ field }) => {
        const val = String(row[field] ?? '').toLowerCase();
        return val.includes(search.toLowerCase());
      });
    const matchFilters = Object.entries(filters)
      .every(([f, vals]) => !vals.size || vals.has(String(row[f])));
    return matchSearch && matchFilters;
  });

  const sorted = (rows) => (!sortField ? rows : [...rows].sort((a, b) => {
    const va = String(a[sortField] ?? '');
    const vb = String(b[sortField] ?? '');
    return sortAsc
      ? va.localeCompare(vb, undefined, { numeric: true })
      : vb.localeCompare(va, undefined, { numeric: true });
  }));

  function render() {
    const rows = sorted(filtered());
    const total = rows.length;
    const start = page * pageSize;
    const pageRows = rows.slice(start, start + pageSize);
    block.innerHTML = '';

    const searchEl = Object.assign(document.createElement('input'), {
      type: 'search', placeholder: 'Search…', value: search, className: 'data-explorer-search',
    });
    searchEl.addEventListener('input', (e) => { search = e.target.value; page = 0; render(); });
    block.append(searchEl);

    if (config.filterFields.length) {
      const bar = document.createElement('div');
      bar.className = 'data-explorer-filters';
      config.filterFields.forEach((field) => {
        const vals = [...new Set(data.map((r) => String(r[field] ?? '')))].sort();
        vals.forEach((val) => {
          const chip = Object.assign(document.createElement('button'), { textContent: val, className: 'data-explorer-chip' });
          if (filters[field]?.has(val)) chip.classList.add('is-active');
          chip.addEventListener('click', () => {
            filters[field] = filters[field] || new Set();
            if (filters[field].has(val)) {
              filters[field].delete(val);
            } else {
              filters[field].add(val);
            }
            page = 0;
            render();
          });
          bar.append(chip);
        });
      });
      block.append(bar);
    }

    const table = document.createElement('table');
    table.className = 'data-explorer-table';
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    columns.forEach(({ field, label }) => {
      const th = Object.assign(document.createElement('th'), { textContent: label });
      if (sortField === field) th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
      th.addEventListener('click', () => {
        if (sortField === field) {
          sortAsc = !sortAsc;
        } else {
          sortField = field;
          sortAsc = true;
        }
        render();
      });
      hr.append(th);
    });
    thead.append(hr);
    table.append(thead);

    const tbody = document.createElement('tbody');
    (pageRows.length ? pageRows : []).forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach(({ field }) => { const td = document.createElement('td'); td.textContent = row[field] ?? ''; tr.append(td); });
      tbody.append(tr);
    });
    if (!pageRows.length) { const tr = document.createElement('tr'); const td = Object.assign(document.createElement('td'), { colSpan: columns.length, textContent: 'No results.' }); tr.append(td); tbody.append(tr); }
    table.append(tbody);
    block.append(table);

    const pager = document.createElement('div');
    pager.className = 'data-explorer-pager';
    const prev = Object.assign(document.createElement('button'), { textContent: '← Prev', disabled: page === 0 });
    prev.addEventListener('click', () => { page -= 1; render(); });
    const info = Object.assign(document.createElement('span'), { textContent: `${start + 1}–${Math.min(start + pageSize, total)} of ${total}` });
    const next = Object.assign(document.createElement('button'), { textContent: 'Next →', disabled: start + pageSize >= total });
    next.addEventListener('click', () => { page += 1; render(); });
    pager.append(prev, info, next);
    block.append(pager);
  }
  render();
}
