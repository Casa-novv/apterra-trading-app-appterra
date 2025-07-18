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

class CommoditiesService {
  constructor() {
    this.metalsPriceAPI = 'https://api.metals.live/v1/spot';
    this.oilPriceAPI = 'https://api.oilpriceapi.com/v1/prices/latest';
  }

  async getCommodityPrice(symbol) {
    try {
      // Handle different commodity symbols
      switch (symbol.toUpperCase()) {
        case 'GOLD':
        case 'XAU':
          return await this.getGoldPrice();
        case 'SILVER':
        case 'XAG':
          return await this.getSilverPrice();
        case 'OIL':
        case 'WTI':
        case 'CRUDE':
          return await this.getOilPrice();
        case 'COPPER':
          return await this.getCopperPrice();
        default:
          throw new Error(`Unsupported commodity: ${symbol}`);
      }
    } catch (error) {
      console.warn(`⚠️ Commodity API failed for ${symbol}: ${error.message}`);
      return this.getFallbackPrice(symbol);
    }
  }

  async getGoldPrice() {
    try {
      const response = await retryWithBackoff(() => axios.get(`${this.metalsPriceAPI}/gold`, { timeout: 8000 }), 4, 1000, 2);
      return {
        price: response.data.price,
        source: 'metals.live'
      };
    } catch (error) {
      // Fallback to Yahoo Finance
      const response = await retryWithBackoff(() => axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F', { timeout: 8000 }), 4, 1000, 2);
      const price = response.data.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price) {
        return { price, source: 'yahoo' };
      }
      throw error;
    }
  }

  async getSilverPrice() {
    try {
      const response = await retryWithBackoff(() => axios.get(`${this.metalsPriceAPI}/silver`, { timeout: 8000 }), 4, 1000, 2);
      return {
        price: response.data.price,
        source: 'metals.live'
      };
    } catch (error) {
      const response = await retryWithBackoff(() => axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=SI=F', { timeout: 8000 }), 4, 1000, 2);
      const price = response.data.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price) {
        return { price, source: 'yahoo' };
      }
      throw error;
    }
  }

  async getOilPrice() {
    try {
      const response = await retryWithBackoff(() => axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=CL=F', { timeout: 8000 }), 4, 1000, 2);
      const price = response.data.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price) {
        return { price, source: 'yahoo' };
      }
      throw new Error('Oil price not available');
    } catch (error) {
      throw error;
    }
  }

  async getCopperPrice() {
    try {
      const response = await retryWithBackoff(() => axios.get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=HG=F', { timeout: 8000 }), 4, 1000, 2);
      const price = response.data.quoteResponse?.result?.[0]?.regularMarketPrice;
      if (price) {
        return { price, source: 'yahoo' };
      }
      throw new Error('Copper price not available');
    } catch (error) {
      throw error;
    }
  }

  getFallbackPrice(symbol) {
    // Static fallback prices (you should update these periodically)
    const fallbackPrices = {
      'GOLD': 2650.00,
      'SILVER': 31.50,
      'OIL': 68.50,
      'COPPER': 4.15
    };

    const price = fallbackPrices[symbol.toUpperCase()];
    if (price) {
      console.log(`📊 Using fallback price for ${symbol}: ${price}`);
      return { price, source: 'fallback' };
    }

    throw new Error(`No fallback price for ${symbol}`);
  }
}

module.exports = new CommoditiesService();