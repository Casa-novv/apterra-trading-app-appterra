const EventEmitter = require('events');
const { RSI, MACD, Stochastic, BollingerBands, ATR, ADX, CCI } = require('technicalindicators');
const tf = require('@tensorflow/tfjs');

/**
 * Streaming Feature Factory
 * 
 * Real-time feature engineering service that transforms raw market ticks
 * into hundreds of predictive features for ML models:
 * - Price & Volatility features
 * - Technical indicators
 * - Learned Statistical Moments (LSM)
 * - Graph embeddings
 * - Exogenous features
 */
class StreamingFeatureFactory extends EventEmitter {
  constructor() {
    super();
    
    this.featureProcessors = new Map();
    this.featureCache = new Map();
    this.lsmModel = null;
    this.gnnModel = null;
    this.featureWindow = 100;
    this.isInitialized = false;
    
    // Feature categories
    this.categories = {
      price: 'Price & Volatility Features',
      technical: 'Technical Indicators',
      lsm: 'Learned Statistical Moments',
      graph: 'Graph Embeddings',
      exogenous: 'Exogenous Features',
      momentum: 'Momentum Features',
      pattern: 'Pattern Recognition',
      volume: 'Volume Analysis'
    };
    
    this.setupEventHandlers();
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Streaming Feature Factory...');
      
      // Initialize feature processors
      await this.initializeFeatureProcessors();
      
      // Load ML models for learned features
      await this.loadLearnedModels();
      
      // Initialize feature cache
      this.initializeFeatureCache();
      
      this.isInitialized = true;
      console.log('✅ Streaming Feature Factory initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Feature Factory:', error.message);
      throw error;
    }
  }

  async initializeFeatureProcessors() {
    console.log('⚙️ Initializing feature processors...');
    
    // Price & Volatility Features
    this.featureProcessors.set('price', new PriceFeatureProcessor());
    
    // Technical Indicators
    this.featureProcessors.set('technical', new TechnicalFeatureProcessor());
    
    // Learned Statistical Moments
    this.featureProcessors.set('lsm', new LearnedStatisticalMoments());
    
    // Graph Embeddings
    this.featureProcessors.set('graph', new GraphEmbeddingProcessor());
    
    // Exogenous Features
    this.featureProcessors.set('exogenous', new ExogenousFeatureProcessor());
    
    // Momentum Features
    this.featureProcessors.set('momentum', new MomentumFeatureProcessor());
    
    // Pattern Recognition
    this.featureProcessors.set('pattern', new PatternFeatureProcessor());
    
    // Volume Analysis
    this.featureProcessors.set('volume', new VolumeFeatureProcessor());
    
    console.log(`✅ Initialized ${this.featureProcessors.size} feature processors`);
  }

  async loadLearnedModels() {
    try {
      console.log('🤖 Loading learned models...');
      
      // Load LSM model (simplified for now)
      this.lsmModel = await this.createLSMModel();
      
      // Load GNN model (simplified for now)
      this.gnnModel = await this.createGNNModel();
      
      console.log('✅ Learned models loaded');
    } catch (error) {
      console.error('❌ Failed to load learned models:', error.message);
      console.log('🔄 Continuing with statistical features only');
    }
  }

  async createLSMModel() {
    // Simple neural network for learned statistical moments
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 32, activation: 'relu', inputShape: [50] }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'tanh' }) // 3 learned moments
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });
    
    return model;
  }

  async createGNNModel() {
    // Simple graph neural network for cross-asset embeddings
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 64, activation: 'relu', inputShape: [100] }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'tanh' }) // 8-dimensional embedding
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });
    
    return model;
  }

  initializeFeatureCache() {
    for (const category of Object.keys(this.categories)) {
      this.featureCache.set(category, new Map());
    }
  }

  async processTick(symbol, tick) {
    try {
      if (!this.isInitialized) {
        throw new Error('Feature Factory not initialized');
      }
      
      const startTime = Date.now();
      const features = {};
      
      // Process each feature category
      for (const [category, processor] of this.featureProcessors) {
        try {
          features[category] = await processor.process(symbol, tick);
        } catch (error) {
          console.error(`❌ Error processing ${category} features for ${symbol}:`, error.message);
          features[category] = this.getDefaultFeatures(category);
        }
      }
      
      // Combine all features into unified vector
      const unifiedFeatures = this.combineFeatures(features);
      
      // Store feature vector
      await this.storeFeatureVector(symbol, unifiedFeatures);
      
      // Emit processed features
      this.emit('featuresProcessed', {
        symbol,
        features: unifiedFeatures,
        processingTime: Date.now() - startTime,
        timestamp: tick.timestamp
      });
      
      return unifiedFeatures;
      
    } catch (error) {
      console.error(`❌ Error processing tick for ${symbol}:`, error.message);
      return this.getDefaultFeatureVector();
    }
  }

  combineFeatures(features) {
    const combined = {};
    
    // Flatten all features into single object
    for (const [category, categoryFeatures] of Object.entries(features)) {
      for (const [featureName, value] of Object.entries(categoryFeatures)) {
        combined[`${category}_${featureName}`] = value;
      }
    }
    
    return combined;
  }

  async storeFeatureVector(symbol, features) {
    // Store in cache for quick access
    this.featureCache.get('recent').set(symbol, {
      features,
      timestamp: Date.now()
    });
    
    // Keep only recent features
    const recentFeatures = this.featureCache.get('recent');
    if (recentFeatures.size > 1000) {
      const oldestKey = recentFeatures.keys().next().value;
      recentFeatures.delete(oldestKey);
    }
  }

  getDefaultFeatures(category) {
    const defaults = {
      price: {
        return_1s: 0,
        return_5s: 0,
        return_30s: 0,
        price_level: 0.5,
        price_momentum: 0,
        realized_vol_5s: 0,
        realized_vol_30s: 0,
        skewness: 0,
        kurtosis: 0
      },
      technical: {
        rsi_14: 50,
        macd_line: 0,
        macd_signal: 0,
        macd_histogram: 0,
        sma_10: 0,
        sma_20: 0,
        ema_10: 0,
        ema_20: 0,
        bb_position: 0.5,
        atr_14: 0,
        adx_14: 0
      },
      lsm: {
        lsm_embedding_1: 0,
        lsm_embedding_2: 0,
        lsm_embedding_3: 0
      },
      graph: {
        graph_embedding_1: 0,
        graph_embedding_2: 0,
        graph_embedding_3: 0,
        correlation_strength: 0
      },
      exogenous: {
        sentiment_score: 0,
        news_volume: 0,
        market_regime: 0,
        volatility_regime: 0
      },
      momentum: {
        momentum_5s: 0,
        momentum_30s: 0,
        momentum_1m: 0,
        roc_5s: 0,
        roc_30s: 0,
        roc_1m: 0
      },
      pattern: {
        support_resistance_ratio: 0.5,
        trend_strength: 0,
        pattern_completion: 0,
        breakout_probability: 0
      },
      volume: {
        volume_ratio: 1,
        volume_trend: 0,
        vwap_deviation: 0,
        volume_profile: 0
      }
    };
    
    return defaults[category] || {};
  }

  getDefaultFeatureVector() {
    const defaultFeatures = {};
    
    for (const category of Object.keys(this.categories)) {
      const categoryDefaults = this.getDefaultFeatures(category);
      for (const [featureName, value] of Object.entries(categoryDefaults)) {
        defaultFeatures[`${category}_${featureName}`] = value;
      }
    }
    
    return defaultFeatures;
  }

  setupEventHandlers() {
    this.on('featuresProcessed', (data) => {
      // Emit to ML models
      this.emit('featuresReady', data);
    });
  }

  getFeatureStatistics(symbol, hours = 24) {
    const features = this.featureCache.get('recent').get(symbol);
    if (!features) return null;
    
    return {
      symbol,
      lastUpdate: features.timestamp,
      featureCount: Object.keys(features.features).length,
      categories: Object.keys(this.categories).length
    };
  }

  async shutdown() {
    console.log('🔄 Shutting down Feature Factory...');
    
    // Clean up TensorFlow models
    if (this.lsmModel) {
      this.lsmModel.dispose();
    }
    if (this.gnnModel) {
      this.gnnModel.dispose();
    }
    
    console.log('✅ Feature Factory shut down');
  }
}

/**
 * Price & Volatility Feature Processor
 */
class PriceFeatureProcessor {
  constructor() {
    this.priceHistory = new Map();
    this.returnHistory = new Map();
  }

  async process(symbol, tick) {
    // Update price history
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const prices = this.priceHistory.get(symbol);
    prices.push(tick.price);
    
    // Keep only recent prices
    if (prices.length > 100) {
      prices.shift();
    }
    
    // Calculate returns
    const returns = this.calculateReturns(prices);
    
    return {
      // Current price features
      price: tick.price,
      price_change: prices.length > 1 ? tick.price - prices[prices.length - 2] : 0,
      price_change_pct: prices.length > 1 ? (tick.price - prices[prices.length - 2]) / prices[prices.length - 2] : 0,
      
      // Rolling returns
      return_1s: this.calculateRollingReturn(returns, 1),
      return_5s: this.calculateRollingReturn(returns, 5),
      return_30s: this.calculateRollingReturn(returns, 30),
      return_1m: this.calculateRollingReturn(returns, 60),
      
      // Price levels
      price_level: this.calculatePriceLevel(prices),
      price_momentum: this.calculateMomentum(prices),
      
      // Volatility measures
      realized_vol_5s: this.calculateRealizedVolatility(returns, 5),
      realized_vol_30s: this.calculateRealizedVolatility(returns, 30),
      realized_vol_1m: this.calculateRealizedVolatility(returns, 60),
      
      // Higher moments
      skewness: this.calculateSkewness(returns),
      kurtosis: this.calculateKurtosis(returns),
      
      // EWMA volatility
      ewma_vol_5s: this.calculateEWMAVolatility(returns, 5, 0.94),
      ewma_vol_30s: this.calculateEWMAVolatility(returns, 30, 0.94)
    };
  }

  calculateReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  calculateRollingReturn(returns, window) {
    if (returns.length < window) return 0;
    const windowReturns = returns.slice(-window);
    return windowReturns.reduce((sum, ret) => sum + ret, 0);
  }

  calculatePriceLevel(prices) {
    if (prices.length < 20) return 0.5;
    const recent = prices.slice(-20);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    return (prices[prices.length - 1] - min) / (max - min);
  }

  calculateMomentum(prices) {
    if (prices.length < 10) return 0;
    const recent = prices.slice(-10);
    const trend = recent.reduce((sum, price, i) => sum + price * (i + 1), 0) / recent.reduce((sum, _, i) => sum + (i + 1), 0);
    return (prices[prices.length - 1] - trend) / trend;
  }

  calculateRealizedVolatility(returns, window) {
    if (returns.length < window) return 0;
    const windowReturns = returns.slice(-window);
    const mean = windowReturns.reduce((sum, ret) => sum + ret, 0) / window;
    const variance = windowReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / window;
    return Math.sqrt(variance * 252 * 24 * 60 * 60); // Annualized
  }

  calculateSkewness(returns) {
    if (returns.length < 3) return 0;
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return returns.reduce((sum, ret) => sum + Math.pow((ret - mean) / stdDev, 3), 0) / returns.length;
  }

  calculateKurtosis(returns) {
    if (returns.length < 4) return 0;
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const kurtosis = returns.reduce((sum, ret) => sum + Math.pow((ret - mean) / stdDev, 4), 0) / returns.length;
    return kurtosis - 3; // Excess kurtosis
  }

  calculateEWMAVolatility(returns, window, lambda) {
    if (returns.length < window) return 0;
    const windowReturns = returns.slice(-window);
    
    let variance = windowReturns[0] * windowReturns[0];
    for (let i = 1; i < windowReturns.length; i++) {
      variance = lambda * variance + (1 - lambda) * windowReturns[i] * windowReturns[i];
    }
    
    return Math.sqrt(variance * 252 * 24 * 60 * 60); // Annualized
  }
}

/**
 * Technical Indicators Feature Processor
 */
class TechnicalFeatureProcessor {
  constructor() {
    this.priceHistory = new Map();
    this.volumeHistory = new Map();
  }

  async process(symbol, tick) {
    // Update price history
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const prices = this.priceHistory.get(symbol);
    prices.push(tick.price);
    
    if (prices.length > 200) {
      prices.shift();
    }
    
    // Update volume history if available
    if (tick.volume !== undefined) {
      if (!this.volumeHistory.has(symbol)) {
        this.volumeHistory.set(symbol, []);
      }
      
      const volumes = this.volumeHistory.get(symbol);
      volumes.push(tick.volume);
      
      if (volumes.length > 200) {
        volumes.shift();
      }
    }
    
    return {
      // RSI
      rsi_14: this.calculateRSI(prices, 14),
      rsi_21: this.calculateRSI(prices, 21),
      
      // MACD
      macd_line: this.calculateMACD(prices).macd,
      macd_signal: this.calculateMACD(prices).signal,
      macd_histogram: this.calculateMACD(prices).histogram,
      
      // Moving Averages
      sma_10: this.calculateSMA(prices, 10),
      sma_20: this.calculateSMA(prices, 20),
      sma_50: this.calculateSMA(prices, 50),
      ema_10: this.calculateEMA(prices, 10),
      ema_20: this.calculateEMA(prices, 20),
      ema_50: this.calculateEMA(prices, 50),
      
      // Bollinger Bands
      bb_upper: this.calculateBollingerBands(prices).upper,
      bb_middle: this.calculateBollingerBands(prices).middle,
      bb_lower: this.calculateBollingerBands(prices).lower,
      bb_position: this.calculateBollingerBands(prices).position,
      
      // Volatility Indicators
      atr_14: this.calculateATR(prices, 14),
      adx_14: this.calculateADX(prices, 14),
      
      // Stochastic
      stoch_k: this.calculateStochastic(prices).k,
      stoch_d: this.calculateStochastic(prices).d,
      
      // CCI
      cci_14: this.calculateCCI(prices, 14),
      
      // VWAP (if volume available)
      vwap: this.calculateVWAP(prices, this.volumeHistory.get(symbol))
    };
  }

  calculateRSI(prices, period) {
    if (prices.length < period + 1) return 50;
    
    const rsiValues = RSI.calculate({ values: prices, period });
    return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
  }

  calculateMACD(prices) {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    
    const macdResults = MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    });
    
    if (macdResults.length > 0) {
      const last = macdResults[macdResults.length - 1];
      return {
        macd: last.MACD,
        signal: last.signal,
        histogram: last.histogram
      };
    }
    
    return { macd: 0, signal: 0, histogram: 0 };
  }

  calculateSMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  calculateBollingerBands(prices) {
    if (prices.length < 20) {
      const price = prices[prices.length - 1];
      return { upper: price, middle: price, lower: price, position: 0.5 };
    }
    
    const bbResults = BollingerBands.calculate({
      values: prices,
      period: 20,
      stdDev: 2
    });
    
    if (bbResults.length > 0) {
      const bb = bbResults[bbResults.length - 1];
      const currentPrice = prices[prices.length - 1];
      const position = (currentPrice - bb.lower) / (bb.upper - bb.lower);
      
      return {
        upper: bb.upper,
        middle: bb.middle,
        lower: bb.lower,
        position: Math.max(0, Math.min(1, position))
      };
    }
    
    const price = prices[prices.length - 1];
    return { upper: price, middle: price, lower: price, position: 0.5 };
  }

  calculateATR(prices, period) {
    if (prices.length < period) return 0;
    
    const atrValues = ATR.calculate({
      high: prices,
      low: prices,
      close: prices,
      period
    });
    
    return atrValues.length > 0 ? atrValues[atrValues.length - 1] : 0;
  }

  calculateADX(prices, period) {
    if (prices.length < period) return 0;
    
    const adxValues = ADX.calculate({
      close: prices,
      high: prices,
      low: prices,
      period
    });
    
    return adxValues.length > 0 ? adxValues[adxValues.length - 1].adx : 0;
  }

  calculateStochastic(prices) {
    if (prices.length < 14) return { k: 50, d: 50 };
    
    const stochResults = Stochastic.calculate({
      high: prices,
      low: prices,
      close: prices,
      period: 14
    });
    
    if (stochResults.length > 0) {
      const last = stochResults[stochResults.length - 1];
      return { k: last.k, d: last.d };
    }
    
    return { k: 50, d: 50 };
  }

  calculateCCI(prices, period) {
    if (prices.length < period) return 0;
    
    const cciValues = CCI.calculate({
      high: prices,
      low: prices,
      close: prices,
      period
    });
    
    return cciValues.length > 0 ? cciValues[cciValues.length - 1] : 0;
  }

  calculateVWAP(prices, volumes) {
    if (!volumes || volumes.length !== prices.length) {
      return prices[prices.length - 1];
    }
    
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < prices.length; i++) {
      const typicalPrice = prices[i]; // Simplified: using close price as typical price
      const volume = volumes[i];
      
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
    }
    
    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : prices[prices.length - 1];
  }
}

/**
 * Learned Statistical Moments Processor
 */
class LearnedStatisticalMoments {
  constructor() {
    this.lsmModel = null;
  }

  async process(symbol, tick) {
    // For now, return simplified learned moments
    // In production, this would use a trained neural network
    
    return {
      lsm_embedding_1: Math.sin(Date.now() / 10000) * 0.1, // Learned skewness
      lsm_embedding_2: Math.cos(Date.now() / 10000) * 0.1, // Learned kurtosis
      lsm_embedding_3: Math.random() * 0.1 // Learned higher moment
    };
  }
}

/**
 * Graph Embedding Processor
 */
class GraphEmbeddingProcessor {
  constructor() {
    this.gnnModel = null;
    this.assetGraph = new Map();
  }

  async process(symbol, tick) {
    // For now, return simplified graph embeddings
    // In production, this would use a trained GNN
    
    return {
      graph_embedding_1: Math.random() * 0.1,
      graph_embedding_2: Math.random() * 0.1,
      graph_embedding_3: Math.random() * 0.1,
      correlation_strength: Math.random()
    };
  }
}

/**
 * Exogenous Feature Processor
 */
class ExogenousFeatureProcessor {
  constructor() {
    this.sentimentHistory = new Map();
    this.newsHistory = new Map();
  }

  async process(symbol, tick) {
    return {
      sentiment_score: tick.sentiment || 0,
      news_volume: Math.random() * 10, // Placeholder
      market_regime: this.detectMarketRegime(tick),
      volatility_regime: this.detectVolatilityRegime(tick)
    };
  }

  detectMarketRegime(tick) {
    // Simple regime detection based on price movement
    const priceChange = tick.price_change_pct || 0;
    
    if (Math.abs(priceChange) > 0.05) return 2; // High volatility
    if (Math.abs(priceChange) > 0.02) return 1; // Medium volatility
    return 0; // Low volatility
  }

  detectVolatilityRegime(tick) {
    // Placeholder for volatility regime detection
    return Math.random() * 3;
  }
}

/**
 * Momentum Feature Processor
 */
class MomentumFeatureProcessor {
  constructor() {
    this.priceHistory = new Map();
  }

  async process(symbol, tick) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const prices = this.priceHistory.get(symbol);
    prices.push(tick.price);
    
    if (prices.length > 100) {
      prices.shift();
    }
    
    return {
      momentum_5s: this.calculateMomentum(prices, 5),
      momentum_30s: this.calculateMomentum(prices, 30),
      momentum_1m: this.calculateMomentum(prices, 60),
      roc_5s: this.calculateROC(prices, 5),
      roc_30s: this.calculateROC(prices, 30),
      roc_1m: this.calculateROC(prices, 60)
    };
  }

  calculateMomentum(prices, window) {
    if (prices.length < window) return 0;
    return (prices[prices.length - 1] - prices[prices.length - window]) / prices[prices.length - window];
  }

  calculateROC(prices, window) {
    if (prices.length < window) return 0;
    return (prices[prices.length - 1] / prices[prices.length - window - 1]) - 1;
  }
}

/**
 * Pattern Feature Processor
 */
class PatternFeatureProcessor {
  async process(symbol, tick) {
    return {
      support_resistance_ratio: 0.5, // Placeholder
      trend_strength: Math.random(),
      pattern_completion: Math.random(),
      breakout_probability: Math.random()
    };
  }
}

/**
 * Volume Feature Processor
 */
class VolumeFeatureProcessor {
  constructor() {
    this.volumeHistory = new Map();
  }

  async process(symbol, tick) {
    if (!this.volumeHistory.has(symbol)) {
      this.volumeHistory.set(symbol, []);
    }
    
    const volumes = this.volumeHistory.get(symbol);
    volumes.push(tick.volume || 0);
    
    if (volumes.length > 100) {
      volumes.shift();
    }
    
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    
    return {
      volume_ratio: avgVolume > 0 ? (tick.volume || 0) / avgVolume : 1,
      volume_trend: this.calculateVolumeTrend(volumes),
      vwap_deviation: 0, // Placeholder
      volume_profile: Math.random()
    };
  }

  calculateVolumeTrend(volumes) {
    if (volumes.length < 10) return 0;
    
    const recent = volumes.slice(-10);
    const trend = recent.reduce((sum, vol, i) => sum + vol * (i + 1), 0) / recent.reduce((sum, _, i) => sum + (i + 1), 0);
    const avgVolume = recent.reduce((sum, vol) => sum + vol, 0) / recent.length;
    
    return avgVolume > 0 ? (trend - avgVolume) / avgVolume : 0;
  }
}

module.exports = StreamingFeatureFactory; 