const WebSocket = require('ws');
const Redis = require('ioredis');
const axios = require('axios');
const EventEmitter = require('events');

/**
 * Real-Time Market Data Ingestion Service
 * 
 * Handles dual-channel feed for live market data:
 * - WebSocket connections for tick-level data
 * - REST polling fallback on disconnects
 * - Redis TimeSeries for high-frequency data storage
 * - Buffering and persistence for ML training
 */
class MarketDataIngestionService extends EventEmitter {
  constructor() {
    super();
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
    
    this.websocketConnections = new Map();
    this.fallbackPolling = new Map();
    this.circuitBreakers = new Map();
    this.dataBuffers = new Map();
    this.isInitialized = false;
    
    // Configuration
    this.config = {
      websocketReconnectDelay: 5000,
      pollingInterval: 1000,
      bufferSize: 1000,
      maxRetries: 3,
      circuitBreakerThreshold: 5
    };
    
    this.setupEventHandlers();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Market Data Ingestion Service...');
      
      // Test Redis connection
      await this.redis.ping();
      console.log('✅ Redis connection established');
      
      // Initialize Redis TimeSeries
      await this.initializeTimeSeries();
      
      // Initialize WebSocket connections
      await this.initializeConnections();
      
      // Start fallback polling for critical assets
      this.startFallbackPolling();
      
      this.isInitialized = true;
      console.log('✅ Market Data Ingestion Service initialized');
      
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Market Data Ingestion Service:', error.message);
      throw error;
    }
  }

  async initializeTimeSeries() {
    console.log('📊 Initializing Redis TimeSeries...');
    
    const retentionPolicies = {
      '1s': 60 * 60 * 24,        // 1 day for tick data
      '1m': 60 * 60 * 24 * 7,    // 7 days for minute data
      '1h': 60 * 60 * 24 * 30    // 30 days for hour data
    };

    for (const [resolution, retention] of Object.entries(retentionPolicies)) {
      try {
        await this.redis.ts.create(`price:${resolution}`, {
          RETENTION: retention * 1000,
          LABELS: { type: 'price', resolution }
        });
        
        await this.redis.ts.create(`volume:${resolution}`, {
          RETENTION: retention * 1000,
          LABELS: { type: 'volume', resolution }
        });
        
        await this.redis.ts.create(`spread:${resolution}`, {
          RETENTION: retention * 1000,
          LABELS: { type: 'spread', resolution }
        });
        
        console.log(`✅ TimeSeries initialized for ${resolution} resolution`);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error(`❌ Failed to create TimeSeries for ${resolution}:`, error.message);
        }
      }
    }
  }

  async initializeConnections() {
    console.log('🔌 Initializing WebSocket connections...');
    
    // Initialize connections for different asset types
    await this.connectBinanceWebSocket();
    await this.connectAlphaVantageStream();
    await this.connectNewsStream();
    
    console.log('✅ WebSocket connections initialized');
  }

  async connectBinanceWebSocket() {
    try {
      console.log('🔌 Connecting to Binance WebSocket...');
      
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
      const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
      
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);
      
      ws.on('open', () => {
        console.log('✅ Binance WebSocket connected');
        this.websocketConnections.set('binance', ws);
      });
      
      ws.on('message', async (data) => {
        try {
          const tickers = JSON.parse(data);
          if (Array.isArray(tickers)) {
            await this.processBinanceTickers(tickers);
          }
        } catch (error) {
          console.error('❌ Error processing Binance data:', error.message);
        }
      });
      
      ws.on('close', () => {
        console.log('⚠️ Binance WebSocket disconnected');
        this.websocketConnections.delete('binance');
        this.scheduleReconnect('binance');
      });
      
      ws.on('error', (error) => {
        console.error('❌ Binance WebSocket error:', error.message);
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to Binance WebSocket:', error.message);
    }
  }

  async connectAlphaVantageStream() {
    try {
      console.log('🔌 Connecting to Alpha Vantage stream...');
      
      // For stocks and forex, we'll use polling with high frequency
      const symbols = ['AAPL', 'GOOGL', 'TSLA', 'EURUSD', 'GBPUSD', 'USDJPY'];
      
      for (const symbol of symbols) {
        this.startSymbolPolling(symbol, 'alphavantage');
      }
      
    } catch (error) {
      console.error('❌ Failed to connect to Alpha Vantage:', error.message);
    }
  }

  async connectNewsStream() {
    try {
      console.log('🔌 Connecting to News sentiment stream...');
      
      // For now, we'll poll news APIs periodically
      // In production, you'd connect to real-time news feeds
      setInterval(async () => {
        await this.updateNewsSentiment();
      }, 30000); // Every 30 seconds
      
    } catch (error) {
      console.error('❌ Failed to connect to News stream:', error.message);
    }
  }

  async processBinanceTickers(tickers) {
    const processedTicks = [];
    
    for (const ticker of tickers) {
      try {
        const tick = {
          symbol: ticker.s,
          price: parseFloat(ticker.c),
          volume: parseFloat(ticker.v),
          timestamp: Date.now(),
          bid: parseFloat(ticker.b),
          ask: parseFloat(ticker.a),
          spread: parseFloat(ticker.a) - parseFloat(ticker.b),
          high24h: parseFloat(ticker.h),
          low24h: parseFloat(ticker.l),
          priceChange: parseFloat(ticker.P),
          volumeChange: parseFloat(ticker.v),
          source: 'binance'
        };
        
        // Store in Redis TimeSeries
        await this.storeTick(tick);
        
        // Buffer for feature engineering
        await this.bufferTick(tick);
        
        processedTicks.push(tick);
        
      } catch (error) {
        console.error(`❌ Error processing ticker ${ticker.s}:`, error.message);
      }
    }
    
    // Emit processed data
    this.emit('tickData', processedTicks);
    
    // Update circuit breaker status
    this.updateCircuitBreaker('binance', true);
  }

  async storeTick(tick) {
    try {
      const timestamp = tick.timestamp;
      
      // Store at different resolutions
      await this.redis.ts.add(`price:1s:${tick.symbol}`, timestamp, tick.price);
      await this.redis.ts.add(`volume:1s:${tick.symbol}`, timestamp, tick.volume);
      await this.redis.ts.add(`spread:1s:${tick.symbol}`, timestamp, tick.spread);
      
      // Aggregate to minute data every 60 seconds
      if (timestamp % 60000 < 1000) {
        await this.aggregateToMinute(tick.symbol, timestamp);
      }
      
    } catch (error) {
      console.error(`❌ Error storing tick for ${tick.symbol}:`, error.message);
    }
  }

  async aggregateToMinute(symbol, timestamp) {
    try {
      const minuteTimestamp = Math.floor(timestamp / 60000) * 60000;
      
      // Get last minute of data
      const priceData = await this.redis.ts.range(
        `price:1s:${symbol}`, 
        minuteTimestamp - 60000, 
        minuteTimestamp
      );
      
      if (priceData.length > 0) {
        const prices = priceData.map(([ts, price]) => price);
        const volumes = await this.redis.ts.range(
          `volume:1s:${symbol}`, 
          minuteTimestamp - 60000, 
          minuteTimestamp
        );
        
        const minuteData = {
          open: prices[0],
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: prices[prices.length - 1],
          volume: volumes.reduce((sum, [ts, vol]) => sum + vol, 0),
          timestamp: minuteTimestamp
        };
        
        // Store minute data
        await this.redis.ts.add(`price:1m:${symbol}`, minuteTimestamp, minuteData.close);
        await this.redis.ts.add(`volume:1m:${symbol}`, minuteTimestamp, minuteData.volume);
        
        // Emit minute data
        this.emit('minuteData', { symbol, data: minuteData });
      }
      
    } catch (error) {
      console.error(`❌ Error aggregating minute data for ${symbol}:`, error.message);
    }
  }

  async bufferTick(tick) {
    if (!this.dataBuffers.has(tick.symbol)) {
      this.dataBuffers.set(tick.symbol, []);
    }
    
    const buffer = this.dataBuffers.get(tick.symbol);
    buffer.push(tick);
    
    // Keep only recent data
    if (buffer.length > this.config.bufferSize) {
      buffer.shift();
    }
    
    // Emit buffered data for feature engineering
    this.emit('bufferedData', { symbol: tick.symbol, data: buffer });
  }

  async startSymbolPolling(symbol, source) {
    if (this.fallbackPolling.has(symbol)) return;
    
    const interval = setInterval(async () => {
      try {
        const data = await this.fetchSymbolData(symbol, source);
        if (data) {
          await this.processPolledData(symbol, data, source);
        }
      } catch (error) {
        await this.handlePollingError(symbol, error);
      }
    }, this.config.pollingInterval);
    
    this.fallbackPolling.set(symbol, interval);
    console.log(`📡 Started polling for ${symbol} (${source})`);
  }

  async fetchSymbolData(symbol, source) {
    try {
      if (source === 'alphavantage') {
        return await this.fetchAlphaVantageData(symbol);
      } else if (source === 'twelvedata') {
        return await this.fetchTwelveDataData(symbol);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${symbol} data from ${source}:`, error.message);
      return null;
    }
  }

  async fetchAlphaVantageData(symbol) {
    if (!process.env.ALPHA_VANTAGE_KEY) {
      throw new Error('Alpha Vantage API key not configured');
    }
    
    const isForex = symbol.length === 6 && symbol.slice(3) === 'USD';
    const isStock = symbol.length <= 5;
    
    let url;
    if (isForex) {
      const base = symbol.slice(0, 3);
      const quote = symbol.slice(3, 6);
      url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${base}&to_currency=${quote}&apikey=${process.env.ALPHA_VANTAGE_KEY}`;
    } else if (isStock) {
      url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_KEY}`;
    } else {
      throw new Error(`Unsupported symbol format: ${symbol}`);
    }
    
    const response = await axios.get(url, { timeout: 5000 });
    
    if (isForex) {
      const rate = response.data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
      return rate ? parseFloat(rate) : null;
    } else if (isStock) {
      const price = response.data['Global Quote']?.['05. price'];
      return price ? parseFloat(price) : null;
    }
    
    return null;
  }

  async fetchTwelveDataData(symbol) {
    if (!process.env.TWELVE_DATA_KEY) {
      throw new Error('Twelve Data API key not configured');
    }
    
    const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });
    
    return response.data.price ? parseFloat(response.data.price) : null;
  }

  async processPolledData(symbol, price, source) {
    const tick = {
      symbol,
      price,
      volume: 0, // Not available from polling
      timestamp: Date.now(),
      bid: price,
      ask: price,
      spread: 0,
      source
    };
    
    await this.storeTick(tick);
    await this.bufferTick(tick);
    
    this.emit('tickData', [tick]);
  }

  async handlePollingError(symbol, error) {
    const breaker = this.circuitBreakers.get(symbol) || { failures: 0, lastFailure: 0 };
    
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures > this.config.circuitBreakerThreshold) {
      console.log(`🚨 Circuit breaker OPEN for ${symbol} - stopping polling`);
      clearInterval(this.fallbackPolling.get(symbol));
      this.fallbackPolling.delete(symbol);
    }
    
    this.circuitBreakers.set(symbol, breaker);
  }

  updateCircuitBreaker(source, success) {
    const breaker = this.circuitBreakers.get(source) || { failures: 0, lastFailure: 0 };
    
    if (success) {
      breaker.failures = Math.max(0, breaker.failures - 1);
    }
    
    this.circuitBreakers.set(source, breaker);
  }

  scheduleReconnect(source) {
    setTimeout(async () => {
      console.log(`🔄 Attempting to reconnect to ${source}...`);
      try {
        if (source === 'binance') {
          await this.connectBinanceWebSocket();
        }
      } catch (error) {
        console.error(`❌ Failed to reconnect to ${source}:`, error.message);
      }
    }, this.config.websocketReconnectDelay);
  }

  async updateNewsSentiment() {
    try {
      const symbols = ['BTC', 'ETH', 'AAPL', 'TSLA'];
      
      for (const symbol of symbols) {
        const sentiment = await this.fetchNewsSentiment(symbol);
        if (sentiment !== null) {
          await this.redis.ts.add(`sentiment:${symbol}`, Date.now(), sentiment);
          this.emit('sentimentData', { symbol, sentiment });
        }
      }
    } catch (error) {
      console.error('❌ Error updating news sentiment:', error.message);
    }
  }

  async fetchNewsSentiment(symbol) {
    try {
      if (!process.env.NEWS_API_KEY) return null;
      
      const response = await axios.get(
        `https://newsapi.org/v2/everything?q=${symbol}&apiKey=${process.env.NEWS_API_KEY}&pageSize=10`,
        { timeout: 5000 }
      );
      
      if (response.data.articles && response.data.articles.length > 0) {
        // Simple sentiment calculation (in production, use proper NLP)
        const titles = response.data.articles.map(article => article.title);
        const sentiment = this.calculateSimpleSentiment(titles);
        return sentiment;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error fetching news for ${symbol}:`, error.message);
      return null;
    }
  }

  calculateSimpleSentiment(titles) {
    const positiveWords = ['up', 'rise', 'gain', 'positive', 'bull', 'growth', 'profit'];
    const negativeWords = ['down', 'fall', 'loss', 'negative', 'bear', 'decline', 'crash'];
    
    let score = 0;
    const text = titles.join(' ').toLowerCase();
    
    positiveWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    });
    
    negativeWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'g')) || []).length;
      score -= matches;
    });
    
    return Math.tanh(score / 10); // Normalize to [-1, 1]
  }

  async getRecentData(symbol, resolution = '1s', count = 1000) {
    try {
      const data = await this.redis.ts.range(
        `price:${resolution}:${symbol}`, 
        Date.now() - (count * 1000), 
        Date.now()
      );
      
      return data.map(([timestamp, price]) => ({ timestamp, price }));
    } catch (error) {
      console.error(`❌ Error getting recent data for ${symbol}:`, error.message);
      return [];
    }
  }

  async getBufferedData(symbol) {
    return this.dataBuffers.get(symbol) || [];
  }

  setupEventHandlers() {
    this.on('tickData', (ticks) => {
      // Emit to feature engineering service
      this.emit('marketData', { type: 'tick', data: ticks });
    });
    
    this.on('minuteData', (data) => {
      // Emit to feature engineering service
      this.emit('marketData', { type: 'minute', data });
    });
    
    this.on('sentimentData', (data) => {
      // Emit to feature engineering service
      this.emit('marketData', { type: 'sentiment', data });
    });
  }

  startFallbackPolling() {
    // Start polling for critical assets that don't have WebSocket feeds
    const criticalAssets = ['GOLD', 'OIL', 'SILVER'];
    
    criticalAssets.forEach(symbol => {
      this.startSymbolPolling(symbol, 'twelvedata');
    });
  }

  async shutdown() {
    console.log('🔄 Shutting down Market Data Ingestion Service...');
    
    // Close WebSocket connections
    for (const [source, ws] of this.websocketConnections) {
      ws.close();
    }
    
    // Clear polling intervals
    for (const [symbol, interval] of this.fallbackPolling) {
      clearInterval(interval);
    }
    
    // Close Redis connection
    await this.redis.quit();
    
    console.log('✅ Market Data Ingestion Service shut down');
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      websocketConnections: Array.from(this.websocketConnections.keys()),
      pollingSymbols: Array.from(this.fallbackPolling.keys()),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      bufferSizes: Object.fromEntries(
        Array.from(this.dataBuffers.entries()).map(([symbol, buffer]) => [symbol, buffer.length])
      )
    };
  }
}

module.exports = MarketDataIngestionService; 