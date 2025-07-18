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

class PriceService {
  constructor() {
    this.rateLimits = {
      coinGecko: { lastCall: 0, minInterval: 6000, failures: 0 }, // 10 calls per minute
      binance: { lastCall: 0, minInterval: 1000, failures: 0 },   // 1200 calls per minute
      alphaVantage: { lastCall: 0, minInterval: 12000, failures: 0 }, // 5 calls per minute
      twelveData: { lastCall: 0, minInterval: 8000, failures: 0 }  // 8 calls per minute
    };
    
    this.maxFailures = 3; // Max failures before temporarily disabling API
    this.cooldownPeriod = 300000; // 5 minutes cooldown after max failures
  }

  canUseAPI(apiName) {
    const api = this.rateLimits[apiName];
    const now = Date.now();
    
    // Check if API is in cooldown due to failures
    if (api.failures >= this.maxFailures) {
      if (now - api.lastCall < this.cooldownPeriod) {
        console.log(`⏸️ ${apiName} in cooldown for ${Math.round((this.cooldownPeriod - (now - api.lastCall)) / 1000)}s`);
        return false;
      } else {
        // Reset failures after cooldown
        api.failures = 0;
        console.log(`🔄 ${apiName} cooldown ended, resetting failures`);
      }
    }
    
    // Check rate limit
    if (now - api.lastCall < api.minInterval) {
      console.log(`⏱️ ${apiName} rate limited, waiting ${api.minInterval - (now - api.lastCall)}ms`);
      return false;
    }
    
    return true;
  }

  markAPICall(apiName, success = true) {
    const api = this.rateLimits[apiName];
    api.lastCall = Date.now();
    
    if (success) {
      api.failures = Math.max(0, api.failures - 1); // Reduce failures on success
    } else {
      api.failures += 1;
      console.log(`❌ ${apiName} failure count: ${api.failures}/${this.maxFailures}`);
    }
  }

  async fetchFromCoinGecko(symbols) {
    if (!this.canUseAPI('coinGecko')) return null;
    try {
      console.log('🦎 Attempting CoinGecko...');
      const coinGeckoIds = this.symbolsToCoinGeckoIds(symbols);
      if (coinGeckoIds.length === 0) return null;
      const response = await retryWithBackoff(() => axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: coinGeckoIds.join(','),
          vs_currencies: 'usd',
          include_24hr_change: true
        },
        timeout: 10000
      }), 4, 1000, 2);
      this.markAPICall('coinGecko', true);
      console.log('✅ CoinGecko success');
      return this.formatCoinGeckoResponse(response.data, symbols);
    } catch (error) {
      this.markAPICall('coinGecko', false);
      console.log(`❌ CoinGecko failed: ${error.response?.status} - ${error.message}`);
      return null;
    }
  }

  async fetchFromBinance(symbols) {
    if (!this.canUseAPI('binance')) return null;
    try {
      console.log('🟡 Attempting Binance...');
      const binanceSymbols = symbols.filter(s => s.includes('USDT') || s.includes('BTC'));
      if (binanceSymbols.length === 0) return null;
      const promises = binanceSymbols.map(symbol => 
        retryWithBackoff(() => axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { timeout: 5000 }), 4, 1000, 2)
      );
      const responses = await Promise.allSettled(promises);
      this.markAPICall('binance', true);
      console.log('✅ Binance success');
      const prices = {};
      responses.forEach((response, index) => {
        if (response.status === 'fulfilled') {
          const data = response.value.data;
          prices[binanceSymbols[index]] = {
            price: parseFloat(data.lastPrice),
            change24h: parseFloat(data.priceChangePercent)
          };
        }
      });
      return prices;
    } catch (error) {
      this.markAPICall('binance', false);
      console.log(`❌ Binance failed: ${error.message}`);
      return null;
    }
  }

  async fetchFromAlphaVantage(symbols) {
    if (!this.canUseAPI('alphaVantage') || !process.env.ALPHA_VANTAGE_API_KEY) return null;
    
    try {
      console.log('📈 Attempting Alpha Vantage...');
      
      // Alpha Vantage is better for forex and stocks
      const forexStockSymbols = symbols.filter(s => 
        s.includes('USD') && s.length === 6 || // Forex pairs
        /^[A-Z]{1,5}$/.test(s) // Stock symbols
      );
      
      if (forexStockSymbols.length === 0) return null;
      
      const prices = {};
      
      // Process one symbol at a time due to rate limits
      for (const symbol of forexStockSymbols.slice(0, 2)) { // Limit to 2 to avoid rate limits
        try {
          let url, params;
          
          if (symbol.length === 6) { // Forex
            url = 'https://www.alphavantage.co/query';
            params = {
              function: 'FX_DAILY',
              from_symbol: symbol.slice(0, 3),
              to_symbol: symbol.slice(3, 6),
              apikey: process.env.ALPHA_VANTAGE_API_KEY
            };
          } else { // Stock
            url = 'https://www.alphavantage.co/query';
            params = {
              function: 'GLOBAL_QUOTE',
              symbol: symbol,
              apikey: process.env.ALPHA_VANTAGE_API_KEY
            };
          }
          
          const response = await axios.get(url, { params, timeout: 10000 });
          
          if (response.data['Error Message'] || response.data['Note']) {
            console.log(`⚠️ Alpha Vantage API limit or error for ${symbol}`);
            break;
          }
          
          // Parse response based on type
          if (symbol.length === 6) { // Forex
            const timeSeries = response.data['Time Series FX (Daily)'];
            if (timeSeries) {
              const latestDate = Object.keys(timeSeries)[0];
              const latestData = timeSeries[latestDate];
              prices[symbol] = {
                price: parseFloat(latestData['4. close']),
                change24h: 0 // Calculate if needed
              };
            }
          } else { // Stock
            const quote = response.data['Global Quote'];
            if (quote) {
              prices[symbol] = {
                price: parseFloat(quote['05. price']),
                change24h: parseFloat(quote['10. change percent'].replace('%', ''))
              };
            }
          }
          
          // Wait between calls
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (symbolError) {
          console.log(`❌ Alpha Vantage error for ${symbol}:`, symbolError.message);
        }
      }
      
      this.markAPICall('alphaVantage', true);
      console.log('✅ Alpha Vantage success');
      return prices;
    } catch (error) {
      this.markAPICall('alphaVantage', false);
      console.log(`❌ Alpha Vantage failed: ${error.message}`);
      return null;
    }
  }

  async fetchFromTwelveData(symbols) {
    if (!this.canUseAPI('twelveData') || !process.env.TWELVE_DATA_API_KEY) return null;
    
    try {
      console.log('📊 Attempting Twelve Data...');
      
      const prices = {};
      
      // Process symbols in batches
      for (const symbol of symbols.slice(0, 3)) { // Limit to avoid rate limits
        try {
          const response = await axios.get('https://api.twelvedata.com/price', {
            params: {
              symbol: symbol,
              apikey: process.env.TWELVE_DATA_API_KEY
            },
            timeout: 10000
          });
          
          if (response.data.price) {
            prices[symbol] = {
              price: parseFloat(response.data.price),
              change24h: 0 // Would need additional call for change
            };
          }
          
          // Wait between calls
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (symbolError) {
          console.log(`❌ Twelve Data error for ${symbol}:`, symbolError.message);
        }
      }
      
      this.markAPICall('twelveData', true);
      console.log('✅ Twelve Data success');
      return prices;
    } catch (error) {
      this.markAPICall('twelveData', false);
      console.log(`❌ Twelve Data failed: ${error.message}`);
      return null;
    }
  }

  async fetchPrices(symbols) {
    console.log(`🔍 Fetching prices for: ${symbols.join(', ')}`);
    
    const apis = [
      { name: 'CoinGecko', fn: () => this.fetchFromCoinGecko(symbols) },
      { name: 'Binance', fn: () => this.fetchFromBinance(symbols) },
      { name: 'Alpha Vantage', fn: () => this.fetchFromAlphaVantage(symbols) },
      { name: 'Twelve Data', fn: () => this.fetchFromTwelveData(symbols) }
    ];
    
    let combinedPrices = {};
    let successfulAPIs = 0;
    
    for (const api of apis) {
      try {
        const prices = await api.fn();
        if (prices && Object.keys(prices).length > 0) {
          combinedPrices = { ...combinedPrices, ...prices };
          successfulAPIs++;
          console.log(`✅ ${api.name} contributed ${Object.keys(prices).length} prices`);
          
          // If we have prices for all symbols, we can stop
          if (Object.keys(combinedPrices).length >= symbols.length) {
            break;
          }
        }
      } catch (error) {
        console.log(`❌ ${api.name} failed:`, error.message);
      }
    }
    
    console.log(`📊 Final result: ${Object.keys(combinedPrices).length}/${symbols.length} prices from ${successfulAPIs} APIs`);
    return combinedPrices;
  }

  symbolsToCoinGeckoIds(symbols) {
    const mapping = {
      'BTCUSD': 'bitcoin',
      'BTCUSDT': 'bitcoin',
      'ETHUSD': 'ethereum',
      'ETHUSDT': 'ethereum',
      'ADAUSDT': 'cardano',
      'DOTUSDT': 'polkadot',
      'LINKUSDT': 'chainlink',
      'LTCUSDT': 'litecoin',
      'XRPUSDT': 'ripple'
    };
    
    return symbols.map(s => mapping[s]).filter(Boolean);
  }

  formatCoinGeckoResponse(data, originalSymbols) {
    const mapping = {
      'bitcoin': ['BTCUSD', 'BTCUSDT'],
      'ethereum': ['ETHUSD', 'ETHUSDT'],
      'cardano': ['ADAUSDT'],
      'polkadot': ['DOTUSDT'],
      'chainlink': ['LINKUSDT'],
      'litecoin': ['LTCUSDT'],
      'ripple': ['XRPUSDT']
    };
    
    const prices = {};
    
    Object.entries(data).forEach(([coinId, priceData]) => {
      const symbols = mapping[coinId] || [];
      symbols.forEach(symbol => {
        if (originalSymbols.includes(symbol)) {
          prices[symbol] = {
            price: priceData.usd,
            change24h: priceData.usd_24h_change || 0
          };
        }
      });
    });
    
    return prices;
  }

  getAPIStatus() {
    const now = Date.now();
    const status = {};
    
    Object.entries(this.rateLimits).forEach(([apiName, api]) => {
      const isInCooldown = api.failures >= this.maxFailures && (now - api.lastCall < this.cooldownPeriod);
      const nextAvailable = Math.max(0, api.minInterval - (now - api.lastCall));
      
      status[apiName] = {
        available: !isInCooldown && nextAvailable === 0,
        failures: api.failures,
        maxFailures: this.maxFailures,
        inCooldown: isInCooldown,
        nextAvailableIn: nextAvailable,
        cooldownEndsIn: isInCooldown ? this.cooldownPeriod - (now - api.lastCall) : 0
      };
    });
    
    return status;
  }
}

module.exports = new PriceService();