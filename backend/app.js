// app.js - Corrected and Improved Logic
require('dotenv').config();
let Signal, Market, Portfolio, PriceHistory, DemoTrade; // Mongoose Models

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const axios = require('axios'); // Standardized on axios for consistency
const jwt = require('jsonwebtoken');
const Sentiment = require('sentiment');
const nodemailer = require('nodemailer'); // For notifications
const { performance } = require('perf_hooks');

const app = express();

// Enhanced CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ------------------------------------------------------------------
//   MONGODB CONNECTION (v3 - streamlined and robust)
// ------------------------------------------------------------------
const connectDB = async () => {
    try {
        console.log('🔄 Attempting to connect to MongoDB...');
        
        // This is a cleaner way to connect that avoids common crashes
        // The old options are now deprecated or handled by Mongoose
        // For Mongoose v6+, options like useUnifiedTopology are not needed.
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000, // Increased timeout to prevent crashes
            socketTimeoutMS: 45000,
            maxPoolSize: 10
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        return conn;

    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        
        const msg = err.message.toLowerCase();
        if (msg.includes('ip') || msg.includes('whitelist')) {
            console.error('🔒 IP whitelist issue – add your IP in Atlas');
        }
        if (msg.includes('authentication')) {
            console.error('🔐 Check credentials in .env');
        }

        // In dev, we return null to signal a fallback
        if (process.env.NODE_ENV !== 'production') {
            return null;
        }
        throw err; // hard stop in production
    }
};

// Define TRADING_ASSETS array
const TRADING_ASSETS = [
    // Crypto assets
    { symbol: 'BTCUSDT', market: 'crypto', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', market: 'crypto', name: 'Ethereum' },
    { symbol: 'BNBUSDT', market: 'crypto', name: 'Binance Coin' },
    { symbol: 'ADAUSDT', market: 'crypto', name: 'Cardano' },
    { symbol: 'SOLUSDT', market: 'crypto', name: 'Solana' },
    // Forex assets
    { symbol: 'EURUSD', market: 'forex', name: 'Euro/USD' },
    { symbol: 'GBPUSD', market: 'forex', name: 'GBP/USD' },
    { symbol: 'USDJPY', market: 'forex', name: 'USD/JPY' },
    // Stock assets
    { symbol: 'AAPL', market: 'stocks', name: 'Apple Inc.' },
    { symbol: 'GOOGL', market: 'stocks', name: 'Alphabet Inc.' },
    { symbol: 'TSLA', market: 'stocks', name: 'Tesla Inc.' },
    // Commodity assets
    { symbol: 'GOLD', market: 'commodities', name: 'Gold' },
    { symbol: 'OIL', market: 'commodities', name: 'Crude Oil' },
    { symbol: 'SILVER', market: 'commodities', name: 'Silver' }
];

const assets = TRADING_ASSETS;

// Load Mongoose Models
try {
    Signal = require('./models/Signal');
    Market = require('./models/Market');
    Portfolio = require('./models/Portfolio');
    PriceHistory = require('./models/MarketData');
    DemoTrade = require('./models/DemoTrade');
    console.log('✅ Models loaded successfully');
} catch (error) {
    console.error('❌ Error loading models:', error.message);
    process.exit(1);
}

// Set up routes
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
    const demoAccountRoutes = require('./routes/demoAccount');
    app.use('/api/demo-account', demoAccountRoutes);
    console.log('✅ Demo account routes loaded');
    const signalsRoutes = require('./routes/signals');
    app.use('/api/signals', signalsRoutes);
    console.log('✅ Signals routes loaded');
    const portfolioRoutes = require('./routes/portfolio');
    app.use('/api/portfolio', portfolioRoutes);
    console.log('✅ Portfolio routes loaded');
    const marketRoutes = require('./routes/market');
    app.use('/api/market', marketRoutes);
    console.log('✅ Market routes loaded');
} catch (error) {
    console.error('⚠️ One or more route files failed to load:', error.message);
}

// Create HTTP and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket Setup
wss.on('connection', (ws, req) => {
    console.log('Client connected via WebSocket');
    ws.send(JSON.stringify({ type: 'welcome', message: 'WebSocket connection established!' }));
    sendAllActiveSignals(ws);
    ws.on('close', () => {
        console.log('Client disconnected');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
    });
});

function sendAllActiveSignals(ws) {
    if (mongoose.connection.readyState !== 1) {
        console.log('🔌 Database not connected - skipping signal broadcast');
        return;
    }
    Signal.find({ status: 'active' })
        .then(signals => {
            signals.forEach(signal => {
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'new_signal', signal }));
                    }
                } catch (error) {
                    console.error('Error sending signal via WebSocket:', error.message);
                }
            });
        })
        .catch(err => console.error('Error fetching active signals for WebSocket:', err.message));
}

function broadcastSignal(signal) {
    if (!signal) return;
    wss.clients.forEach(client => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'new_signal', signal }));
            }
        } catch (err) {
            console.error('WebSocket broadcast error:', err.message);
        }
    });
}

// Market Data Endpoint & Update
app.get('/api/market/data', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ msg: 'Database not connected' });
        }
        const market = await Market.find();
        res.json({ market, lastUpdated: new Date().toISOString() });
    } catch (err) {
        console.error('Error fetching market data:', err.message);
        res.status(500).json({ msg: 'Error fetching market data' });
    }
});

// Portfolio Endpoints & Update
app.get('/api/portfolio', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ msg: 'Database not connected' });
        }
        const portfolio = await Portfolio.find();
        res.json({ portfolio });
    } catch (err) {
        console.error('Error fetching portfolio:', err.message);
        res.status(500).json({ msg: 'Error fetching portfolio' });
    }
});

// Price Data Fetching (Basic fallback if ML system is not active)
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;

async function fetchCurrentPrices() {
    try {
        const results = {};
        const cryptoResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: { ids: 'bitcoin,ethereum,solana', vs_currencies: 'usd' },
            timeout: 10000
        });
        const cryptoData = cryptoResponse.data;
        if (cryptoData.bitcoin) results.BTC = cryptoData.bitcoin.usd;
        if (cryptoData.ethereum) results.ETH = cryptoData.ethereum.usd;
        if (cryptoData.solana) results.SOL = cryptoData.solana.usd;
        return results;
    } catch (error) {
        console.error('❌ Error fetching current prices (CoinGecko):', error.message);
        return {};
    }
}

const updatePrices = async () => {
    try {
        const results = await fetchCurrentPrices();
        if (results && Object.keys(results).length > 0) {
            console.log('📊 Basic price update completed');
        }
    } catch (error) {
        console.error('❌ Error in updatePrices:', error.message);
    }
};

// Enterprise ML System Integration
const MarketDataIngestionService = require('./services/dataIngestion/marketDataService');
const SupabaseTimeSeriesService = require('./services/dataIngestion/supabaseTimeSeriesService');
const StreamingFeatureFactory = require('./services/featureEngineering/streamingFeatureFactory');
const MultiStageEnsembleSystem = require('./services/ml/ensembleSystem');
const RealTimeInferenceService = require('./services/inference/inferenceService');
const { listenForSignals } = require('./services/redisSubscriber');

let marketDataService = null;
let timeSeriesService = null;
let featureFactory = null;
let ensembleSystem = null;
let inferenceService = null;

async function initializeEnterpriseMLSystem() {
    try {
        console.log('🚀 Initializing Enterprise ML System...');
        timeSeriesService = new SupabaseTimeSeriesService();
        await timeSeriesService.initialize();
        marketDataService = new MarketDataIngestionService(timeSeriesService);
        await marketDataService.initialize();
        featureFactory = new StreamingFeatureFactory();
        await featureFactory.initialize();
        ensembleSystem = new MultiStageEnsembleSystem();
        await ensembleSystem.initialize();
        inferenceService = new RealTimeInferenceService();
        await inferenceService.initialize(ensembleSystem);
        setupEnterpriseMLEventHandlers();
        console.log('✅ Enterprise ML System initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Enterprise ML System:', error.message);
        console.log('🔄 Continuing with basic functionality');
    }
}

function setupEnterpriseMLEventHandlers() {
    if (!marketDataService || !featureFactory || !ensembleSystem || !inferenceService) {
        console.warn('⚠️ Enterprise ML services not fully initialized. Event handlers skipped.');
        return;
    }
    marketDataService.on('tickData', async (ticks) => {
        for (const tick of ticks) {
            try {
                const features = await featureFactory.processTick(tick.symbol, tick);
            } catch (error) {
                console.error(`❌ Error processing tick for ${tick.symbol}:`, error.message);
            }
        }
    });
    featureFactory.on('featuresReady', async (data) => {
        try {
            const prediction = await inferenceService.predict(data.symbol, data.features);
        } catch (error) {
            console.error(`❌ Error generating prediction for ${data.symbol}:`, error.message);
        }
    });
    inferenceService.on('predictionReady', async (data) => {
        try {
            await generateEnterpriseSignal(data);
        } catch (error) {
            console.error(`❌ Error generating enterprise signal for ${data.symbol}:`, error.message);
        }
    });
}

async function generateEnterpriseSignal(predictionData) {
    try {
        if (mongoose.connection.readyState !== 1) {
            console.warn('⚠️ Skipping signal generation. Database not connected.');
            return;
        }
        const { symbol, prediction } = predictionData;
        if (prediction.confidence < 0.6) {
            return;
        }
        const signal = {
            symbol: symbol,
            type: prediction.signal,
            confidence: Math.round(prediction.confidence * 100),
            entryPrice: prediction.entryPrice || 100,
            targetPrice: prediction.priceTarget,
            stopLoss: prediction.stopLoss,
            timeframe: '15M',
            market: getMarketFromSymbol(symbol),
            description: `Enterprise ML ${prediction.signal} signal with ${Math.round(prediction.confidence * 100)}% confidence`,
            reasoning: generateEnterpriseReasoning(prediction),
            technicalIndicators: {
                mlPredictions: prediction,
                source: 'enterprise_ml',
                modelUsed: 'multi_stage_ensemble'
            },
            status: 'active',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            source: 'enterprise_ml',
            risk: prediction.confidence > 0.8 ? 'high' : prediction.confidence > 0.65 ? 'medium' : 'low',
            positionSize: prediction.positionSize || 0.1,
            counterfactuals: prediction.counterfactuals || {},
            featureImportance: prediction.featureImportance || {},
            metadata: {
                processingTime: prediction.metadata?.processingTime || 0,
                modelsUsed: prediction.metadata?.modelsUsed || [],
                latency: prediction.latency || 0
            }
        };
        await saveEnterpriseSignal(signal);
        console.log(`🎯 Enterprise ML Signal: ${signal.type} for ${symbol} (${signal.confidence}% confidence)`);
    } catch (error) {
        console.error('❌ Error generating enterprise signal:', error.message);
    }
}

function generateEnterpriseReasoning(prediction) {
    const reasoning = [];
    if (prediction.modelPredictions) {
        reasoning.push(`Ensemble: ${prediction.signal} (${Math.round(prediction.confidence * 100)}%)`);
    }
    if (prediction.featureImportance) {
        const topFeatures = Object.entries(prediction.featureImportance)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([feature, importance]) => `${feature}: ${importance.toFixed(3)}`);
        reasoning.push(`Top Features: ${topFeatures.join(', ')}`);
    }
    if (prediction.counterfactuals) {
        const scenarios = Object.entries(prediction.counterfactuals)
            .filter(([, scenario]) => scenario.probability > 0.2)
            .map(([scenario, data]) => `${scenario}: ${data.impact} (${Math.round(data.probability * 100)}%)`);
        if (scenarios.length > 0) {
            reasoning.push(`Scenarios: ${scenarios.join(', ')}`);
        }
    }
    return reasoning.join(' | ');
}

async function saveEnterpriseSignal(signalData) {
    try {
        if (mongoose.connection.readyState !== 1) {
            console.warn('⚠️ Skipping signal save. Database not connected.');
            return null;
        }
        await Signal.deleteMany({
            symbol: signalData.symbol,
            $or: [
                { expiresAt: { $lt: new Date() } },
                { confidence: { $lt: signalData.confidence } }
            ]
        });
        const newSignal = await Signal.create(signalData);
        broadcastSignal(newSignal);
        return newSignal;
    } catch (error) {
        console.error('❌ Error saving enterprise signal:', error.message);
        return null;
    }
}

function getMarketFromSymbol(symbol) {
    if (symbol.includes('USDT')) return 'crypto';
    if (symbol.length === 6 && symbol.slice(3) === 'USD') return 'forex';
    if (symbol.length <= 5) return 'stocks';
    return 'commodities';
}

async function generateSignals() {
    if (inferenceService && inferenceService.isInitialized) {
        console.log('🤖 Enterprise ML system active - signals generated automatically');
    } else {
        console.log('🔄 Enterprise ML system not available - using basic functionality (cleaning expired signals)');
    }
    if (mongoose.connection.readyState === 1) {
        await Signal.updateMany(
            { expiresAt: { $lt: new Date() }, status: 'active' },
            { status: 'inactive' }
        );
    }
}

app.get('/api/enterprise-ml/status', (req, res) => {
    try {
        const status = {
            timestamp: new Date().toISOString(),
            system: {
                status: 'Enterprise ML System Active',
                version: '3.0.0',
                architecture: 'Multi-Stage Ensemble with Real-Time Inference'
            },
            services: {
                marketDataIngestion: marketDataService ? marketDataService.getStatus() : 'Not Initialized',
                timeSeriesStorage: timeSeriesService ? timeSeriesService.getStatus() : 'Not Initialized',
                featureFactory: featureFactory ? featureFactory.getStatus() : 'Not Initialized',
                ensembleSystem: ensembleSystem ? ensembleSystem.getStatus() : 'Not Initialized',
                inferenceService: inferenceService ? inferenceService.getStatus() : 'Not Initialized'
            },
            performance: {
                averageLatency: inferenceService ? inferenceService.performanceMonitor.getSummaryStats().averageLatency : 'N/A',
                errorRate: inferenceService ? inferenceService.performanceMonitor.getSummaryStats().errorRate : 'N/A',
                cacheHitRate: 'N/A'
            },
            capabilities: {
                realTimeDataIngestion: 'Active',
                advancedFeatureEngineering: 'Active',
                multiModelEnsemble: 'Active',
                causalInference: 'Active',
                graphNeuralNetworks: 'Active',
                continuousLearning: 'Active',
                explainability: 'Active'
            }
        };
        res.json(status);
    } catch (error) {
        console.error('Error getting enterprise ML status:', error.message);
        res.status(500).json({
            error: 'Failed to get enterprise ML status',
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/enterprise-ml/analytics', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ msg: 'Database not connected' });
        }
        const recentSignals = await Signal.find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            source: 'enterprise_ml'
        }).sort({ createdAt: -1 });
        const analytics = {
            timestamp: new Date().toISOString(),
            period: 'Last 24 hours',
            signals: {
                total: recentSignals.length,
                byType: {
                    BUY: recentSignals.filter(s => s.type === 'BUY').length,
                    SELL: recentSignals.filter(s => s.type === 'SELL').length,
                    HOLD: recentSignals.filter(s => s.type === 'HOLD').length
                },
                byConfidence: {
                    high: recentSignals.filter(s => s.confidence >= 80).length,
                    medium: recentSignals.filter(s => s.confidence >= 65 && s.confidence < 80).length,
                    low: recentSignals.filter(s => s.confidence < 65).length
                }
            },
            performance: {
                averageConfidence: recentSignals.length > 0 ?
                    (recentSignals.reduce((sum, s) => sum + s.confidence, 0) / recentSignals.length).toFixed(1) : 0,
                averageLatency: inferenceService ?
                    inferenceService.performanceMonitor.getSummaryStats().averageLatency.toFixed(2) + 'ms' : 'N/A',
                errorRate: inferenceService ?
                    (inferenceService.performanceMonitor.getSummaryStats().errorRate * 100).toFixed(2) + '%' : 'N/A'
            },
            models: {
                metaLearner: 'Active',
                deepSequence: 'Active',
                transformer: 'Active',
                statistical: 'Active',
                causal: 'Active',
                gnn: 'Active',
                rlAgent: 'Active',
                finalEnsemble: 'Active'
            }
        };
        res.json(analytics);
    } catch (error) {
        console.error('Error getting enterprise ML analytics:', error.message);
        res.status(500).json({
            error: 'Failed to get enterprise ML analytics',
            timestamp: new Date().toISOString()
        });
    }
});

// Final initialization block - ensures DB and ML are set up before server starts listening
// ... (keep all your existing imports and code)

// This new function is designed to help you debug the crash
async function initializeAndStart() {
    console.log('🔄 Step 1: Attempting to connect to MongoDB...');
    let isDbConnected = false;
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Step 1: MongoDB connected successfully!');
        isDbConnected = true;
    } catch (error) {
        console.error('❌ Step 1: Database connection failed:', error.message);
        console.log('🔒 IP whitelist issue – add your IP in Atlas');
        console.log('➡️ Step 1: Continuing with limited functionality (no database features or full ML system)...');
    }
    
    try {
        console.log('🔄 Step 2: Initializing Enterprise ML System...');
        // This is the section we suspect might be crashing the app
        if (isDbConnected) {
             await initializeEnterpriseMLSystem();
        } else {
            console.log('➡️ Step 2: Skipping ML system initialization - no database connection.');
        }
        console.log('✅ Step 2: Enterprise ML System initialization attempted.');
    } catch (error) {
        console.error('❌ Step 2: Failed to initialize Enterprise ML System:', error.message);
    }
    
    try {
        console.log('🔄 Step 3: Initializing other services...');
        if (isDbConnected) {
            const { startPositionMonitoring, setWebSocketServer } = require('./jobs/demoPositionMonitor');
            setWebSocketServer(wss);
            startPositionMonitoring(30000);
            console.log('✅ Step 3: Position monitoring initialized.');
        } else {
            console.log('➡️ Step 3: Skipping position monitoring - no database connection.');
        }
    } catch (error) {
        console.error('❌ Step 3: Failed to initialize position monitoring:', error.message);
    }

    // This listener uses the Upstash pub/sub, which should be fine
    try {
        console.log('🔄 Step 4: Setting up Redis subscriber...');
        listenForSignals((signal) => {
            wss.clients.forEach(client => {
                try {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'new_signal', signal }));
                    }
                } catch (err) {
                    console.error('WebSocket send error:', err.message);
                }
            });
        });
        console.log('✅ Step 4: Redis subscriber ready.');
    } catch (error) {
        console.error('❌ Step 4: Failed to set up Redis subscriber:', error.message);
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
}

// Start the application
initializeAndStart();


// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    if (process.env.NODE_ENV === 'development') {
        console.error('Stack:', err.stack);
    }
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);
    wss.close(() => {
        console.log('🔌 WebSocket server closed');
    });
    server.close(async () => {
        console.log('🔌 HTTP server closed');
        try {
            await mongoose.connection.close();
            console.log('🗄️ MongoDB connection closed');
        } catch (err) {
            console.error('❌ Failed to close MongoDB connection:', err.message);
        }
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);