const priceService = require('./priceService');

class MarketService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds cache
  }

  async updatePrices() {
    try {
      console.log('🔄 Starting price update cycle...');
      
      // Get symbols from your database or config
      const symbols = [
        'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT',
        'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD',
        'AAPL', 'GOOGL', 'MSFT', 'TSLA'
      ];
      
      const prices = await priceService.fetchPrices(symbols);
      
      if (Object.keys(prices).length > 0) {
        // Update your database with new prices
        await this.savePricesToDatabase(prices);
        
        // Update cache
        Object.entries(prices).forEach(([symbol, data]) => {
          this.cache.set(symbol, {
            ...data,
            timestamp: Date.now()
          });
        });
        
        console.log(`✅ Updated ${Object.keys(prices).length} prices successfully`);
        
        // Log API status for monitoring
        const apiStatus = priceService.getAPIStatus();
        console.log('📊 API Status:', JSON.stringify(apiStatus, null, 2));
        
        return prices;
      } else {
        console.log('⚠️ No prices fetched from any API');
        return {};
      }
    } catch (error) {
      console.error('❌ Price update failed:', error.message);
      return {};
    }
  }

  async savePricesToDatabase(prices) {
    try {
      // Update your existing price saving logic here
      // This should update your MongoDB collections
      
      const MarketData = require('../models/MarketData'); // Adjust path as needed
      
      const updates = Object.entries(prices).map(([symbol, data]) => ({
        updateOne: {
          filter: { symbol },
          update: {
            $set: {
              symbol,
              price: data.price,
              change24h: data.change24h,
              lastUpdated: new Date()
            }
          },
          upsert: true
        }
      }));
      
      if (updates.length > 0) {
        await MarketData.bulkWrite(updates);
        console.log(`💾 Saved ${updates.length} prices to database`);
      }
    } catch (error) {
      console.error('❌ Failed to save prices to database:', error.message);
    }
  }

  getCachedPrice(symbol) {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached;
    }
    return null;
  }

  async getPrice(symbol) {
    // Try cache first
    const cached = this.getCachedPrice(symbol);
    if (cached) {
      return cached;
    }
    
    // Fetch fresh data
    const prices = await priceService.fetchPrices([symbol]);
    return prices[symbol] || null;
  }
}

module.exports = new MarketService();