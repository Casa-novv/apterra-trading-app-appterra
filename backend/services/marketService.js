const axios = require('axios');

class MarketService {
  constructor() {
    this.lastUpdate = null;
    this.prices = {};
    this.isUpdating = false;
  }

  async updatePrices() {
    if (this.isUpdating) {
      return this.prices;
    }

    this.isUpdating = true;
    
    try {
      console.log('📊 Updating market prices...');
      
      // Fetch basic crypto prices
      const cryptoResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd', {
        timeout: 10000
      });
      
      const cryptoData = cryptoResponse.data;
      
      // Update prices
      if (cryptoData.bitcoin) this.prices.BTC = cryptoData.bitcoin.usd;
      if (cryptoData.ethereum) this.prices.ETH = cryptoData.ethereum.usd;
      if (cryptoData.solana) this.prices.SOL = cryptoData.solana.usd;
      
      // Add some mock forex and stock prices for demo
      this.prices.EURUSD = 1.0850 + (Math.random() - 0.5) * 0.01;
      this.prices.GBPUSD = 1.2650 + (Math.random() - 0.5) * 0.01;
      this.prices.USDJPY = 148.50 + (Math.random() - 0.5) * 1;
      this.prices.AAPL = 175.00 + (Math.random() - 0.5) * 2;
      this.prices.GOOGL = 140.00 + (Math.random() - 0.5) * 2;
      this.prices.TSLA = 240.00 + (Math.random() - 0.5) * 5;
      
      this.lastUpdate = new Date();
      console.log('✅ Market prices updated successfully');
      
      return this.prices;
    } catch (error) {
      console.error('❌ Error updating market prices:', error.message);
      return this.prices;
    } finally {
      this.isUpdating = false;
    }
  }

  getPrices() {
    return this.prices;
  }

  getLastUpdate() {
    return this.lastUpdate;
  }

  async getPrice(symbol) {
    if (!this.lastUpdate || Date.now() - this.lastUpdate.getTime() > 60000) {
      await this.updatePrices();
    }
    return this.prices[symbol] || null;
  }
}

module.exports = new MarketService(); 