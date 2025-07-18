const axios = require('axios');

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

class ForexService {
  constructor() {
    this.baseURL = 'https://api.exchangerate.host';
    this.fallbackURL = 'https://api.fxratesapi.com';
  }

  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // Primary API
      const response = await retryWithBackoff(() => axios.get(`${this.baseURL}/latest`, {
        params: {
          base: fromCurrency,
          symbols: toCurrency
        },
        timeout: 8000
      }), 4, 1000, 2);

      if (response.data && response.data.rates && response.data.rates[toCurrency]) {
        return {
          rate: response.data.rates[toCurrency],
          source: 'exchangerate.host'
        };
      }
    } catch (error) {
      console.warn(`⚠️ Primary forex API failed: ${error.message}`);
    }

    try {
      // Fallback API
      const response = await retryWithBackoff(() => axios.get(`${this.fallbackURL}/latest`, {
        params: {
          base: fromCurrency,
          symbols: toCurrency
        },
        timeout: 8000
      }), 4, 1000, 2);

      if (response.data && response.data.rates && response.data.rates[toCurrency]) {
        return {
          rate: response.data.rates[toCurrency],
          source: 'fxratesapi.com'
        };
      }
    } catch (error) {
      console.warn(`⚠️ Fallback forex API failed: ${error.message}`);
    }

    // Manual fallback rates for major pairs
    const fallbackRates = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 149.50,
      'AUDUSD': 0.6580,
      'USDCAD': 1.3920,
      'NZDUSD': 0.5890
    };

    const symbol = fromCurrency + toCurrency;
    if (fallbackRates[symbol]) {
      console.log(`📊 Using fallback rate for ${symbol}: ${fallbackRates[symbol]}`);
      return {
        rate: fallbackRates[symbol],
        source: 'fallback'
      };
    }

    throw new Error(`No rate available for ${fromCurrency}/${toCurrency}`);
  }
}

module.exports = new ForexService();