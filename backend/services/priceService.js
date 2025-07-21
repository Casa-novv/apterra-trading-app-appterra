const axios = require('axios');

class PriceService {
  constructor() {
    this.apis = {
      coingecko: {
        name: 'CoinGecko',
        url: 'https://api.coingecko.com/api/v3',
        available: true,
        inCooldown: false,
        failures: 0,
        lastUsed: null,
        cooldownUntil: null
      },
      alphaVantage: {
        name: 'Alpha Vantage',
        url: 'https://www.alphavantage.co/query',
        available: true,
        inCooldown: false,
        failures: 0,
        lastUsed: null,
        cooldownUntil: null
      },
      twelveData: {
        name: 'Twelve Data',
        url: 'https://api.twelvedata.com',
        available: true,
        inCooldown: false,
        failures: 0,
        lastUsed: null,
        cooldownUntil: null
      }
    };
  }

  getAPIStatus() {
    return this.apis;
  }

  async testAPI(apiName) {
    const api = this.apis[apiName];
    if (!api) {
      throw new Error(`Unknown API: ${apiName}`);
    }

    try {
      if (apiName === 'coingecko') {
        const response = await axios.get(`${api.url}/ping`, { timeout: 5000 });
        api.available = response.status === 200;
        api.failures = 0;
      } else if (apiName === 'alphaVantage') {
        // Test with a simple request
        const response = await axios.get(`${api.url}?function=TIME_SERIES_INTRADAY&symbol=AAPL&interval=1min&apikey=demo`, { timeout: 5000 });
        api.available = response.status === 200;
        api.failures = 0;
      } else if (apiName === 'twelveData') {
        // Test with a simple request
        const response = await axios.get(`${api.url}/time_series?symbol=AAPL&interval=1min&apikey=demo`, { timeout: 5000 });
        api.available = response.status === 200;
        api.failures = 0;
      }

      api.lastUsed = new Date();
      return api.available;
    } catch (error) {
      console.error(`❌ API test failed for ${apiName}:`, error.message);
      api.available = false;
      api.failures++;
      return false;
    }
  }

  async getPrice(symbol, apiName = 'coingecko') {
    const api = this.apis[apiName];
    if (!api || !api.available) {
      throw new Error(`API ${apiName} is not available`);
    }

    if (api.inCooldown && api.cooldownUntil && new Date() < api.cooldownUntil) {
      throw new Error(`API ${apiName} is in cooldown until ${api.cooldownUntil}`);
    }

    try {
      let price = null;

      if (apiName === 'coingecko') {
        // Map symbols to CoinGecko IDs
        const symbolMap = {
          'BTC': 'bitcoin',
          'ETH': 'ethereum',
          'SOL': 'solana',
          'ADA': 'cardano',
          'BNB': 'binancecoin'
        };

        const coinId = symbolMap[symbol];
        if (!coinId) {
          throw new Error(`Symbol ${symbol} not supported by CoinGecko`);
        }

        const response = await axios.get(`${api.url}/simple/price?ids=${coinId}&vs_currencies=usd`, {
          timeout: 10000
        });

        price = response.data[coinId]?.usd;
      } else if (apiName === 'alphaVantage') {
        const response = await axios.get(`${api.url}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_KEY || 'demo'}`, {
          timeout: 10000
        });

        price = parseFloat(response.data['Global Quote']?.['05. price']);
      } else if (apiName === 'twelveData') {
        const response = await axios.get(`${api.url}/price?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_KEY || 'demo'}`, {
          timeout: 10000
        });

        price = parseFloat(response.data.price);
      }

      if (!price) {
        throw new Error(`No price data received for ${symbol}`);
      }

      api.lastUsed = new Date();
      api.failures = 0;
      return price;

    } catch (error) {
      console.error(`❌ Error fetching price for ${symbol} from ${apiName}:`, error.message);
      api.failures++;
      
      // Put API in cooldown if too many failures
      if (api.failures >= 3) {
        api.inCooldown = true;
        api.cooldownUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        console.log(`⚠️ API ${apiName} put in cooldown for 5 minutes due to failures`);
      }

      throw error;
    }
  }

  async getPrices(symbols, apiName = 'coingecko') {
    const prices = {};
    
    for (const symbol of symbols) {
      try {
        prices[symbol] = await this.getPrice(symbol, apiName);
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to get price for ${symbol}:`, error.message);
        prices[symbol] = null;
      }
    }

    return prices;
  }
}

module.exports = new PriceService(); 