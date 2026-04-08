/* eslint-disable no-param-reassign */

/**
 * Viz Analytics Pulse Block
 * Real-time analytics dashboard with animated counter, pulse ring, sparkline,
 * region donut, KPI badges with alerts, and optional crypto price feed.
 * Design: Terminal/radar aesthetic with acid-mint and cyan accents.
 */

const DEFAULT_REFRESH_MS = 15000; // 15 seconds
const ANIMATION_DURATION_MS = 800;

/**
 * Smoothly animate a number from current to target.
 * Updates displayed digit-by-digit for smooth ticker effect.
 */
function animateNumber(element, targetValue, duration = 800) {
  const startValue = parseFloat(element.dataset.value) || 0;
  const startTime = Date.now();
  const valueChange = targetValue - startValue;

  element.dataset.value = targetValue;

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic for smooth deceleration
    const easeProgress = 1 - (1 - progress) ** 3;
    const currentValue = startValue + valueChange * easeProgress;

    element.textContent = Math.floor(currentValue).toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

/**
 * Render ticker cells for KPI row (top metrics).
 */
function renderTickerRow(data) {
  const kpis = data.kpis || {};
  const items = [
    {
      label: 'Active Users', value: kpis.activeUsers || 0, delta: kpis.activeUsersDelta, alert: kpis.activeUsersAlert,
    },
    {
      label: 'Page Views/min', value: kpis.pageViewsMin || 0, delta: kpis.pageViewsMinDelta, alert: kpis.pageViewsAlert,
    },
    {
      label: 'Bounce Rate', value: kpis.bounceRate || 0, delta: kpis.bounceRateDelta, alert: kpis.bounceRateAlert,
    },
    {
      label: 'Conversion', value: kpis.conversionRate || 0, delta: kpis.conversionRateDelta, alert: kpis.conversionAlert,
    },
    {
      label: 'Error Rate', value: kpis.errorRate || 0, delta: kpis.errorRateDelta, alert: kpis.errorRateAlert,
    },
  ];

  return items
    .map(
      (item) => `
      <div class="ticker-cell ${item.alert ? 'alert' : ''}">
        <div class="ticker-label">${item.label}</div>
        <div class="ticker-value" data-value="${item.value}">${Math.floor(item.value).toLocaleString()}</div>
        ${item.delta !== null && item.delta !== undefined ? `<div class="ticker-delta ${item.delta < 0 ? 'down' : ''}">${item.delta >= 0 ? '▲' : '▼'} ${Math.abs(item.delta)}%</div>` : ''}
      </div>
    `,
    )
    .join('');
}

/**
 * Render sparkline chart as bar chart (DOM-based, styled by CSS).
 * Last 30 data points with height-based scaling.
 */
function renderSparklineTrack(dataPoints = []) {
  if (!dataPoints || dataPoints.length === 0) {
    return '<div class="sparkline-track"></div>';
  }

  const points = dataPoints.slice(-30);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const bars = points
    .map((value) => {
      const normalized = (value - min) / range;
      const height = 10 + normalized * 38; // 10px to 48px
      let barClass = 'peak';
      if (normalized < 0.3) barClass = 'low';
      else if (normalized < 0.6) barClass = 'mid';
      return `<div class="sparkline-bar ${barClass}" style="height: ${height}px" data-value="${value}"></div>`;
    })
    .join('');

  return `<div class="sparkline-track">${bars}</div>`;
}

/**
 * Render regional legend with colored dots.
 */
function renderRegionalLegend(regionData = {}) {
  const regionColors = {
    us: 'var(--pulse-accent)',
    eu: 'var(--pulse-secondary)',
    de: 'var(--pulse-secondary)',
    gb: 'var(--pulse-secondary)',
    in: '#b48eff',
    jp: '#fc0',
    other: '#64748b',
  };

  const entries = Object.entries(regionData).slice(0, 6);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  const rows = entries
    .map(
      ([region, value]) => {
        const dotColor = regionColors[region] || '#64748b';
        return `
      <div class="region-row" data-region="${region}">
        <div class="region-dot" style="background:${dotColor}"></div>
        <div class="region-name">${region.toUpperCase()}</div>
        <div class="region-value">${((value / total) * 100).toFixed(1)}%</div>
      </div>
    `;
      },
    )
    .join('');

  return `
    <div class="regional-legend">
      <div class="regional-legend-title">Regions</div>
      ${rows}
    </div>
  `;
}

/**
 * Render top pages bar chart.
 */
function renderTopPages(pages = []) {
  if (!pages || pages.length === 0) return '';

  const maxValue = Math.max(...pages.map((p) => p.value));
  const pageRows = pages
    .slice(0, 5)
    .map(
      (page) => `
      <div class="page-bar-item">
        <div class="page-name">${page.name}</div>
        <div class="page-bar-outer">
          <div class="page-bar-inner" style="width: ${(page.value / maxValue) * 100}%"></div>
        </div>
        <div class="page-value">${page.value}</div>
      </div>
    `,
    )
    .join('');

  return `<div class="top-pages">${pageRows}</div>`;
}

/**
 * Render crypto price cards (optional).
 */
function renderCryptoPrices(prices = {}) {
  if (!prices || Object.keys(prices).length === 0) return '';

  const cards = Object.entries(prices)
    .map(
      ([symbol, info]) => `
      <div class="crypto-card">
        <div class="crypto-symbol">${symbol}</div>
        <div class="crypto-price">$${info.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        <div class="crypto-change ${info.change24h >= 0 ? 'positive' : 'negative'}">
          ${info.change24h >= 0 ? '▲' : '▼'} ${Math.abs(info.change24h).toFixed(2)}%
        </div>
      </div>
    `,
    )
    .join('');

  return `<div class="crypto-prices">${cards}</div>`;
}

/**
 * Fetch crypto prices from CoinGecko API.
 */
async function fetchCoinGeckoData() {
  try {
    const ids = 'bitcoin,ethereum,solana';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    );
    const data = await response.json();

    return {
      cryptoPrices: {
        BTC: {
          price: data.bitcoin.usd,
          change24h: data.bitcoin.usd_24h_change,
        },
        ETH: {
          price: data.ethereum.usd,
          change24h: data.ethereum.usd_24h_change,
        },
        SOL: {
          price: data.solana.usd,
          change24h: data.solana.usd_24h_change,
        },
      },
    };
  } catch (error) {
    console.error('CoinGecko API error:', error);
    return null;
  }
}

/**
 * Fetch and parse data from URL or coingecko API.
 */
async function fetchData(dataUrl, liveApi) {
  try {
    if (liveApi === 'coingecko-price') {
      return await fetchCoinGeckoData();
    }

    if (!dataUrl) return null;

    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Data fetch error:', error);
    return null;
  }
}

/**
 * Update dashboard with fresh data.
 */
function updateDashboard(block, data) {
  if (!data) return;

  // Update ticker cells (KPI row)
  const ticker = block.querySelector('.ticker');
  if (ticker && data.kpis) {
    ticker.innerHTML = renderTickerRow(data);

    // Animate each ticker value
    ticker.querySelectorAll('.ticker-value').forEach((el) => {
      const targetValue = parseFloat(el.dataset.value);
      animateNumber(el, targetValue, ANIMATION_DURATION_MS);
    });
  }

  // Update sparkline
  const sparklineTrack = block.querySelector('.sparkline-track');
  if (sparklineTrack && data.sparklineData) {
    sparklineTrack.innerHTML = renderSparklineTrack(data.sparklineData).replace('<div class="sparkline-track">', '').replace('</div>', '');
  }

  // Update counter value (center)
  const counterValue = block.querySelector('.pulse-counter-value');
  if (counterValue && data.activeUsers !== undefined) {
    animateNumber(counterValue, data.activeUsers, ANIMATION_DURATION_MS);
  }

  // Update regional legend
  const regionalLegend = block.querySelector('.regional-legend');
  if (regionalLegend && data.regionData) {
    regionalLegend.innerHTML = renderRegionalLegend(data.regionData).replace('<div class="regional-legend">', '').replace('</div>', '').replace(/<div class="regional-legend-title">Regions<\/div>/g, '');
  }

  // Update top pages
  const topPages = block.querySelector('.top-pages');
  if (topPages && data.topPages) {
    topPages.innerHTML = renderTopPages(data.topPages).replace('<div class="top-pages">', '').replace('</div>', '');
  }

  // Update crypto prices if available
  const pulseMain = block.querySelector('.pulse-main');
  if (data.cryptoPrices && pulseMain) {
    let cryptoSection = block.querySelector('.crypto-prices');
    if (!cryptoSection) {
      cryptoSection = document.createElement('div');
      cryptoSection.className = 'crypto-prices';
      pulseMain.appendChild(cryptoSection);
    }
    cryptoSection.innerHTML = renderCryptoPrices(data.cryptoPrices).replace('<div class="crypto-prices">', '').replace('</div>', '');
  }
}

/**
 * Initialize and decorate the block.
 * Builds the terminal/radar aesthetic structure matching the CSS design.
 */
export default async function decorate(block) {
  block.classList.add('viz-analytics-pulse');

  // Parse configuration from block data
  const config = {
    dataUrl: block.querySelector('a')?.href || '',
    liveApi: block.dataset.liveApi || null,
    refreshMs: parseInt(block.dataset.refreshMs, 10) || DEFAULT_REFRESH_MS,
    accent: block.dataset.accent || 'cyan',
  };

  if (config.accent) {
    block.setAttribute('data-accent', config.accent);
  }

  // Build dashboard structure following CSS expectations
  block.innerHTML = `
    <div class="pulse-shell">
      <!-- Top ticker row: KPI badges -->
      <div class="ticker"></div>

      <!-- Main body: center counter + sidebar legend + top pages -->
      <div class="pulse-body">
        <div class="pulse-main">
          <!-- Center counter with pulse rings -->
          <div class="pulse-center">
            <div class="pulse-ring-wrap">
              <div class="pulse-ring-outer"></div>
              <div class="pulse-ring-mid"></div>
              <div class="pulse-ring"></div>
              <div class="pulse-counter-value" data-value="0">0</div>
            </div>
            <div class="pulse-counter-label">Active Users</div>
          </div>

          <!-- Sparkline chart (activity over time) -->
          <div class="sparkline-track"></div>

          <!-- Top pages bar chart -->
          <div class="top-pages"></div>

          <!-- Crypto prices (optional) -->
        </div>

        <!-- Sidebar: regional breakdown -->
        <div class="pulse-sidebar">
          <div class="regional-legend"></div>
        </div>
      </div>

      <!-- Footer: status indicator -->
      <div class="pulse-footer">
        <span><span class="pulse-status-dot"></span>LIVE</span>
        <span>Last update: <time>now</time></span>
      </div>
    </div>
  `;

  // Fall back to block-local demo JSON when no data source configured
  if (!config.dataUrl && !config.liveApi) {
    config.dataUrl = new URL('./viz-analytics-pulse-demo.json', import.meta.url).href;
  }

  // Initial data load and set up polling
  if (config.dataUrl || config.liveApi) {
    const pollData = async () => {
      const data = await fetchData(config.dataUrl, config.liveApi);
      if (data) {
        updateDashboard(block, data);
        // Update timestamp
        const timeEl = block.querySelector('time');
        if (timeEl) {
          const now = new Date();
          timeEl.textContent = now.toLocaleTimeString();
          timeEl.dateTime = now.toISOString();
        }
      }
    };

    // Fetch immediately
    await pollData();

    // Set up interval for continuous updates
    setInterval(pollData, config.refreshMs);
  }
}
