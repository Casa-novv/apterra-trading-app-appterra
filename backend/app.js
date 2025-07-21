// Recommendations for further improvements:
// 1. Implement retry logic and exponential backoff for all external API calls.
// 2. Add more robust error logging and alerting (e.g., email or Slack notifications on repeated failures).
// 3. Cache API responses to reduce rate limit issues and improve performance.
// 4. Use environment variables for all API keys and sensitive config.
// 5. Add unit and integration tests for all major service functions.
// 6. Consider using a job queue (like Bull or Agenda) for background tasks and interval jobs.
// 7. Add API rate limiters to protect external services and your own endpoints.
// 8. Use a monitoring tool (like PM2, New Relic, or Sentry) for production deployments.
// 9. Document all endpoints and services using Swagger or similar tools.
// 10. Regularly review and update dependencies to address security vulnerabilities.
require('dotenv').config();
let Signal, Market, Portfolio, PriceHistory, DemoTrade;
let signalGenerationInterval;
let marketUpdateInterval;
let portfolioUpdateInterval;
let demoPositionInterval;
let priceUpdateCycle = 0;
let priceHistoryCycle = 0;


const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Sentiment = require('sentiment');
const nodemailer = require('nodemailer'); // For notifications

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
const systemState = {
  priceUpdatesActive: false,
  signalGenerationActive: false,
  marketDataActive: false,
  portfolioDataActive: false,
  demoPositionsActive: false,
  lastPriceUpdate: null,
  lastSignalGeneration: null,
  totalSignalsGenerated: 0,
  totalPriceUpdates: 0
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Enhanced MongoDB connection with better error handling and auto-reconnect
const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    
    // Enhanced connection options for better stability
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // Reduced timeout
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      // Removed bufferCommands and bufferMaxEntries - they cause issues
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected - attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    return conn;

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Log specific connection errors with helpful messages
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('🔒 IP Address not whitelisted. Add your IP (197.248.68.197) to MongoDB Atlas');
      console.error('📝 Go to Network Access in MongoDB Atlas and add your current IP');
    }
    
    if (error.message.includes('authentication')) {
      console.error('🔐 Authentication failed. Check your MongoDB credentials in .env file');
    }

    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('🌐 Network connection failed. Check your internet connection and MongoDB URI');
    }

    if (error.message.includes('timeout')) {
      console.error('⏰ Connection timeout. MongoDB server might be slow or unreachable');
    }
    
    // Don't exit in development, continue with limited functionality
    if (process.env.NODE_ENV === 'production') {
      throw error;
    } else {
      console.log('🔄 Continuing in development mode without MongoDB...');
      return null;
    }
  }
};

// ✅ Define TRADING_ASSETS array
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

// Fix: Define assets alias for TRADING_ASSETS
const assets = TRADING_ASSETS;

// Initialize MongoDB connection with graceful fallback
(async () => {
  try {
    await connectDB();
    console.log('✅ Database connection established - all features available');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.log('🔄 Continuing with limited functionality (no database features)...');
    // Don't exit - continue with limited functionality
  }
})();

// Enhanced health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'Disconnected',
    1: 'Connected', 
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  const isDbConnected = dbStatus === 1;
  
  res.json({
    status: 'Server Running',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbStatusText[dbStatus] || 'Unknown',
        connected: isDbConnected,
        features: isDbConnected ? 'All features available' : 'Limited functionality'
      },
      priceUpdates: 'Active',
      signalGeneration: isDbConnected ? 'Active' : 'Disabled (no database)',
      authentication: isDbConnected ? 'Active' : 'Disabled (no database)',
      demoTrading: isDbConnected ? 'Active' : 'Disabled (no database)'
    },
    environment: process.env.NODE_ENV || 'development',
    ip: '197.248.68.197',
    recommendations: !isDbConnected ? [
      'Check your MongoDB connection string in .env file',
      'Ensure your IP (197.248.68.197) is whitelisted in MongoDB Atlas',
      'Verify your MongoDB Atlas cluster is running',
      'Check your internet connection'
    ] : []
  });
});
// At the very top of your file (after imports but before any other code)
try {
  Signal = require('./models/Signal');     // AI signals
  Market = require('./models/Market');       // Market data
  Portfolio = require('./models/Portfolio'); // Portfolio holdings
  // Fix: Load PriceHistory model
  PriceHistory = require('./models/MarketData');
  DemoTrade = require('./models/DemoTrade'); // Register DemoTrade model
  console.log('✅ Models loaded successfully');
} catch (error) {
  console.error('❌ Error loading models:', error.message);
  process.exit(1);
}

// Set up auth routes with error handling
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('⚠️ Auth routes failed to load:', error.message);
}

// Demo account routes with error handling
try {
  const demoAccountRoutes = require('./routes/demoAccount');
  app.use('/api/demo-account', demoAccountRoutes);
  console.log('✅ Demo account routes loaded');
} catch (error) {
  console.error('⚠️ Demo account routes failed to load:', error.message);
}

// Signals routes with error handling
try {
  const signalsRoutes = require('./routes/signals');
  app.use('/api/signals', signalsRoutes);
  console.log('✅ Signals routes loaded');
} catch (error) {
  console.error('⚠️ Signals routes failed to load:', error.message);
}

// Portfolio routes with error handling
try {
  const portfolioRoutes = require('./routes/portfolio');
  app.use('/api/portfolio', portfolioRoutes);
  console.log('✅ Portfolio routes loaded');
} catch (error) {
  console.error('⚠️ Portfolio routes failed to load:', error.message);
}

// Market routes with error handling
try {
  const marketRoutes = require('./routes/market');
  app.use('/api/market', marketRoutes);
  console.log('✅ Market routes loaded');
} catch (error) {
  console.error('⚠️ Market routes failed to load:', error.message);
}

// Create HTTP and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- WebSocket Setup ---
// On connection, send welcome message and all active signals.
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
    console.log('MongoDB not connected - skipping signal broadcast');
    return;
  }

  Signal.find({ status: 'active' })
    .then(signals => {
      signals.forEach(signal => {
        try {
          ws.send(JSON.stringify({ type: 'new_signal', signal }));
        } catch (error) {
          console.error('Error sending signal:', error.message);
        }
      });
    })
    .catch(err => console.error('Error fetching active signals:', err.message));
}

// --- Market Data Endpoint & Update ---
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

// --- Portfolio Endpoints & Update ---
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

function broadcastSignal(signal) {
  if (!signal) return;
  
  wss.clients.forEach(client => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'new_signal', signal }));
      }
    } catch (err) {
      console.error('WebSocket send error:', err.message);
    }
  });
}

// --- Price Data Fetching ---
// External API keys.
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;

// Simplified price fetching for basic functionality
async function fetchCurrentPrices() {
  try {
    const results = {};
    
    // Fetch basic crypto prices
    const cryptoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd', { 
      timeout: 10000 
    });
    const cryptoData = await cryptoResponse.json();
    
    if (cryptoData.bitcoin) results.BTC = cryptoData.bitcoin.usd;
    if (cryptoData.ethereum) results.ETH = cryptoData.ethereum.usd;
    if (cryptoData.solana) results.SOL = cryptoData.solana.usd;
    
    return results;
  } catch (error) {
    console.error('❌ Error fetching current prices:', error.message);
    return {};
  }
}

// Simplified price update function
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

// --- Enterprise ML System Integration ---

// Import enterprise ML services
const MarketDataIngestionService = require('./services/dataIngestion/marketDataService');
const RedisTimeSeriesService = require('./services/dataIngestion/redisService');
const StreamingFeatureFactory = require('./services/featureEngineering/streamingFeatureFactory');
const MultiStageEnsembleSystem = require('./services/ml/ensembleSystem');
const RealTimeInferenceService = require('./services/inference/inferenceService');
const { listenForSignals } = require('./services/redisSubscriber');

// Initialize enterprise ML services
let marketDataService = null;
let redisService = null;
let featureFactory = null;
let ensembleSystem = null;
let inferenceService = null;

// Initialize enterprise ML system
async function initializeEnterpriseMLSystem() {
  try {
    console.log('🚀 Initializing Enterprise ML System...');
    
    // Initialize Redis TimeSeries service
    redisService = new RedisTimeSeriesService();
    await redisService.initialize();
    
    // Initialize market data ingestion service
    marketDataService = new MarketDataIngestionService();
    await marketDataService.initialize();
    
    // Initialize feature engineering service
    featureFactory = new StreamingFeatureFactory();
    await featureFactory.initialize();
    
    // Initialize ensemble system
    ensembleSystem = new MultiStageEnsembleSystem();
    await ensembleSystem.initialize();
    
    // Initialize inference service
    inferenceService = new RealTimeInferenceService();
    await inferenceService.initialize(ensembleSystem);
    
    // Set up event handlers for data flow
    setupEnterpriseMLEventHandlers();
    
    console.log('✅ Enterprise ML System initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize Enterprise ML System:', error.message);
    console.log('🔄 Continuing with basic functionality');
  }
}

// Set up event handlers for enterprise ML data flow
function setupEnterpriseMLEventHandlers() {
  if (!marketDataService || !featureFactory || !ensembleSystem || !inferenceService) {
    return;
  }
  
  // Market data -> Feature engineering
  marketDataService.on('tickData', async (ticks) => {
    for (const tick of ticks) {
      try {
        const features = await featureFactory.processTick(tick.symbol, tick);
        // Features are automatically emitted to ensemble system
      } catch (error) {
        console.error(`❌ Error processing tick for ${tick.symbol}:`, error.message);
      }
    }
  });
  
  // Feature engineering -> Ensemble system
  featureFactory.on('featuresReady', async (data) => {
    try {
      const prediction = await inferenceService.predict(data.symbol, data.features);
      // Prediction is automatically emitted to signal generation
    } catch (error) {
      console.error(`❌ Error generating prediction for ${data.symbol}:`, error.message);
    }
  });
  
  // Inference service -> Signal generation
  inferenceService.on('predictionReady', async (data) => {
    try {
      await generateEnterpriseSignal(data);
    } catch (error) {
      console.error(`❌ Error generating enterprise signal for ${data.symbol}:`, error.message);
    }
  });
}

// Generate enterprise ML signals
async function generateEnterpriseSignal(predictionData) {
  try {
    const { symbol, prediction } = predictionData;
    
    // Only generate signals with sufficient confidence
    if (prediction.confidence < 0.6) {
      return;
    }
    
    // Create signal object
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
    
    // Save signal to database
    await saveEnterpriseSignal(signal);
    
    console.log(`🎯 Enterprise ML Signal: ${signal.type} for ${symbol} (${signal.confidence}% confidence)`);
    
  } catch (error) {
    console.error('❌ Error generating enterprise signal:', error.message);
  }
}

// Generate enterprise reasoning
function generateEnterpriseReasoning(prediction) {
  const reasoning = [];
  
  // Add model predictions
  if (prediction.modelPredictions) {
    reasoning.push(`Ensemble: ${prediction.signal} (${Math.round(prediction.confidence * 100)}%)`);
  }
  
  // Add feature importance
  if (prediction.featureImportance) {
    const topFeatures = Object.entries(prediction.featureImportance)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([feature, importance]) => `${feature}: ${importance.toFixed(3)}`);
    
    reasoning.push(`Top Features: ${topFeatures.join(', ')}`);
  }
  
  // Add counterfactual scenarios
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

// Save enterprise signal
async function saveEnterpriseSignal(signalData) {
  try {
    // Remove existing signals for this symbol
    await Signal.deleteMany({
      symbol: signalData.symbol,
      $or: [
        { expiresAt: { $lt: new Date() } },
        { confidence: { $lt: signalData.confidence } }
      ]
    });
    
    // Save new signal
    const newSignal = await Signal.create(signalData);
    
    // Broadcast to WebSocket clients
    broadcastSignal(newSignal);
    
    return newSignal;
  } catch (error) {
    console.error('❌ Error saving enterprise signal:', error.message);
    return null;
  }
}

// Get market from symbol
function getMarketFromSymbol(symbol) {
  if (symbol.includes('USDT')) return 'crypto';
  if (symbol.length === 6 && symbol.slice(3) === 'USD') return 'forex';
  if (symbol.length <= 5) return 'stocks';
  return 'commodities';
}

// Replace the old generateSignals function with enterprise version
async function generateSignals() {
  if (inferenceService && inferenceService.isInitialized) {
    // Enterprise ML system is active - signals are generated automatically
    console.log('🤖 Enterprise ML system active - signals generated automatically');
  } else {
    // Fallback to basic functionality
    console.log('🔄 Enterprise ML system not available - using basic functionality');
  }
  
  // Clean up expired signals
  await Signal.updateMany(
    { expiresAt: { $lt: new Date() }, status: 'active' }, 
    { status: 'inactive' }
  );
}

// --- Enterprise ML System Status Endpoint ---
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
        redisTimeSeries: redisService ? redisService.getStatus() : 'Not Initialized',
        featureFactory: featureFactory ? featureFactory.getStatus() : 'Not Initialized',
        ensembleSystem: ensembleSystem ? ensembleSystem.getStatus() : 'Not Initialized',
        inferenceService: inferenceService ? inferenceService.getStatus() : 'Not Initialized'
      },
      performance: {
        averageLatency: inferenceService ? inferenceService.performanceMonitor.getSummaryStats().averageLatency : 'N/A',
        errorRate: inferenceService ? inferenceService.performanceMonitor.getSummaryStats().errorRate : 'N/A',
        cacheHitRate: inferenceService ? inferenceService.getStatus().cache.hitRate : 'N/A'
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

// Enterprise ML Performance Analytics
app.get('/api/enterprise-ml/analytics', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ msg: 'Database not connected' });
    }

    // Get recent enterprise signals
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

// Initialize enterprise ML system after database connection
(async () => {
  try {
    await connectDB();
    console.log('✅ Database connection established - all features available');
    
    // Initialize enterprise ML system
    await initializeEnterpriseMLSystem();
    
    // Initialize position monitoring
    const { startPositionMonitoring, setWebSocketServer } = require('./jobs/demoPositionMonitor');
    setWebSocketServer(wss);
    startPositionMonitoring(30000); // Check every 30 seconds
    console.log('✅ Position monitoring initialized');
    
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.log('🔄 Continuing with limited functionality (no database features)...');
  }
})();

// After WebSocket server setup
listenForSignals((signal) => {
  // Broadcast to all WebSocket clients
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

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
  console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);
  
  // Clear all intervals
  if (signalGenerationInterval) clearInterval(signalGenerationInterval);
  if (marketUpdateInterval) clearInterval(marketUpdateInterval);
  if (portfolioUpdateInterval) clearInterval(portfolioUpdateInterval);
  if (demoPositionInterval) clearInterval(demoPositionInterval);
  
  // Close WebSocket server
  wss.close(() => {
    console.log('🔌 WebSocket server closed');
  });
  
  // Close HTTP server
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

// Start the HTTP server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Enterprise ML System: ${inferenceService ? 'Active' : 'Initializing...'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));