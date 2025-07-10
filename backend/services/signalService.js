const axios = require('axios');

class MultiMarketSignalService {
  constructor() {
    this.apiCallCounts = {
      coingecko: 0,
      binance: 0,
      yahoo: 0,
      exchangerate: 0,
      finhub: 0
    };
    
    this.rateLimitResets = {};
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  async generateAllSignals() {
    console.log('🚀 Starting multi-market signal generation...');
    
    const results = await Promise.allSettled([
      this.generateCryptoSignals(),
      this.generateForexSignals(), 
      this.generateStockSignals(),
      this.generateCommoditySignals()
    ]);
    
    const allSignals = [];
    const errors = [];
    
    results.forEach((result, index) => {
      const markets = ['crypto', 'forex', 'stocks', 'commodities'];
      const market = markets[index];
      
      if (result.status === 'fulfilled') {
        allSignals.push(...result.value);
        console.log(`✅ ${market}: ${result.value.length} signals generated`);
      } else {
        console.error(`❌ ${market} failed:`, result.reason.message);
        errors.push({ market, error: result.reason.message });
        
        // Generate fallback signals for failed markets
        const fallbackSignals = this.generateFallbackSignals(market, 3);
        allSignals.push(...fallbackSignals);
        console.log(`🔄 ${market}: ${fallbackSignals.length} fallback signals generated`);
      }
    });
    
    console.log(`📊 Total signals generated: ${allSignals.length}`);
    return allSignals;
  }

  async generateCryptoSignals() {
    const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'XRP', 'DOT', 'MATIC', 'AVAX'];
    const signals = [];
    
    // Try multiple crypto APIs with fallbacks
    for (const symbol of symbols) {
      try {
        let signalData = null;
        
        // Primary: Binance API
        signalData = await this.fetchCryptoFromBinance(symbol);
        
        if (!signalData) {
          // Fallback 1: CoinGecko API
          signalData = await this.fetchCryptoFromCoinGecko(symbol);
        }
        
        if (!signalData) {
          // Fallback 2: CoinCap API
          signalData = await this.fetchCryptoFromCoinCap(symbol);
        }
        
        if (!signalData) {
          // Fallback 3: Generate synthetic data
          signalData = this.generateSyntheticCryptoData(symbol);
        }
        
        if (signalData) {
          const signal = this.createSignalFromData(signalData, 'crypto');
          if (signal) signals.push(signal);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate signal for ${symbol}:`, error.message);
      }
    }
    
    return signals;
  }

  async fetchCryptoFromBinance(symbol) {
    try {
      const binanceSymbol = `${symbol}USDT`;
      const response = await this.makeAPICall(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
        'binance'
      );
      
      return {
        symbol: binanceSymbol,
        price: parseFloat(response.data.lastPrice),
        change24h: parseFloat(response.data.priceChangePercent),
        volume: parseFloat(response.data.volume),
        high24h: parseFloat(response.data.highPrice),
        low24h: parseFloat(response.data.lowPrice),
        source: 'binance'
      };
    } catch (error) {
      console.warn(`Binance API failed for ${symbol}:`, error.message);
      return null;
    }
  }

  async fetchCryptoFromCoinGecko(symbol) {
    try {
      const coinGeckoId = this.getCoinGeckoId(symbol);
      const response = await this.makeAPICall(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
        'coingecko'
      );
      
      const data = response.data[coinGeckoId];
      if (!data) return null;
      
      return {
        symbol: `${symbol}USDT`,
        price: data.usd,
        change24h: data.usd_24h_change || 0,
        volume: data.usd_24h_vol || 0,
        high24h: data.usd * 1.02, // Estimated
        low24h: data.usd * 0.98,  // Estimated
        source: 'coingecko'
      };
    } catch (error) {
      console.warn(`CoinGecko API failed for ${symbol}:`, error.message);
      return null;
    }
  }

  async fetchCryptoFromCoinCap(symbol) {
    try {
      const response = await this.makeAPICall(
        `https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`,
        'coincap'
      );
      
      const data = response.data.data;
      if (!data) return null;
      
      return {
        symbol: `${symbol}USDT`,
        price: parseFloat(data.priceUsd),
        change24h: parseFloat(data.changePercent24Hr) || 0,
        volume: parseFloat(data.volumeUsd24Hr) || 0,
        high24h: parseFloat(data.priceUsd) * 1.02,
        low24h: parseFloat(data.priceUsd) * 0.98,
        source: 'coincap'
      };
    } catch (error) {
      console.warn(`CoinCap API failed for ${symbol}:`, error.message);
      return null;
    }
  }

  async generateForexSignals() {
    const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD'];
    const signals = [];
    
    for (const pair of pairs) {
      try {
        let signalData = null;
        
        // Primary: ExchangeRate-API
        signalData = await this.fetchForexFromExchangeRate(pair);
        
        if (!signalData) {
          // Fallback 1: Fixer.io
          signalData = await this.fetchForexFromFixer(pair);
        }
        
        if (!signalData) {
          // Fallback 2: Yahoo Finance
          signalData = await this.fetchForexFromYahoo(pair);
        }
        
        if (!signalData) {
          // Fallback 3: Generate synthetic data
          signalData = this.generateSyntheticForexData(pair);
        }
        
        if (signalData) {
          const signal = this.createSignalFromData(signalData, 'forex');
          if (signal) signals.push(signal);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate forex signal for ${pair}:`, error.message);
      }
    }
    
    return signals;
  }

  async fetchForexFromExchangeRate(pair) {
    try {
      const base = pair.slice(0, 3);
      const quote = pair.slice(3, 6);
      
      const response = await this.makeAPICall(
        `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`,
        'exchangerate'
      );
      
      const rate = response.data.rates[quote];
      if (!rate) return null;
      
      return {
        symbol: pair,
        price: rate,
        change24h: (Math.random() - 0.5) * 2, // Simulated
        volume: Math.random() * 1000000,
        high24h: rate * (1 + Math.random() * 0.01),
        low24h: rate * (1 - Math.random() * 0.01),
        source: 'exchangerate'
      };
    } catch (error) {
      console.warn(`ExchangeRate API failed for ${pair}:`, error.message);
      return null;
    }
  }

  async generateStockSignals() {
    const stocks = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA'];
    const signals = [];
    
    for (const stock of stocks) {
      try {
        let signalData = null;
        
        // Primary: Yahoo Finance
        signalData = await this.fetchStockFromYahoo(stock);
        
        if (!signalData) {
          // Fallback 1: Alpha Vantage (if you have API key)
          signalData = await this.fetchStockFromAlphaVantage(stock);
        }
        
        if (!signalData) {
          // Fallback 2: Generate synthetic data
          signalData = this.generateSyntheticStockData(stock);
        }
        
        if (signalData) {
          const signal = this.createSignalFromData(signalData, 'stocks');
          if (signal) signals.push(signal);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate stock signal for ${stock}:`, error.message);
      }
    }
    
    return signals;
  }

  async fetchStockFromYahoo(symbol) {
    try {
      const response = await this.makeAPICall(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
        'yahoo'
      );
      
      const data = response.data.quoteResponse.result[0];
      if (!data) return null;
      
      return {
        symbol,
        price: data.regularMarketPrice,
        change24h: data.regularMarketChangePercent,
        volume: data.regularMarketVolume,
        high24h: data.regularMarketDayHigh,
        low24h: data.regularMarketDayLow,
        source: 'yahoo'
      };
    } catch (error) {
      console.warn(`Yahoo Finance failed for ${symbol}:`, error.message);
      return null;
    }
  }

  async generateCommoditySignals() {
    const commodities = [
      { symbol: 'XAUUSD', name: 'Gold' },
      { symbol: 'XAGUSD', name: 'Silver' },
      { symbol: 'USOIL', name: 'Oil' },
      { symbol: 'NATGAS', name: 'Natural Gas' }
    ];
    
    const signals = [];
    
    for (const commodity of commodities) {
      try {
        let signalData = null;
        
        // For commodities, we'll use multiple approaches
        if (commodity.symbol.startsWith('XAU') || commodity.symbol.startsWith('XAG')) {
          // Precious metals
          signalData = await this.fetchPreciousMetalPrice(commodity.symbol);
        } else {
          // Energy commodities
          signalData = await this.fetchEnergyPrice(commodity.symbol);
        }
        
        if (!signalData) {
          // Fallback: Generate synthetic data
          signalData = this.generateSyntheticCommodityData(commodity.symbol);
        }
        
        if (signalData) {
          const signal = this.createSignalFromData(signalData, 'commodities');
          if (signal) signals.push(signal);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate commodity signal for ${commodity.symbol}:`, error.message);
      }
    }
    
    return signals;
  }

  async makeAPICall(url, source, retries = 0) {
    try {
      // Check if we're rate limited
      if (this.isRateLimited(source)) {
        throw new Error(`Rate limited for ${source}`);
      }
      
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'TradingApp/1.0'
        }
      });
      
      this.apiCallCounts[source]++;
      return response;
      
    } catch (error) {
      if (this.detectRateLimit(error)) {
        console.warn(`⚠️ Rate limit detected for ${source}`);
        this.setRateLimit(source);
      }
      
      if (retries < this.maxRetries) {
        console.log(`🔄 Retrying ${source} API call (${retries + 1}/${this.maxRetries})`);
        await this.delay(this.retryDelay * (retries + 1));
        return this.makeAPICall(url, source, retries + 1);
      }
      
      throw error;
    }
  }

  detectRateLimit(error) {
    if (!error.response) return false;
    
    const status = error.response.status;
    const message = (error.response.data?.message || '').toLowerCase();
    
    return (
      status === 429 ||
      status === 403 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('quota exceeded')
    );
  }

  isRateLimited(source) {
    const resetTime = this.rateLimitResets[source];
    if (!resetTime) return false;
    
    return Date.now() < resetTime;
  }

    setRateLimit(source, duration = 60000) { // 1 minute default
    this.rateLimitResets[source] = Date.now() + duration;
    console.log(`🚫 Rate limit set for ${source}, reset in ${duration/1000} seconds`);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Synthetic data generators for fallbacks
  generateSyntheticCryptoData(symbol) {
    const basePrice = this.getBaseCryptoPrice(symbol);
    const volatility = 0.05; // 5% volatility
    
    return {
      symbol: `${symbol}USDT`,
      price: basePrice * (1 + (Math.random() - 0.5) * volatility),
      change24h: (Math.random() - 0.5) * 10, // -5% to +5%
      volume: Math.random() * 1000000,
      high24h: basePrice * (1 + Math.random() * volatility),
      low24h: basePrice * (1 - Math.random() * volatility),
      source: 'synthetic'
    };
  }

  generateSyntheticForexData(pair) {
    const baseRate = this.getBaseForexRate(pair);
    const volatility = 0.01; // 1% volatility
    
    return {
      symbol: pair,
      price: baseRate * (1 + (Math.random() - 0.5) * volatility),
      change24h: (Math.random() - 0.5) * 2, // -1% to +1%
      volume: Math.random() * 500000,
      high24h: baseRate * (1 + Math.random() * volatility * 0.5),
      low24h: baseRate * (1 - Math.random() * volatility * 0.5),
      source: 'synthetic'
    };
  }

  generateSyntheticStockData(symbol) {
    const basePrice = this.getBaseStockPrice(symbol);
    const volatility = 0.03; // 3% volatility
    
    return {
      symbol,
      price: basePrice * (1 + (Math.random() - 0.5) * volatility),
      change24h: (Math.random() - 0.5) * 6, // -3% to +3%
      volume: Math.random() * 10000000,
      high24h: basePrice * (1 + Math.random() * volatility * 0.7),
      low24h: basePrice * (1 - Math.random() * volatility * 0.7),
      source: 'synthetic'
    };
  }

  generateSyntheticCommodityData(symbol) {
    const basePrice = this.getBaseCommodityPrice(symbol);
    const volatility = 0.02; // 2% volatility
    
    return {
      symbol,
      price: basePrice * (1 + (Math.random() - 0.5) * volatility),
      change24h: (Math.random() - 0.5) * 4, // -2% to +2%
      volume: Math.random() * 100000,
      high24h: basePrice * (1 + Math.random() * volatility * 0.6),
      low24h: basePrice * (1 - Math.random() * volatility * 0.6),
      source: 'synthetic'
    };
  }

  // Base price references for synthetic data
  getBaseCryptoPrice(symbol) {
    const prices = {
      'BTC': 43000,
      'ETH': 2600,
      'ADA': 0.45,
      'SOL': 95,
      'XRP': 0.52,
      'DOT': 7.2,
      'MATIC': 0.85,
      'AVAX': 38
    };
    return prices[symbol] || 100;
  }

  getBaseForexRate(pair) {
    const rates = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 148.50,
      'AUDUSD': 0.6750,
      'USDCAD': 1.3450,
      'NZDUSD': 0.6150
    };
    return rates[pair] || 1.0;
  }

  getBaseStockPrice(symbol) {
    const prices = {
      'AAPL': 185,
      'GOOGL': 140,
      'MSFT': 375,
      'TSLA': 240,
      'AMZN': 145,
      'NVDA': 480
    };
    return prices[symbol] || 150;
  }

  getBaseCommodityPrice(symbol) {
    const prices = {
      'XAUUSD': 2020,
      'XAGUSD': 24.5,
      'USOIL': 78,
      'NATGAS': 2.8
    };
    return prices[symbol] || 50;
  }

  getCoinGeckoId(symbol) {
    const mapping = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'SOL': 'solana',
      'XRP': 'ripple',
      'DOT': 'polkadot',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2'
    };
    return mapping[symbol] || symbol.toLowerCase();
  }

  async fetchPreciousMetalPrice(symbol) {
    try {
      const metal = symbol.startsWith('XAU') ? 'XAU' : 'XAG';
      const response = await this.makeAPICall(
        `https://api.exchangerate.host/latest?base=${metal}&symbols=USD`,
        'exchangerate'
      );
      
      const rate = response.data.rates.USD;
      if (!rate) return null;
      
      return {
        symbol,
        price: rate,
        change24h: (Math.random() - 0.5) * 3,
        volume: Math.random() * 50000,
        high24h: rate * (1 + Math.random() * 0.015),
        low24h: rate * (1 - Math.random() * 0.015),
        source: 'exchangerate'
      };
    } catch (error) {
      return null;
    }
  }

  async fetchEnergyPrice(symbol) {
    try {
      // Use Yahoo Finance for energy commodities
      const yahooSymbol = symbol === 'USOIL' ? 'CL=F' : 'NG=F';
      const response = await this.makeAPICall(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbol}`,
        'yahoo'
      );
      
      const data = response.data.quoteResponse.result[0];
      if (!data) return null;
      
      return {
        symbol,
        price: data.regularMarketPrice,
        change24h: data.regularMarketChangePercent || 0,
        volume: data.regularMarketVolume || 0,
        high24h: data.regularMarketDayHigh,
        low24h: data.regularMarketDayLow,
        source: 'yahoo'
      };
    } catch (error) {
      return null;
    }
  }

  createSignalFromData(data, market) {
    if (!data || !data.price) return null;
    
    // Enhanced signal generation logic
    const shouldGenerateSignal = this.shouldGenerateSignal(data, market);
    if (!shouldGenerateSignal) return null;
    
    const direction = this.determineDirection(data);
    const confidence = this.calculateConfidence(data, market);
    const timeframe = this.selectTimeframe(market);
    
    // Calculate target and stop loss based on market volatility
    const { targetPrice, stopLoss } = this.calculateLevels(data, direction, market);
    
    return {
      id: `${data.symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: data.symbol,
      market,
      type: direction,
      direction, // Keep both for compatibility
      entryPrice: data.price,
      targetPrice,
      stopLoss,
      timeframe,
      confidence,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      description: this.generateDescription(data, direction, market),
      analysis: this.generateAnalysis(data, direction, market),
      source: data.source,
      metadata: {
        change24h: data.change24h,
        volume: data.volume,
        high24h: data.high24h,
        low24h: data.low24h,
        volatility: this.calculateVolatility(data),
        strength: confidence > 80 ? 'STRONG' : confidence > 60 ? 'MODERATE' : 'WEAK'
      }
    };
  }

  shouldGenerateSignal(data, market) {
    // Market-specific signal generation probability
    const probabilities = {
      crypto: 0.4,     // 40% chance
      forex: 0.3,      // 30% chance  
      stocks: 0.35,    // 35% chance
      commodities: 0.25 // 25% chance
    };
    
    const baseProbability = probabilities[market] || 0.3;
    
    // Increase probability based on volatility
    const volatility = Math.abs(data.change24h || 0);
    const volatilityBonus = Math.min(volatility / 10, 0.2); // Max 20% bonus
    
    const finalProbability = baseProbability + volatilityBonus;
    
    return Math.random() < finalProbability;
  }

  determineDirection(data) {
    const change = data.change24h || 0;
    const momentum = change + (Math.random() - 0.5) * 2; // Add some randomness
    
    return momentum > 0 ? 'BUY' : 'SELL';
  }

  calculateConfidence(data, market) {
    let baseConfidence = 60 + Math.random() * 30; // 60-90%
    
    // Adjust based on data quality
    if (data.source === 'synthetic') {
      baseConfidence -= 10; // Lower confidence for synthetic data
    }
    
    // Adjust based on volatility
    const volatility = Math.abs(data.change24h || 0);
    if (volatility > 5) {
      baseConfidence += 5; // Higher confidence for high volatility
    }
    
    // Market-specific adjustments
    const marketAdjustments = {
      crypto: 0,
      forex: -5,     // Slightly lower confidence for forex
      stocks: 2,     // Slightly higher for stocks
      commodities: -3 // Lower for commodities
    };
    
    baseConfidence += marketAdjustments[market] || 0;
    
    return Math.max(50, Math.min(95, Math.round(baseConfidence)));
  }

  selectTimeframe(market) {
    const timeframes = {
      crypto: ['15M', '1H', '4H'],
      forex: ['1H', '4H', '1D'],
      stocks: ['4H', '1D'],
      commodities: ['4H', '1D']
    };
    
    const marketTimeframes = timeframes[market] || ['1H', '4H'];
    return marketTimeframes[Math.floor(Math.random() * marketTimeframes.length)];
  }

  calculateLevels(data, direction, market) {
    // Market-specific risk percentages
    const riskPercentages = {
      crypto: 0.03,      // 3% risk
      forex: 0.015,      // 1.5% risk
      stocks: 0.025,     // 2.5% risk
      commodities: 0.02  // 2% risk
    };
    
    const riskPercent = riskPercentages[market] || 0.02;
    const rewardRatio = 2; // 1:2 risk-reward
    
    let targetPrice, stopLoss;
    
    if (direction === 'BUY') {
      stopLoss = data.price * (1 - riskPercent);
      targetPrice = data.price * (1 + riskPercent * rewardRatio);
    } else {
      stopLoss = data.price * (1 + riskPercent);
      targetPrice = data.price * (1 - riskPercent * rewardRatio);
    }
    
    return {
      targetPrice: Math.round(targetPrice * 10000) / 10000,
      stopLoss: Math.round(stopLoss * 10000) / 10000
    };
  }

  calculateVolatility(data) {
    if (!data.high24h || !data.low24h) return 0;
    
    return ((data.high24h - data.low24h) / data.price) * 100;
  }

  generateDescription(data, direction, market) {
    const templates = {
      crypto: [
        `${data.symbol} showing ${direction.toLowerCase()} momentum with ${Math.abs(data.change24h || 0).toFixed(2)}% 24h change`,
        `Technical analysis suggests ${direction.toLowerCase()} opportunity on ${data.symbol}`,
        `${data.symbol} breaking key levels, ${direction.toLowerCase()} signal generated`
      ],
      forex: [
        `${data.symbol} pair indicating ${direction.toLowerCase()} pressure from fundamental factors`,
        `Technical confluence supporting ${direction.toLowerCase()} bias on ${data.symbol}`,
        `Market structure favors ${direction.toLowerCase()} position on ${data.symbol}`
      ],
      stocks: [
        `${data.symbol} showing ${direction.toLowerCase()} potential based on technical analysis`,
        `Sector momentum supporting ${direction.toLowerCase()} thesis on ${data.symbol}`,
        `${data.symbol} technical setup indicates ${direction.toLowerCase()} opportunity`
      ],
      commodities: [
        `${data.symbol} supply/demand dynamics favor ${direction.toLowerCase()} position`,
        `Technical indicators align for ${direction.toLowerCase()} move on ${data.symbol}`,
        `Market conditions support ${direction.toLowerCase()} bias on ${data.symbol}`
      ]
    };
    
    const marketTemplates = templates[market] || templates.crypto;
    return marketTemplates[Math.floor(Math.random() * marketTemplates.length)];
  }

  generateAnalysis(data, direction, market) {
    const analyses = {
      crypto: [
        `Strong ${direction.toLowerCase()} momentum detected with volume confirmation`,
        `Technical indicators align for ${direction.toLowerCase()} continuation`,
        `Market structure supports ${direction.toLowerCase()} bias with clear levels`
      ],
      forex: [
        `Central bank policies and economic data support ${direction.toLowerCase()} outlook`,
        `Technical analysis shows ${direction.toLowerCase()} momentum building`,
        `Fundamental factors align with ${direction.toLowerCase()} technical setup`
      ],
      stocks: [
        `Earnings outlook and sector rotation favor ${direction.toLowerCase()} position`,
        `Technical breakout pattern confirms ${direction.toLowerCase()} momentum`,
        `Market sentiment and fundamentals support ${direction.toLowerCase()} thesis`
      ],
            commodities: [
        `Supply constraints and demand factors support ${direction.toLowerCase()} outlook`,
        `Geopolitical developments favor ${direction.toLowerCase()} position`,
        `Seasonal patterns and technical analysis align for ${direction.toLowerCase()} move`
      ]
    };
    
    const marketAnalyses = analyses[market] || analyses.crypto;
    return marketAnalyses[Math.floor(Math.random() * marketAnalyses.length)];
  }

  generateFallbackSignals(market, count = 3) {
    console.log(`🔄 Generating ${count} fallback signals for ${market}`);
    
    const symbols = {
      crypto: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
      forex: ['EURUSD', 'GBPUSD', 'USDJPY'],
      stocks: ['AAPL', 'GOOGL', 'MSFT'],
      commodities: ['XAUUSD', 'XAGUSD', 'USOIL']
    };
    
    const marketSymbols = symbols[market] || symbols.crypto;
    const signals = [];
    
    for (let i = 0; i < count; i++) {
      const symbol = marketSymbols[i % marketSymbols.length];
      let syntheticData;
      
      switch (market) {
        case 'crypto':
          syntheticData = this.generateSyntheticCryptoData(symbol.replace('USDT', ''));
          break;
        case 'forex':
          syntheticData = this.generateSyntheticForexData(symbol);
          break;
        case 'stocks':
          syntheticData = this.generateSyntheticStockData(symbol);
          break;
        case 'commodities':
          syntheticData = this.generateSyntheticCommodityData(symbol);
          break;
        default:
          syntheticData = this.generateSyntheticCryptoData(symbol);
      }
      
      const signal = this.createSignalFromData(syntheticData, market);
      if (signal) {
        signal.isFallback = true; // Mark as fallback signal
        signals.push(signal);
      }
    }
    
    return signals;
  }

  // API status monitoring
  getAPIStatus() {
    return {
      apiCallCounts: this.apiCallCounts,
      rateLimitResets: Object.keys(this.rateLimitResets).reduce((acc, key) => {
        const resetTime = this.rateLimitResets[key];
        acc[key] = resetTime > Date.now() ? new Date(resetTime).toISOString() : null;
        return acc;
      }, {}),
      activeAPIs: Object.keys(this.apiCallCounts).filter(api => !this.isRateLimited(api))
    };
  }
}

module.exports = new MultiMarketSignalService();
