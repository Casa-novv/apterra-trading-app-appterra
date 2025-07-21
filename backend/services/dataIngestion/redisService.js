const redis = require('../redisClient');;

/**
 * Redis TimeSeries Service
 * 
 * Handles high-frequency data storage and retrieval using Redis TimeSeries:
 * - Multiple resolution storage (1s, 1m, 1h)
 * - Automatic data retention and compression
 * - Efficient querying and aggregation
 * - Cross-asset correlation analysis
 */
class RedisTimeSeriesService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    
    this.retentionPolicies = {
      '1s': 60 * 60 * 24,        // 1 day for tick data
      '1m': 60 * 60 * 24 * 7,    // 7 days for minute data
      '1h': 60 * 60 * 24 * 30,   // 30 days for hour data
      '1d': 60 * 60 * 24 * 365   // 1 year for daily data
    };
    
    this.compressionPolicies = {
      '1s': { chunkSize: 1000, compression: 'lz4' },
      '1m': { chunkSize: 100, compression: 'lz4' },
      '1h': { chunkSize: 24, compression: 'lz4' },
      '1d': { chunkSize: 30, compression: 'lz4' }
    };
    
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('📊 Initializing Redis TimeSeries Service...');
      
      // Test connection
      await this.redis.ping();
      console.log('✅ Redis connection established');
      
      // Initialize TimeSeries with retention policies
      await this.initializeTimeSeries();
      
      // Initialize compression policies
      await this.initializeCompression();
      
      // Initialize correlation analysis keys
      await this.initializeCorrelationKeys();
      
      this.isInitialized = true;
      console.log('✅ Redis TimeSeries Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Redis TimeSeries Service:', error.message);
      throw error;
    }
  }

  async initializeTimeSeries() {
    console.log('📈 Initializing TimeSeries with retention policies...');
    
    const dataTypes = ['price', 'volume', 'spread', 'sentiment', 'correlation'];
    
    for (const [resolution, retention] of Object.entries(this.retentionPolicies)) {
      for (const dataType of dataTypes) {
        try {
          const key = `${dataType}:${resolution}`;
          await this.redis.ts.create(key, {
            RETENTION: retention * 1000,
            LABELS: { 
              type: dataType, 
              resolution,
              retention: `${retention}s`
            }
          });
          
          console.log(`✅ Created TimeSeries: ${key}`);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error(`❌ Failed to create TimeSeries ${dataType}:${resolution}:`, error.message);
          }
        }
      }
    }
  }

  async initializeCompression() {
    console.log('🗜️ Initializing compression policies...');
    
    for (const [resolution, policy] of Object.entries(this.compressionPolicies)) {
      try {
        const dataTypes = ['price', 'volume', 'spread'];
        
        for (const dataType of dataTypes) {
          const key = `${dataType}:${resolution}`;
          
          // Set compression policy
          await this.redis.ts.alter(key, {
            CHUNK_SIZE: policy.chunkSize,
            COMPRESSION: policy.compression
          });
          
          console.log(`✅ Applied compression to ${key}`);
        }
      } catch (error) {
        console.error(`❌ Failed to apply compression for ${resolution}:`, error.message);
      }
    }
  }

  async initializeCorrelationKeys() {
    console.log('🔗 Initializing correlation analysis keys...');
    
    try {
      // Create correlation matrix storage
      await this.redis.set('correlation:matrix:last_update', Date.now());
      await this.redis.set('correlation:matrix:window_size', 1000);
      
      // Create asset list
      const assets = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'AAPL', 'GOOGL', 'TSLA'];
      await this.redis.sadd('assets:tracked', ...assets);
      
      console.log('✅ Correlation keys initialized');
    } catch (error) {
      console.error('❌ Failed to initialize correlation keys:', error.message);
    }
  }

  async storeTick(symbol, data) {
    try {
      const timestamp = data.timestamp || Date.now();
      
      // Store price data
      await this.redis.ts.add(`price:1s:${symbol}`, timestamp, data.price);
      
      // Store volume if available
      if (data.volume !== undefined) {
        await this.redis.ts.add(`volume:1s:${symbol}`, timestamp, data.volume);
      }
      
      // Store spread if available
      if (data.spread !== undefined) {
        await this.redis.ts.add(`spread:1s:${symbol}`, timestamp, data.spread);
      }
      
      // Store sentiment if available
      if (data.sentiment !== undefined) {
        await this.redis.ts.add(`sentiment:1s:${symbol}`, timestamp, data.sentiment);
      }
      
      // Update last price for quick access
      await this.redis.set(`price:current:${symbol}`, data.price);
      await this.redis.set(`price:last_update:${symbol}`, timestamp);
      
      return true;
    } catch (error) {
      console.error(`❌ Error storing tick for ${symbol}:`, error.message);
      return false;
    }
  }

  async getRecentData(symbol, dataType = 'price', resolution = '1s', count = 1000) {
    try {
      const key = `${dataType}:${resolution}:${symbol}`;
      const endTime = Date.now();
      const startTime = endTime - (count * this.getResolutionMs(resolution));
      
      const data = await this.redis.ts.range(key, startTime, endTime);
      
      return data.map(([timestamp, value]) => ({
        timestamp: parseInt(timestamp),
        value: parseFloat(value)
      }));
    } catch (error) {
      console.error(`❌ Error getting recent data for ${symbol}:`, error.message);
      return [];
    }
  }

  async getCurrentPrice(symbol) {
    try {
      const price = await this.redis.get(`price:current:${symbol}`);
      return price ? parseFloat(price) : null;
    } catch (error) {
      console.error(`❌ Error getting current price for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceHistory(symbol, resolution = '1s', hours = 24) {
    try {
      const endTime = Date.now();
      const startTime = endTime - (hours * 60 * 60 * 1000);
      
      const data = await this.redis.ts.range(
        `price:${resolution}:${symbol}`, 
        startTime, 
        endTime
      );
      
      return data.map(([timestamp, price]) => ({
        timestamp: parseInt(timestamp),
        price: parseFloat(price)
      }));
    } catch (error) {
      console.error(`❌ Error getting price history for ${symbol}:`, error.message);
      return [];
    }
  }

  async aggregateData(symbol, fromResolution, toResolution, startTime, endTime) {
    try {
      const sourceKey = `price:${fromResolution}:${symbol}`;
      const targetKey = `price:${toResolution}:${symbol}`;
      
      // Perform aggregation
      const aggregated = await this.redis.ts.range(
        sourceKey, 
        startTime, 
        endTime,
        {
          AGGREGATION: {
            type: 'avg',
            timeBucket: this.getResolutionMs(toResolution)
          }
        }
      );
      
      // Store aggregated data
      for (const [timestamp, value] of aggregated) {
        await this.redis.ts.add(targetKey, timestamp, value);
      }
      
      return aggregated.map(([timestamp, value]) => ({
        timestamp: parseInt(timestamp),
        value: parseFloat(value)
      }));
    } catch (error) {
      console.error(`❌ Error aggregating data for ${symbol}:`, error.message);
      return [];
    }
  }

  async calculateCorrelations(symbols, resolution = '1m', hours = 24) {
    try {
      const endTime = Date.now();
      const startTime = endTime - (hours * 60 * 60 * 1000);
      
      // Get price data for all symbols
      const priceData = {};
      for (const symbol of symbols) {
        const data = await this.getPriceHistory(symbol, resolution, hours);
        priceData[symbol] = data.map(d => d.price);
      }
      
      // Calculate correlation matrix
      const correlationMatrix = {};
      for (let i = 0; i < symbols.length; i++) {
        correlationMatrix[symbols[i]] = {};
        for (let j = 0; j < symbols.length; j++) {
          if (i === j) {
            correlationMatrix[symbols[i]][symbols[j]] = 1.0;
          } else {
            correlationMatrix[symbols[i]][symbols[j]] = this.calculateCorrelation(
              priceData[symbols[i]], 
              priceData[symbols[j]]
            );
          }
        }
      }
      
      // Store correlation matrix
      await this.redis.set('correlation:matrix', JSON.stringify(correlationMatrix));
      await this.redis.set('correlation:matrix:last_update', Date.now());
      
      return correlationMatrix;
    } catch (error) {
      console.error('❌ Error calculating correlations:', error.message);
      return {};
    }
  }

  calculateCorrelation(prices1, prices2) {
    if (prices1.length !== prices2.length || prices1.length < 2) {
      return 0;
    }
    
    const n = prices1.length;
    const sum1 = prices1.reduce((a, b) => a + b, 0);
    const sum2 = prices2.reduce((a, b) => a + b, 0);
    const sum1Sq = prices1.reduce((a, b) => a + b * b, 0);
    const sum2Sq = prices2.reduce((a, b) => a + b * b, 0);
    const sum12 = prices1.reduce((a, b, i) => a + b * prices2[i], 0);
    
    const numerator = n * sum12 - sum1 * sum2;
    const denominator = Math.sqrt((n * sum1Sq - sum1 * sum1) * (n * sum2Sq - sum2 * sum2));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  async getCorrelationMatrix() {
    try {
      const matrix = await this.redis.get('correlation:matrix');
      return matrix ? JSON.parse(matrix) : {};
    } catch (error) {
      console.error('❌ Error getting correlation matrix:', error.message);
      return {};
    }
  }

  async getStatistics(symbol, resolution = '1s', hours = 24) {
    try {
      const data = await this.getPriceHistory(symbol, resolution, hours);
      
      if (data.length === 0) {
        return null;
      }
      
      const prices = data.map(d => d.price);
      const returns = [];
      
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
      }
      
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      
      const returnMean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const returnVariance = returns.reduce((a, b) => a + Math.pow(b - returnMean, 2), 0) / returns.length;
      const returnStdDev = Math.sqrt(returnVariance);
      
      return {
        symbol,
        resolution,
        period: `${hours}h`,
        count: prices.length,
        current: prices[prices.length - 1],
        min: Math.min(...prices),
        max: Math.max(...prices),
        mean,
        stdDev,
        volatility: returnStdDev * Math.sqrt(252 * 24 * 60 * 60 / this.getResolutionMs(resolution)),
        skewness: this.calculateSkewness(returns),
        kurtosis: this.calculateKurtosis(returns)
      };
    } catch (error) {
      console.error(`❌ Error calculating statistics for ${symbol}:`, error.message);
      return null;
    }
  }

  calculateSkewness(returns) {
    if (returns.length < 3) return 0;
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const skewness = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 3), 0) / returns.length;
    return skewness;
  }

  calculateKurtosis(returns) {
    if (returns.length < 4) return 0;
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const kurtosis = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 4), 0) / returns.length;
    return kurtosis - 3; // Excess kurtosis
  }

  getResolutionMs(resolution) {
    const multipliers = {
      '1s': 1000,
      '1m': 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    return multipliers[resolution] || 1000;
  }

  async cleanup() {
    try {
      console.log('🧹 Cleaning up old data...');
      
      // Clean up data older than retention policies
      for (const [resolution, retention] of Object.entries(this.retentionPolicies)) {
        const cutoffTime = Date.now() - (retention * 1000);
        
        const dataTypes = ['price', 'volume', 'spread', 'sentiment'];
        for (const dataType of dataTypes) {
          const key = `${dataType}:${resolution}`;
          
          // Delete old data (Redis TimeSeries handles this automatically, but we can force cleanup)
          await this.redis.ts.del(key, 0, cutoffTime);
        }
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
    }
  }

  async getStatus() {
    try {
      const info = await this.redis.info();
      const memory = await this.redis.memory('usage');
      
      return {
        connected: this.redis.status === 'ready',
        memory: memory,
        keyspace: await this.getKeyspaceInfo(),
        timeSeries: await this.getTimeSeriesInfo()
      };
    } catch (error) {
      console.error('❌ Error getting Redis status:', error.message);
      return { connected: false, error: error.message };
    }
  }

  async getKeyspaceInfo() {
    try {
      const info = await this.redis.info('keyspace');
      return info;
    } catch (error) {
      return 'Unable to get keyspace info';
    }
  }

  async getTimeSeriesInfo() {
    try {
      const keys = await this.redis.keys('*:*:*');
      const timeSeriesKeys = keys.filter(key => key.includes(':1s:') || key.includes(':1m:') || key.includes(':1h:'));
      
      return {
        totalKeys: timeSeriesKeys.length,
        keysByResolution: {
          '1s': timeSeriesKeys.filter(key => key.includes(':1s:')).length,
          '1m': timeSeriesKeys.filter(key => key.includes(':1m:')).length,
          '1h': timeSeriesKeys.filter(key => key.includes(':1h:')).length
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async shutdown() {
    console.log('🔄 Shutting down Redis TimeSeries Service...');
    await this.redis.quit();
    console.log('✅ Redis TimeSeries Service shut down');
  }
}

module.exports = RedisTimeSeriesService; 