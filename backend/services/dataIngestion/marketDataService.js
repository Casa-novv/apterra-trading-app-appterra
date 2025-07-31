const WebSocket = require('ws');
const axios = require('axios');
const EventEmitter = require('events');
// const redis = require('../../utils/redisClient'); // Keep if other parts still use generic Redis (e.g., for caching current price)

/**
 * Real-Time Market Data Ingestion Service
 *
 * Handles dual-channel feed for live market data:
 * - WebSocket connections for tick-level data
 * - REST polling fallback on disconnects
 * - Supabase for high-frequency data storage (replacing Redis TimeSeries)
 * - Buffering and persistence for ML training
 */
class MarketDataIngestionService extends EventEmitter {
    // The constructor now accepts the SupabaseTimeSeriesService instance
    constructor(supabaseTimeSeriesService) {
        super();

        if (!supabaseTimeSeriesService) {
            console.error('❌ SupabaseTimeSeriesService instance not provided to MarketDataIngestionService.');
            // This service will be severely limited without it.
        }
        this.timeSeriesService = supabaseTimeSeriesService; // Store the Supabase service

        this.websocketConnections = new Map();
        this.fallbackPolling = new Map();
        this.circuitBreakers = new Map();
        this.dataBuffers = new Map();
        this.isInitialized = false;

        // Configuration
        this.config = {
            websocketReconnectDelay: 5000,
            pollingInterval: 5000, // MODIFIED: Increased polling interval to 5 seconds to reduce API rate limit issues
            bufferSize: 1000,
            maxRetries: 3,
            circuitBreakerThreshold: 5
        };

        // Define symbols for Alpha Vantage polling (Forex and Stocks)
        // This list should ideally be consistent with TRADING_ASSETS defined in app.js
        this.alphaVantageSymbols = {
            forex: ['EURUSD', 'GBPUSD', 'USDJPY'], // Explicitly list forex pairs
            stocks: ['AAPL', 'GOOGL', 'TSLA']
        };

        // Define symbols for Twelve Data polling (Commodities)
        this.twelveDataSymbols = ['GOLD', 'OIL', 'SILVER'];

        // Define symbols for News API sentiment polling
        this.newsSentimentSymbols = ['BTC', 'ETH', 'AAPL', 'TSLA'];


        this.setupEventHandlers();
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Market Data Ingestion Service...');

            // This is now handled by the injected SupabaseTimeSeriesService
            if (this.timeSeriesService && !this.timeSeriesService.isInitialized) {
                await this.timeSeriesService.initialize(); // Ensure the Supabase service is initialized
            }

            // Initialize WebSocket connections
            await this.initializeConnections();

            // Start fallback polling for critical assets
            this.startFallbackPolling();

            this.isInitialized = true;
            console.log('✅ Market Data Ingestion Service initialized');

            this.emit('initialized');

        } catch (error) {
            console.error('❌ Failed to initialize Market Data Ingestion Service:', error.message);
            throw error; // Re-throw to propagate the error up to app.js
        }
    }

    async initializeConnections() {
        console.log('🔌 Initializing WebSocket connections...');

        // Initialize connections for different asset types
        await this.connectBinanceWebSocket();
        await this.connectAlphaVantageStream(); // This now uses the updated polling logic
        await this.connectNewsStream(); // This will need to be updated to store sentiment in Supabase

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
                    // Binance sends individual ticker updates, not always an array for single streams
                    const processedTickers = Array.isArray(tickers) ? tickers : [tickers]; 
                    await this.processBinanceTickers(processedTickers);
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
            console.log('🔌 Connecting to Alpha Vantage stream (via polling)...');

            // Start polling for stocks
            for (const symbol of this.alphaVantageSymbols.stocks) {
                this.startSymbolPolling(symbol, 'alphavantage');
            }
            // Start polling for forex
            for (const symbol of this.alphaVantageSymbols.forex) {
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

                // Store in Supabase TimeSeries via the injected service
                await this.timeSeriesService.storeTick(tick.symbol, tick); // Pass symbol and tick data

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

    // Renamed from storeTick to persistTick to avoid confusion with SupabaseTimeSeriesService.storeTick
    async persistTick(tick) {
        // This method now simply calls the injected timeSeriesService
        if (this.timeSeriesService) {
            try {
                await this.timeSeriesService.storeTick(tick.symbol, tick);
            } catch (error) {
                console.error(`❌ Error persisting tick for ${tick.symbol} to Supabase:`, error.message);
            }
        } else {
            console.warn(`⚠️ SupabaseTimeSeriesService not available to persist tick for ${tick.symbol}.`);
        }
    }

    // Removed aggregateToMinute - this aggregation logic should ideally be handled
    // by Supabase SQL functions/views or a separate background job that processes raw data
    // and writes aggregated data to the `market_data` table with a different `resolution`.
    // For now, the `storeTick` in SupabaseTimeSeriesService will just store '1s' data.
    // If you need minute/hour data, you'll query the 1s data and aggregate on the fly,
    // or implement a separate aggregation process.

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

        let url;
        // Check if it's a known Forex pair
        if (this.alphaVantageSymbols.forex.includes(symbol)) {
            const base = symbol.slice(0, 3);
            const quote = symbol.slice(3, 6);
            url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${base}&to_currency=${quote}&apikey=${process.env.ALPHA_VANTAGE_KEY}`;
        }
        // Check if it's a known Stock symbol
        else if (this.alphaVantageSymbols.stocks.includes(symbol)) {
            url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_KEY}`;
        } else {
            // This case should ideally not be hit if symbols are managed well
            throw new Error(`Unsupported symbol format or not configured for Alpha Vantage: ${symbol}`);
        }

        const response = await axios.get(url, { timeout: 5000 });

        // Alpha Vantage API responses can sometimes contain an 'Error Message' or 'Note' field
        if (response.data['Error Message'] || response.data['Note']) {
            console.warn(`⚠️ Alpha Vantage API warning/error for ${symbol}: ${response.data['Error Message'] || response.data['Note']}`);
            return null; // Return null to indicate no valid data
        }

        if (this.alphaVantageSymbols.forex.includes(symbol)) {
            const rate = response.data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
            return rate ? parseFloat(rate) : null;
        } else if (this.alphaVantageSymbols.stocks.includes(symbol)) {
            const price = response.data['Global Quote']?.['05. price'];
            return price ? parseFloat(price) : null;
        }

        return null; // Should not be reached if logic is sound
    }

    async fetchTwelveDataData(symbol) {
        if (!process.env.TWELVE_DATA_KEY) {
            throw new Error('Twelve Data API key not configured');
        }

        const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_KEY}`;
        const response = await axios.get(url, { timeout: 5000 });

        // Twelve Data also sends 'code' and 'message' for errors
        if (response.data.code && response.data.message) {
            console.warn(`⚠️ Twelve Data API warning/error for ${symbol}: ${response.data.message} (Code: ${response.data.code})`);
            return null;
        }

        return response.data.price ? parseFloat(response.data.price) : null;
    }

    async processPolledData(symbol, price, source) {
        const tick = {
            symbol,
            price,
            volume: 0, // Not available from polling, or needs to be fetched separately
            timestamp: Date.now(),
            bid: price,
            ask: price,
            spread: 0,
            source
        };

        await this.persistTick(tick); // Use the new persistTick method
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
            // Use the predefined list of news sentiment symbols
            for (const symbol of this.newsSentimentSymbols) {
                const sentiment = await this.fetchNewsSentiment(symbol);
                if (sentiment !== null) {
                    // Store sentiment in Supabase via the injected service
                    await this.timeSeriesService.storeTick(symbol, { sentiment, timestamp: Date.now() });
                    this.emit('sentimentData', { symbol, sentiment });
                }
            }
        } catch (error) {
            console.error('❌ Error updating news sentiment:', error.message);
        }
    }

    async fetchNewsSentiment(symbol) {
        try {
            if (!process.env.NEWS_API_KEY) {
                console.warn('⚠️ NEWS_API_KEY not configured. Skipping news sentiment fetch.');
                return null;
            }

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

    /**
     * Retrieves recent data using the SupabaseTimeSeriesService.
     * @param {string} symbol
     * @param {string} resolution
     * @param {number} count
     * @returns {Array<Object>}
     */
    async getRecentData(symbol, resolution = '1s', count = 1000) {
        if (!this.timeSeriesService) {
            console.warn('⚠️ SupabaseTimeSeriesService not available. Cannot get recent data.');
            return [];
        }
        return this.timeSeriesService.getRecentData(symbol, 'price', resolution, count); // Assuming it fetches 'price' data
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
        // Start polling for commodities using Twelve Data
        this.twelveDataSymbols.forEach(symbol => {
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

        if (this.timeSeriesService && typeof this.timeSeriesService.shutdown === 'function') {
            await this.timeSeriesService.shutdown();
        }

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
            ),
            timeSeriesServiceStatus: this.timeSeriesService ? this.timeSeriesService.getStatus() : 'Not Provided'
        };
    }
}

module.exports = MarketDataIngestionService;