// backend/services/dataIngestion/supabaseTimeSeriesService.js
const supabase = require('../supabaseClient'); // Assuming this path

/**
 * Supabase TimeSeries Service
 *
 * Handles high-frequency data storage and retrieval using Supabase (PostgreSQL tables):
 * - Stores data in a structured SQL table (`market_data`).
 * - Supports various resolutions by filtering `resolution` column.
 * - Efficient querying and aggregation using SQL.
 * - Cross-asset correlation analysis (computed on retrieval or periodically).
 */
class SupabaseTimeSeriesService {
    constructor() {
        this.supabase = supabase;
        this.isInitialized = false;
        this.tableName = 'market_data'; // Your Supabase table name for time-series data
        // Note: Retention and compression are handled by Supabase table design (e.g., partitioning, custom retention jobs)
        // rather than explicit Redis TimeSeries module commands.
    }

    async initialize() {
        if (!this.supabase) {
            console.error('❌ Supabase client not initialized. TimeSeries Service will be non-functional.');
            return;
        }

        try {
            console.log('📊 Initializing Supabase TimeSeries Service...');

            // Basic check to see if the table exists and is accessible
            const { data, error } = await this.supabase.from(this.tableName).select('id').limit(1);

            if (error) {
                console.error(`❌ Error accessing Supabase table '${this.tableName}':`, error.message);
                throw new Error(`Supabase table '${this.tableName}' access failed. Ensure it exists and permissions are correct.`);
            }

            console.log(`✅ Supabase connection to table '${this.tableName}' established.`);
            this.isInitialized = true;
            console.log('✅ Supabase TimeSeries Service initialized');

        } catch (error) {
            console.error('❌ Failed to initialize Supabase TimeSeries Service:', error.message);
            // Don't re-throw if it means the whole app crashes. Let app.js decide if it's critical.
        }
    }

    /**
     * Stores a new tick of market data into Supabase.
     * Maps the different data types (price, volume, sentiment, spread) into a single row.
     * @param {string} symbol - The trading asset symbol (e.g., 'BTCUSDT').
     * @param {object} data - The tick data object.
     * @param {number} data.price - The price.
     * @param {number} [data.volume] - The volume.
     * @param {number} [data.spread] - The spread.
     * @param {number} [data.sentiment] - The sentiment.
     * @param {number} [data.timestamp] - The timestamp in milliseconds. Defaults to Date.now().
     */
    async storeTick(symbol, data) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase TimeSeries Service not initialized. Skipping storeTick.');
            return false;
        }

        const timestamp = data.timestamp || Date.now();
        const timestampISO = new Date(timestamp).toISOString(); // Convert to ISO string for Supabase

        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .insert([
                    {
                        symbol: symbol,
                        timestamp: timestampISO,
                        price: data.price,
                        volume: data.volume || null,
                        spread: data.spread || null,
                        sentiment: data.sentiment || null,
                        resolution: '1s' // Store as 1-second resolution
                    }
                ]);

            if (error) {
                console.error(`❌ Error storing tick for ${symbol} in Supabase:`, error.message);
                return false;
            }

            // For quick access to current price, you could still use Upstash Redis as a key-value cache
            // const redis = require('../../utils/redisClient'); // Assuming you still have a general Redis client for Upstash
            // if (redis) {
            //     await redis.set(`price:current:${symbol}`, data.price);
            //     await redis.set(`price:last_update:${symbol}`, timestamp);
            // }

            return true;
        } catch (error) {
            console.error(`❌ Unexpected error storing tick for ${symbol} in Supabase:`, error.message);
            return false;
        }
    }

    /**
     * Retrieves recent time-series data for a symbol.
     * @param {string} symbol - The trading asset symbol.
     * @param {string} dataType - The type of data ('price', 'volume', 'spread', 'sentiment').
     * @param {string} resolution - The desired data resolution ('1s', '1m', '1h', '1d').
     * @param {number} count - The number of data points to retrieve.
     * @returns {Array<Object>} An array of data points { timestamp, value }.
     */
    async getRecentData(symbol, dataType = 'price', resolution = '1s', count = 1000) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase TimeSeries Service not initialized. Skipping getRecentData.');
            return [];
        }
        
        // Calculate the approximate start time based on count and resolution
        const resolutionMs = this.getResolutionMs(resolution);
        const startTime = new Date(Date.now() - (count * resolutionMs)).toISOString();

        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select(`timestamp, ${dataType}`) // Select timestamp and the requested data type
                .eq('symbol', symbol)
                .eq('resolution', resolution) // Filter by resolution
                .gte('timestamp', startTime) // Filter by start time
                .order('timestamp', { ascending: false }) // Get most recent first
                .limit(count); // Limit the number of results

            if (error) {
                console.error(`❌ Error getting recent ${dataType} data for ${symbol} from Supabase:`, error.message);
                return [];
            }

            return data.map(d => ({
                timestamp: new Date(d.timestamp).getTime(), // Convert ISO string to milliseconds
                value: parseFloat(d[dataType]) // Ensure it's a float
            })).reverse(); // Reverse to get chronological order if needed
        } catch (error) {
            console.error(`❌ Unexpected error getting recent data for ${symbol} from Supabase:`, error.message);
            return [];
        }
    }

    /**
     * Retrieves the current price for a symbol.
     * This method might still benefit from a Redis cache (Upstash) for performance,
     * but can also be retrieved directly from Supabase.
     * @param {string} symbol - The trading asset symbol.
     * @returns {number|null} The current price or null if not found.
     */
    async getCurrentPrice(symbol) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase TimeSeries Service not initialized. Skipping getCurrentPrice.');
            return null;
        }

        // Option 1: Try to get from Upstash Redis (if you implement a separate caching layer)
        // const redis = require('../../utils/redisClient');
        // if (redis) {
        //     try {
        //         const cachedPrice = await redis.get(`price:current:${symbol}`);
        //         if (cachedPrice) return parseFloat(cachedPrice);
        //     } catch (cacheError) {
        //         console.warn(`Could not fetch current price from Redis cache for ${symbol}:`, cacheError.message);
        //     }
        // }

        // Option 2: Fetch directly from Supabase (slower but guaranteed consistency)
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('price')
                .eq('symbol', symbol)
                .eq('resolution', '1s') // Assuming current price is always '1s' resolution
                .order('timestamp', { ascending: false })
                .limit(1);

            if (error) {
                console.error(`❌ Error getting current price for ${symbol} from Supabase:`, error.message);
                return null;
            }

            return data.length > 0 ? parseFloat(data[0].price) : null;
        } catch (error) {
            console.error(`❌ Unexpected error getting current price for ${symbol} from Supabase:`, error.message);
            return null;
        }
    }

    /**
     * Retrieves price history for a symbol over a specific duration.
     * @param {string} symbol - The trading asset symbol.
     * @param {string} resolution - The desired data resolution ('1s', '1m', '1h', '1d').
     * @param {number} hours - The number of hours back to retrieve data.
     * @returns {Array<Object>} An array of price history objects { timestamp, price }.
     */
    async getPriceHistory(symbol, resolution = '1s', hours = 24) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase TimeSeries Service not initialized. Skipping getPriceHistory.');
            return [];
        }

        const endTime = Date.now();
        const startTime = endTime - (hours * 60 * 60 * 1000); // Calculate start time in milliseconds
        const startTimeISO = new Date(startTime).toISOString();

        try {
            // For aggregation to higher resolutions, it's generally better to query the highest resolution
            // data (e.g., '1s' or '1m') and then aggregate in application logic if Supabase views/functions
            // aren't set up for on-the-fly aggregation.
            // For simplicity, this will query for the requested resolution.
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('timestamp, price')
                .eq('symbol', symbol)
                .eq('resolution', resolution)
                .gte('timestamp', startTimeISO)
                .order('timestamp', { ascending: true }); // Chronological order

            if (error) {
                console.error(`❌ Error getting price history for ${symbol} from Supabase:`, error.message);
                return [];
            }

            return data.map(d => ({
                timestamp: new Date(d.timestamp).getTime(),
                price: parseFloat(d.price)
            }));
        } catch (error) {
            console.error(`❌ Unexpected error getting price history for ${symbol} from Supabase:`, error.message);
            return [];
        }
    }

    /**
     * Aggregates data from one resolution to another.
     * This functionality will be more complex with Supabase.
     * You might need:
     * 1. Supabase SQL functions/views for on-the-fly aggregation.
     * 2. A periodic background job that reads 1s data and writes aggregated 1m, 1h, 1d data to the table.
     * For now, this is a placeholder. Implementing true aggregation via Supabase requires more specific SQL.
     */
    async aggregateData(symbol, fromResolution, toResolution, startTime, endTime) {
        console.warn('⚠️ aggregateData method is a placeholder. Real-time aggregation needs specific Supabase SQL or a background job.');
        if (!this.isInitialized) {
            return [];
        }

        // Example: If you wanted to fetch 1s data and aggregate in Node.js (less efficient for large datasets)
        const rawData = await this.getPriceHistory(symbol, fromResolution, (endTime - startTime) / (60 * 60 * 1000));
        
        // This is where you'd implement your aggregation logic (e.g., calculate OHLCV for 1m bars from 1s ticks)
        // For simplicity, returning raw data for now.
        return rawData;
    }


    /**
     * Calculates correlations between symbols based on their price history.
     * This remains a client-side calculation based on fetched data.
     * @param {string[]} symbols - An array of trading asset symbols.
     * @param {string} resolution - The resolution of data to use for correlation.
     * @param {number} hours - The number of hours of history to use.
     * @returns {Object} A correlation matrix.
     */
    async calculateCorrelations(symbols, resolution = '1m', hours = 24) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase TimeSeries Service not initialized. Skipping calculateCorrelations.');
            return {};
        }

        console.log('🔗 Calculating correlations (Supabase data-backed)...');
        const priceData = {};
        for (const symbol of symbols) {
            // Fetch relevant data from Supabase
            const data = await this.getPriceHistory(symbol, resolution, hours);
            priceData[symbol] = data.map(d => d.price);
        }

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

        // You could still cache this matrix in Upstash Redis if it's frequently accessed
        // const redis = require('../../utils/redisClient');
        // if (redis) {
        //     await redis.set('correlation:matrix', JSON.stringify(correlationMatrix));
        //     await redis.set('correlation:matrix:last_update', Date.now());
        // }

        return correlationMatrix;
    }

    // Helper for correlation calculation - remains the same
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

    /**
     * Retrieves the stored correlation matrix (if cached).
     * @returns {Object} The correlation matrix.
     */
    async getCorrelationMatrix() {
        // If you decide to cache in Upstash Redis, fetch from there.
        // Otherwise, you would re-calculate it or have a background job update it.
        console.warn('⚠️ getCorrelationMatrix might return stale data if not actively cached or re-calculated.');
        return {}; // Placeholder, as it's not directly stored in Supabase in this manner
    }

    /**
     * Calculates statistical properties of market data.
     * This remains a client-side calculation based on fetched data.
     * @param {string} symbol - The trading asset symbol.
     * @param {string} resolution - The resolution of data to use.
     * @param {number} hours - The number of hours of history to use.
     * @returns {Object|null} Statistical data or null if no data.
     */
    async getStatistics(symbol, resolution = '1s', hours = 24) {
        if (!this.isInitialized) {
            console.warn('⚠️ Supabase TimeSeries Service not initialized. Skipping getStatistics.');
            return null;
        }

        const data = await this.getPriceHistory(symbol, resolution, hours);

        if (data.length === 0) {
            return null;
        }

        const prices = data.map(d => d.price);
        const returns = [];

        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
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
    }

    // Helper for skewness - remains the same
    calculateSkewness(returns) {
        if (returns.length < 3) return 0;

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return 0;

        const skewness = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 3), 0) / returns.length;
        return skewness;
    }

    // Helper for kurtosis - remains the same
    calculateKurtosis(returns) {
        if (returns.length < 4) return 0;

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return 0;

        const kurtosis = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 4), 0) / returns.length;
        return kurtosis - 3; // Excess kurtosis
    }

    // Helper for resolution conversion - remains the same
    getResolutionMs(resolution) {
        const multipliers = {
            '1s': 1000,
            '1m': 60 * 1000,
            '1h': 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000
        };

        return multipliers[resolution] || 1000;
    }

    /**
     * This cleanup method for Supabase would typically involve:
     * - PostgreSQL partitioning: Define partition strategies on your `market_data` table based on `timestamp`
     * to manage data lifecycle more effectively.
     * - Database policies: Implement Row Level Security (RLS) if users should only see their own data.
     * - Background cron jobs: Use Supabase functions or external cron jobs to periodically delete old data.
     * This method in its current form from Redis TimeSeries doesn't directly translate.
     */
    async cleanup() {
        console.warn('⚠️ Cleanup method is a placeholder. Supabase data retention should be handled via database partitioning or cron jobs.');
        // Example: Delete data older than X days
        // const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString(); // 30 days
        // const { error } = await this.supabase
        //     .from(this.tableName)
        //     .delete()
        //     .lt('timestamp', cutoffDate);

        // if (error) {
        //     console.error('❌ Error during Supabase cleanup:', error.message);
        // } else {
        //     console.log('✅ Supabase cleanup initiated (if implemented)');
        // }
    }

    /**
     * Gets the status of the Supabase TimeSeries service.
     * @returns {Object} Status information.
     */
    async getStatus() {
        if (!this.isInitialized) {
            return { connected: false, error: 'Supabase client not initialized' };
        }
        try {
            // You might query Supabase for table size or row counts here.
            // For a simple status, just return initialization status.
            return {
                connected: this.isInitialized,
                tableName: this.tableName,
                message: 'Supabase TimeSeries Service is operational.'
                // You could add more detailed stats if you query Supabase system tables.
            };
        } catch (error) {
            console.error('❌ Error getting Supabase TimeSeries status:', error.message);
            return { connected: false, error: error.message };
        }
    }

    async shutdown() {
        console.log('🔄 Supabase TimeSeries Service shutdown (no explicit connection to close)');
        // Supabase client typically doesn't have a direct 'quit' or 'close' method like Redis.
        // It's stateless HTTP requests.
    }
}

module.exports = SupabaseTimeSeriesService;