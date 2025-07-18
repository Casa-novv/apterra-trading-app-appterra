const axios = require('axios');

// --- Helper to detect asset type ---
function detectMarket(symbol) {
  if (symbol.endsWith('USDT') || symbol.endsWith('USD')) return 'crypto';
  if (symbol.includes('/')) return 'forex';
  // crude: if it's all letters and 3-5 chars, treat as stock
  if (/^[A-Z]{3,5}$/.test(symbol)) return 'stock';
  return 'crypto';
}

// Helper for retry logic with exponential backoff
async function retryWithBackoff(fn, retries = 3, delay = 1000, factor = 2) {
  let attempt = 0;
  let lastError;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise(res => setTimeout(res, delay * Math.pow(factor, attempt)));
      }
      attempt++;
    }
  }
  throw lastError;
}

// --- Main price fetcher ---
module.exports = async function getPrice(symbol) {
  const market = detectMarket(symbol);

  // --- Crypto (Binance) ---
  if (market === 'crypto') {
    // Binance expects e.g. BTCUSDT, ETHUSDT
    try {
      const res = await retryWithBackoff(() => axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`), 4, 1000, 2);
      return parseFloat(res.data.price);
    } catch (e) {
      throw new Error(`Failed to fetch crypto price for ${symbol}`);
    }
  }

  // --- Forex (Twelve Data, free) ---
  if (market === 'forex') {
    // symbol like EUR/USD
    const [base, quote] = symbol.split('/');
    try {
      const res = await retryWithBackoff(() => axios.get(`https://api.twelvedata.com/price?symbol=${base}${quote}&apikey=demo`), 4, 1000, 2);
      if (res.data && res.data.price) return parseFloat(res.data.price);
      throw new Error();
    } catch (e) {
      throw new Error(`Failed to fetch forex price for ${symbol}`);
    }
  }

  // --- Stocks (Alpha Vantage, free) ---
  if (market === 'stock') {
    // You need a free API key from https://www.alphavantage.co/support/#api-key
    const API_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo';
    try {
      const res = await retryWithBackoff(() => axios.get(`https://www.alphavantage.co/query`, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol,
          apikey: API_KEY,
        },
      }), 4, 1000, 2);
      const price = res.data['Global Quote'] && res.data['Global Quote']['05. price'];
      if (price) return parseFloat(price);
      throw new Error();
    } catch (e) {
      throw new Error(`Failed to fetch stock price for ${symbol}`);
    }
  }

  throw new Error(`Unknown symbol type for ${symbol}`);
};