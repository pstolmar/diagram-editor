// Crypto price pulse visualization with WebSocket streaming and REST fallback
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker/solusdt@miniTicker';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

// Config: pairs to display, currency, theme
const DEFAULT_CONFIG = {
  pairs: ['btcusdt', 'ethusdt', 'solusdt'],
  currency: 'usd',
  theme: 'dark', // 'dark' or 'light'
};

class CryptoPulse {
  constructor(block, config = {}) {
    this.block = block;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.priceHistory = {}; // {pair: [price, price, ...]} - max 60 points
    this.currentPrices = {}; // {pair: {price, open, 24hChange}}
    this.connStatus = 'offline'; // 'ws' | 'rest' | 'offline'
    this.ws = null;
    this.restInterval = null;
    this.priceAnimations = {}; // {pair: {current, target, startTime}}

    this.init();
  }

  async init() {
    this.render();
    this.startWebSocket();
  }

  render() {
    const container = document.createElement('div');
    container.className = `viz-crypto-pulse ${this.config.theme}`;
    container.innerHTML = `
      <div class="crypto-header">
        <div class="crypto-title">Price Feed</div>
        <div class="crypto-status">
          <div class="status-dot" data-status="offline"></div>
          <span class="status-label">Initializing...</span>
        </div>
      </div>
      <div class="crypto-cards">
        ${this.config.pairs.map((pair) => `
          <div class="price-card" data-pair="${pair}">
            <div class="card-symbol">${pair.toUpperCase()}</div>
            <div class="card-price">
              <span class="price-value">—</span>
              <span class="price-currency">${this.config.currency.toUpperCase()}</span>
            </div>
            <div class="card-change">
              <span class="change-value">—</span>
              <span class="change-percent">—</span>
            </div>
            <canvas class="sparkline" width="80" height="32"></canvas>
          </div>
        `).join('')}
      </div>
    `;

    this.block.innerHTML = '';
    this.block.appendChild(container);
    this.elements = {
      container,
      statusDot: container.querySelector('.status-dot'),
      statusLabel: container.querySelector('.status-label'),
      cards: new Map(),
    };

    // Cache card elements
    this.config.pairs.forEach((pair) => {
      const card = container.querySelector(`[data-pair="${pair}"]`);
      this.elements.cards.set(pair, {
        card,
        symbol: card.querySelector('.card-symbol'),
        priceValue: card.querySelector('.price-value'),
        priceCurrency: card.querySelector('.price-currency'),
        changeValue: card.querySelector('.change-value'),
        changePercent: card.querySelector('.change-percent'),
        sparkline: card.querySelector('.sparkline'),
      });
    });
  }

  startWebSocket() {
    try {
      this.ws = new WebSocket(BINANCE_WS_URL);
      this.ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.log('WebSocket connected');
      };
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.data && data.data.s && data.data.c) {
          const pair = data.data.s.toLowerCase();
          const price = parseFloat(data.data.c);
          const open = parseFloat(data.data.o);
          this.updatePrice(pair, price, open);
        }
      };
      this.ws.onerror = () => {
        this.setStatus('offline');
        this.startRESTFallback();
      };
      this.ws.onclose = () => {
        this.setStatus('offline');
        this.startRESTFallback();
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('WebSocket error:', err);
      this.startRESTFallback();
    }
  }

  startRESTFallback() {
    if (this.restInterval) return; // Already running

    const fetchPrices = async () => {
      try {
        const ids = this.config.pairs.map((p) => p.replace('usdt', '')).join(',');
        const res = await fetch(
          `${COINGECKO_URL}?ids=${ids}&vs_currencies=${this.config.currency}&include_market_cap=false&include_24hr_vol=false&include_24hr_change=true`,
        );
        const data = await res.json();

        // Map CoinGecko response to price updates
        this.config.pairs.forEach((pair) => {
          const id = pair.replace('usdt', '');
          if (data[id]) {
            const price = data[id][this.config.currency];
            const change24h = data[id][`${this.config.currency}_24h_change`];
            const open = price / (1 + change24h / 100); // Estimate open from 24h change
            this.updatePrice(pair, price, open);
          }
        });

        this.setStatus('rest');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('REST fetch error:', err);
        // Last-resort: load static demo JSON to show something
        try {
          const demoUrl = new URL('./viz-crypto-pulse-demo.json', import.meta.url).href;
          const demoRes = await fetch(demoUrl);
          if (demoRes.ok) {
            const demo = await demoRes.json();
            this.config.pairs.forEach((pair) => {
              const entry = demo[pair.toLowerCase()];
              if (entry) {
                // Add ±1% random walk to simulate movement
                const jitter = 1 + (Math.random() - 0.5) * 0.02;
                this.updatePrice(pair, entry.price * jitter, entry.open);
              }
            });
            this.setStatus('demo');
          }
        } catch { /* give up */ }
      }
    };

    fetchPrices();
    this.restInterval = setInterval(fetchPrices, 15000); // Fetch every 15s
  }

  updatePrice(pair, price, open) {
    const pairKey = pair.toLowerCase();
    if (!this.config.pairs.includes(pairKey)) return;

    // Initialize history if needed
    if (!this.priceHistory[pairKey]) {
      this.priceHistory[pairKey] = [];
    }

    // Add to history (max 60 points)
    this.priceHistory[pairKey].push(price);
    if (this.priceHistory[pairKey].length > 60) {
      this.priceHistory[pairKey].shift();
    }

    // Calculate 24h change
    const change24h = ((price - open) / open) * 100;

    // Store current price
    this.currentPrices[pairKey] = { price, open, change24h };

    // Start animation
    this.animatePrice(pairKey, price);

    // Update UI
    this.updateCardUI(pairKey);
    this.drawSparkline(pairKey);

    // Update connection status if WS
    if (this.connStatus !== 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.setStatus('ws');
    }
  }

  animatePrice(pair, targetPrice) {
    const now = Date.now();
    this.priceAnimations[pair] = {
      current: this.priceAnimations[pair]?.current ?? targetPrice,
      target: targetPrice,
      startTime: now,
    };
  }

  updateCardUI(pair) {
    if (!this.elements.cards.has(pair)) return;

    const card = this.elements.cards.get(pair);
    const anim = this.priceAnimations[pair];
    const data = this.currentPrices[pair];

    if (!data) return;

    // Interpolate animated price (300ms)
    let displayPrice = data.price;
    if (anim) {
      const elapsed = Math.min(Date.now() - anim.startTime, 300);
      const progress = elapsed / 300;
      displayPrice = anim.current + (anim.target - anim.current) * progress;

      // Schedule next frame if still animating
      if (elapsed < 300) {
        requestAnimationFrame(() => this.updateCardUI(pair));
      }
    }

    // Format price (handle currency-specific decimals)
    const formatted = displayPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    card.priceValue.textContent = formatted;

    // Update 24h change (green/red)
    const changePercent = data.change24h.toFixed(2);
    const changeClass = data.change24h >= 0 ? 'positive' : 'negative';
    card.changeValue.className = `change-value ${changeClass}`;
    card.changeValue.textContent = data.change24h >= 0 ? '+' : '';
    card.changePercent.className = `change-percent ${changeClass}`;
    card.changePercent.textContent = `${changePercent}%`;
  }

  drawSparkline(pair) {
    if (!this.elements.cards.has(pair)) return;

    const canvas = this.elements.cards.get(pair).sparkline;
    const ctx = canvas.getContext('2d');
    const history = this.priceHistory[pair];

    if (!history || history.length < 2) return;

    // Clear canvas
    ctx.fillStyle = this.config.theme === 'dark' ? '#1a1a1a' : '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find min/max for scaling
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;

    // Draw sparkline
    ctx.strokeStyle = this.config.theme === 'dark' ? '#4ade80' : '#22c55e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    history.forEach(((price, i) => {
      const x = (i / (history.length - 1)) * canvas.width;
      const y = canvas.height - ((price - min) / range) * canvas.height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }));
    ctx.stroke();

    // Add subtle gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (this.config.theme === 'dark') {
      gradient.addColorStop(0, 'rgba(74, 222, 128, 0.2)');
      gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
    }

    ctx.fillStyle = gradient;
    ctx.fill();
  }

  setStatus(status) {
    this.connStatus = status;
    this.elements.statusDot.setAttribute('data-status', status);

    const labels = {
      ws: 'Live (WebSocket)',
      rest: 'Polling (REST)',
      demo: 'Demo Data',
      offline: 'Offline',
    };
    this.elements.statusLabel.textContent = labels[status] || 'Offline';
  }

  destroy() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.restInterval) {
      clearInterval(this.restInterval);
    }
  }
}

export default async function decorate(block) {
  // Parse config from block data attributes or content
  const configStr = block.getAttribute('data-config');
  let config = {};

  if (configStr) {
    try {
      config = JSON.parse(configStr);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse config:', e);
    }
  }

  // Also check for individual attributes
  if (block.getAttribute('data-pairs')) {
    config.pairs = block.getAttribute('data-pairs').split(',').map((p) => p.trim().toLowerCase());
  }
  if (block.getAttribute('data-currency')) {
    config.currency = block.getAttribute('data-currency').toLowerCase();
  }
  if (block.getAttribute('data-theme')) {
    config.theme = block.getAttribute('data-theme').toLowerCase();
  }

  const cryptoPulse = new CryptoPulse(block, config);

  // Cleanup on block removal (if using dynamic unload)
  block.addEventListener('unload', () => cryptoPulse.destroy());
}
