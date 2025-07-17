require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const axios = require('axios');
// Instead of ta, we use technicalindicators:
const { RSI, MACD } = require('technicalindicators');
const jwt = require('jsonwebtoken');
const Sentiment = require('sentiment');
const tf = require('@tensorflow/tfjs');

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

// Enhanced MongoDB connection with better error handling
const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      // Removed bufferMaxEntries as it's deprecated
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

// Initialize MongoDB connection
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  res.json({ 
    status: 'Server Running',
    timestamp: new Date().toISOString(),
    mongodb: dbStatusText[dbStatus] || 'Unknown',
    environment: process.env.NODE_ENV || 'development',
    ip: '197.248.68.197'
  });
});

// Import Mongoose models with error handling
let Signal, Market, Portfolio;
try {
  Signal = require('./models/Signal');     // AI signals
  Market = require('./models/Market');       // Market data
  Portfolio = require('./models/Portfolio'); // Portfolio holdings
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

// --- Price Data Fetching ---
// External API keys.
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;

async function fetchFromCoinGecko() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';
  const response = await fetch(url, { timeout: 10000 });
  const data = await response.json();
  if (!data.bitcoin || !data.ethereum || !data.solana)
    throw new Error('CoinGecko rate limit or bad data');
  return {
    BTC: data.bitcoin.usd,
    ETH: data.ethereum.usd,
    SOL: data.solana.usd,
  };
}

async function fetchFromBinance() {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const prices = {};
  for (const symbol of symbols) {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, { timeout: 10000 });
    const data = await response.json();
    if (!data.price)
      throw new Error('Binance rate limit or bad data');
    prices[symbol.replace('USDT', '')] = parseFloat(data.price);
  }
  return { BTC: prices.BTC, ETH: prices.ETH, SOL: prices.SOL };
}

async function fetchFromAlphaVantage() {
  if (!ALPHA_VANTAGE_KEY) throw new Error('Alpha Vantage API key missing');
  
  const symbols = { BTC: 'BTCUSD', ETH: 'ETHUSD', SOL: 'SOLUSD' };
  const prices = {};
  for (const [key, symbol] of Object.entries(symbols)) {
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${key}&to_currency=USD&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();
    const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
    if (!rate)
      throw new Error('Alpha Vantage rate limit or bad data');
    prices[key] = parseFloat(rate);
  }
  return prices;
}

async function fetchFromTwelveData() {
  if (!TWELVE_DATA_KEY) throw new Error('Twelve Data API key missing');
  
  const url = `https://api.twelvedata.com/price?symbol=BTC/USD,ETH/USD,SOL/USD&apikey=${TWELVE_DATA_KEY}`;
  const response = await fetch(url, { timeout: 10000 });
  const data = await response.json();
  if (!data['BTC/USD'] || !data['ETH/USD'] || !data['SOL/USD'])
    throw new Error('Twelve Data rate limit or bad data');
  return {
    BTC: parseFloat(data['BTC/USD'].price),
    ETH: parseFloat(data['ETH/USD'].price),
    SOL: parseFloat(data['SOL/USD'].price),
  };
}

async function fetchCurrentPrices() {
  const apis = [
    fetchFromCoinGecko,
    fetchFromBinance,
    fetchFromAlphaVantage,
    fetchFromTwelveData,
  ];
  
  for (const api of apis) {
    try {
      const prices = await api();
      console.log(`Fetched prices from ${api.name}`);
      return prices;
    } catch (err) {
      console.warn(`Failed to fetch from ${api.name}:`, err.message);
      continue;
    }
  }
  console.error('All APIs failed');
  return null;
}

// Enhanced price broadcasting with error handling
const marketService = require('./services/marketService');
const priceService = require('./services/priceService');

// Add API status endpoint
app.get('/api/status/apis', (req, res) => {
  const status = priceService.getAPIStatus();
  res.json({
    timestamp: new Date().toISOString(),
    apis: status,
    summary: {
      available: Object.values(status).filter(api => api.available).length,
      total: Object.keys(status).length,
      inCooldown: Object.values(status).filter(api => api.inCooldown).length
    }
  });
});

// Update your price update interval
let priceUpdateInterval;
const startPriceUpdates = () => {
  console.log('📈 Starting enhanced price update service...');
  
  try {
    // Initial update
    if (marketService && typeof marketService.updatePrices === 'function') {
      marketService.updatePrices();
      
      // Regular updates every 30 seconds (instead of 5 seconds to respect rate limits)
      priceUpdateInterval = setInterval(async () => {
        await marketService.updatePrices();
      }, 30000);
    } else {
      console.error('⚠️ marketService.updatePrices is not available');
    }
  } catch (error) {
    console.error('❌ Error starting price update service:', error.message);
  }
};

// Price updates will be started by startIntervals() function

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

async function updateMarketData() {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected - skipping market data update');
      return;
    }

    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();
    
    const markets = [
      { symbol: 'BTCUSD', price: data.bitcoin.usd },
      { symbol: 'ETHUSD', price: data.ethereum.usd },
      { symbol: 'SOLUSD', price: data.solana.usd },
    ];
    
    for (const m of markets) {
      await Market.findOneAndUpdate(
        { symbol: m.symbol },
        { ...m, lastUpdated: new Date() },
        { upsert: true, new: true }
      );
    }
    console.log('Market data updated');
  } catch (err) {
    console.error('Error updating market data:', err.message);
  }
}

// Market update interval will be started by startIntervals() function

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

async function updatePortfolioData() {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected - skipping portfolio update');
      return;
    }

    const markets = await Market.find();
    const portfolios = await Portfolio.find();
    
    for (const p of portfolios) {
      const market = markets.find(m => m.symbol === p.symbol);
      if (market) {
        p.currentPrice = market.price;
        p.pnl = (market.price - p.entryPrice) * p.amount;
        p.pnlPercent = ((market.price - p.entryPrice) / p.entryPrice) * 100;
        await p.save();
      }
    }
    console.log('Portfolio data updated');
  } catch (err) {
    console.error('Error updating portfolio data:', err.message);
  }
}

// Portfolio update interval will be started by startIntervals() function

// --- AI Signal Generation ---
// Deep learning prediction and sentiment analysis functions
let trendModel = null;

// Enhanced model loading with better error handling
(async () => {
  try {
    console.log('⏭️ AI Model loading skipped - preventing crashes');
    console.log('🤖 Using mock AI predictions for stability');
    // trendModel = await tf.loadLayersModel('https://example.com/model.json');
    // console.log('Trend model loaded');
  } catch (err) {
    console.error('Failed to load trend model:', err.message);
    console.log('🤖 Continuing with mock AI predictions');
  }
})();

async function predictTrend(priceHistory) {
  if (!trendModel || priceHistory.length < 20) return 0;
  try {
    const inputTensor = tf.tensor2d([priceHistory.slice(-20)], [1, 20]);
        const prediction = trendModel.predict(inputTensor).dataSync()[0];
    inputTensor.dispose(); // Clean up tensor memory
    return prediction;
  } catch (err) {
    console.error('Error in deep learning prediction:', err.message);
    return 0;
  }
}

async function analyzeNewsSentiment(symbol) {
  try {
    if (!process.env.NEWS_API_KEY) {
      return 0; // Return neutral sentiment if no API key
    }
    
    const response = await axios.get(`https://newsapi.org/v2/everything?q=${symbol}&apiKey=${process.env.NEWS_API_KEY}`, {
      timeout: 10000
    });
    
    const scores = response.data.articles.map(article => {
      return new Sentiment().analyze(article.title).score;
    });
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  } catch (err) {
    console.error('Error fetching news sentiment:', err.message);
    return 0;
  }
}

async function generateSignal(symbol, market) {
  try {
    // Fetch price history (use 50 latest closes)
    const priceHistory = await getPriceHistory(symbol, 50);
    if (!priceHistory || priceHistory.length < 30) return null;
    
    const livePrice = priceHistory[priceHistory.length - 1];
    
    // Bypass AI for now
    const predictedTrend = 0; // or use a random value if you want some variety
    const newsSentiment = await analyzeNewsSentiment(symbol);
    
    // Calculate RSI and MACD
    const rsiValues = RSI.calculate({ values: priceHistory, period: 14 });
    const currentRSI = rsiValues.length ? rsiValues[rsiValues.length - 1] : 50;
    
    const macdResults = MACD.calculate({
      values: priceHistory,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
    const currentMACD = macdResults.length ? macdResults[macdResults.length - 1].MACD : 0;
    
    // Simple signal logic
    const signalType = currentRSI > 60 && currentMACD > 0 ? 'BUY' : 'SELL';
    const confidence = Math.round(Math.abs(currentRSI - 50) + Math.abs(currentMACD) * 10);
    const stopLoss = livePrice * (signalType === 'BUY' ? 0.98 : 1.02);
    const targetPrice = livePrice * (signalType === 'BUY' ? 1.05 : 0.95);
    
    const signalData = {
      symbol,
      type: signalType,
      confidence,
      entryPrice: livePrice,
      targetPrice,
      stopLoss,
      timeframe: '1H',
      market,
      description: `AI detected ${signalType} signal with confidence ${confidence}%`,
      reasoning: `RSI=${currentRSI}, MACD=${currentMACD}, Sentiment=${newsSentiment}`,
      technicalIndicators: { rsi: currentRSI, macd: currentMACD, newsSentiment },
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      source: 'ai',
      risk: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low'
    };
    
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected - skipping signal creation');
      return null;
    }
    
    // Remove expired signals or signals for the same asset with lower confidence
    await Signal.deleteMany({
      symbol: symbol,
      $or: [
        { expiresAt: { $lt: new Date() } },
        { confidence: { $lt: confidence } }
      ]
    });
    
    const newSignal = await Signal.create(signalData);
    broadcastSignal(newSignal);
    return newSignal;
  } catch (error) {
    console.error('Error generating signal:', error.message);
    return null;
  }
}

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

// --- In-memory price history store ---
const priceHistories = {}; // { [symbol]: number[] }

// --- Helper: Fetch latest price for each asset type ---
async function fetchLatestPrice(symbol, market) {
  try {
    if (market === 'crypto') {
      // Binance for crypto
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      const response = await fetch(url, { timeout: 10000 });
      const data = await response.json();
      return parseFloat(data.price);
    } else if (market === 'forex') {
      // Alpha Vantage for forex
      if (!ALPHA_VANTAGE_KEY) return null;
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol.slice(0,3)}&to_currency=${symbol.slice(3,6)}&apikey=${ALPHA_VANTAGE_KEY}`;
      const response = await fetch(url, { timeout: 10000 });
      const data = await response.json();
      const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
      return rate ? parseFloat(rate) : null;
    } else if (market === 'stocks') {
      // Alpha Vantage for stocks
      if (!ALPHA_VANTAGE_KEY) return null;
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
      const response = await fetch(url, { timeout: 10000 });
      const data = await response.json();
      const price = data['Global Quote']?.['05. price'];
      return price ? parseFloat(price) : null;
    } else if (market === 'commodities') {
      // Twelve Data for commodities (e.g., GOLD, OIL)
      if (!TWELVE_DATA_KEY) return null;
      const url = `https://api.twelvedata.com/price?symbol=${symbol}/USD&apikey=${TWELVE_DATA_KEY}`;
      const response = await fetch(url, { timeout: 10000 });
      const data = await response.json();
      return data.price ? parseFloat(data.price) : null;
    }
  } catch (err) {
    console.error(`Error fetching price for ${symbol}:`, err.message);
    return null;
  }
}

// --- Enhanced Helper: Fetch latest price with retry and rate limiting ---
async function fetchLatestPriceWithRetry(symbol, market, maxRetries = 3) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // Add delay for rate limiting (stagger requests)
      if (retryCount > 0) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`Retrying ${symbol} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const price = await fetchLatestPrice(symbol, market);
      if (price !== null) {
        return price;
      }
      
      console.log(`API returned null for ${symbol}, attempt ${retryCount + 1}`);
      retryCount++;
    } catch (error) {
      console.error(`API error for ${symbol} (attempt ${retryCount + 1}):`, error.message);
      retryCount++;
    }
  }
  
  console.error(`Failed to fetch price for ${symbol} after ${maxRetries} attempts`);
  return null;
}

// --- Enhanced signal generation function ---
async function generateSignals() {
  if (mongoose.connection.readyState !== 1) {
    console.log('MongoDB not connected - skipping signal generation');
    return;
  }

  console.log('🤖 Starting signal generation...');
  
  // Wait for price data to be available (2-3 minutes as requested)
  const waitForPriceData = async () => {
    const maxWaitTime = 3 * 60 * 1000; // 3 minutes
    const checkInterval = 30 * 1000; // Check every 30 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      let allAssetsHaveData = true;
      
      for (const asset of assets) {
        const priceHistory = priceHistories[asset.symbol] || [];
        if (priceHistory.length < 20) {
          allAssetsHaveData = false;
          break;
        }
      }
      
      if (allAssetsHaveData) {
        console.log('✅ All assets have sufficient price data');
        return true;
      }
      
      console.log('⏳ Waiting for more price data...');
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    console.log('⚠️ Timeout waiting for price data');
    return false;
  };
  
  // Wait for price data before generating signals
  const dataReady = await waitForPriceData();
  if (!dataReady) {
    console.log('❌ Insufficient price data - skipping signal generation');
    return;
  }

  // Process each asset type with specific logic
  for (const asset of assets) {
    try {
      const priceHistory = priceHistories[asset.symbol] || [];
      
      // Enhanced data validation
      if (priceHistory.length < 20) {
        console.log(`⚠️ Skipping ${asset.symbol} - insufficient data (${priceHistory.length} points)`);
        continue;
      }
      
      console.log(`📊 Generating signal for ${asset.symbol} (${asset.market}) with ${priceHistory.length} data points`);
      
      // --- Technical Indicators ---
      const rsiValues = RSI.calculate({ values: priceHistory, period: 14 });
      const currentRSI = rsiValues.length ? rsiValues[rsiValues.length - 1] : 50;
      
      const macdResults = MACD.calculate({
        values: priceHistory,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      });
      const currentMACD = macdResults.length ? macdResults[macdResults.length - 1].MACD : 0;
      
      const smaValues = require('technicalindicators').SMA.calculate({ values: priceHistory, period: 10 });
      const currentSMA = smaValues.length ? smaValues[smaValues.length - 1] : priceHistory[priceHistory.length - 1];
      
      const emaValues = require('technicalindicators').EMA.calculate({ values: priceHistory, period: 10 });
      const currentEMA = emaValues.length ? emaValues[emaValues.length - 1] : priceHistory[priceHistory.length - 1];
      
      // --- Market-specific analysis ---
      let marketMultiplier = 1;
      let volatilityFactor = 1;
      
      switch (asset.market) {
        case 'crypto':
          marketMultiplier = 1.2; // Crypto is more volatile
          volatilityFactor = 1.5;
          break;
        case 'forex':
          marketMultiplier = 0.8; // Forex is more stable
          volatilityFactor = 0.7;
          break;
        case 'stocks':
          marketMultiplier = 1.0; // Standard multiplier
          volatilityFactor = 1.0;
          break;
        case 'commodities':
          marketMultiplier = 1.1; // Commodities have unique patterns
          volatilityFactor = 1.2;
          break;
      }
      
      // --- News sentiment (optional) ---
      let newsSentiment = 0;
      try {
        newsSentiment = await analyzeNewsSentiment(asset.symbol);
      } catch (err) {
        newsSentiment = 0;
      }
      
      // --- Enhanced signal logic with market-specific thresholds ---
      let signalType = 'HOLD';
      let signalStrength = 0;
      
      // RSI signals with market-specific thresholds
      const rsiOverbought = asset.market === 'crypto' ? 75 : 70;
      const rsiOversold = asset.market === 'crypto' ? 25 : 30;
      
      if (currentRSI > rsiOverbought) signalStrength -= 1.5; // Overbought
      if (currentRSI < rsiOversold) signalStrength += 1.5; // Oversold
      
      // MACD signals
      if (currentMACD > 0.001) signalStrength += 1.0;
      if (currentMACD < -0.001) signalStrength -= 1.0;
      
      // Moving average signals
      const maCrossover = (currentEMA - currentSMA) / currentSMA * 100;
      if (maCrossover > 0.5) signalStrength += 0.8;
      if (maCrossover < -0.5) signalStrength -= 0.8;
      
      // News sentiment factor
      signalStrength += newsSentiment * 0.3;
      
      // Apply market multiplier
      signalStrength *= marketMultiplier;
      
      // Determine signal type based on strength and market
      const buyThreshold = asset.market === 'crypto' ? 2.0 : 1.5;
      const sellThreshold = asset.market === 'crypto' ? -2.0 : -1.5;
      
      if (signalStrength >= buyThreshold) {
        signalType = 'BUY';
      } else if (signalStrength <= sellThreshold) {
        signalType = 'SELL';
      }
      
      // --- Enhanced confidence calculation ---
      const rsiConfidence = Math.min(30, Math.abs(currentRSI - 50) * 0.6);
      const macdConfidence = Math.min(25, Math.abs(currentMACD) * 500);
      const maConfidence = Math.min(20, Math.abs(maCrossover) * 4);
      const sentimentConfidence = Math.min(15, Math.abs(newsSentiment) * 30);
      const strengthConfidence = Math.min(10, Math.abs(signalStrength) * 5);
      
      const confidence = Math.round(
        rsiConfidence + 
        macdConfidence + 
        maConfidence + 
        sentimentConfidence + 
        strengthConfidence
      );
      
      const livePrice = priceHistory[priceHistory.length - 1];
      
      // Market-specific stop loss and target calculation
      let stopLossPercent, targetPercent;
      
      switch (asset.market) {
        case 'crypto':
          stopLossPercent = signalType === 'BUY' ? 0.95 : 1.05; // 5% stop loss
          targetPercent = signalType === 'BUY' ? 1.08 : 0.92; // 8% target
          break;
        case 'forex':
          stopLossPercent = signalType === 'BUY' ? 0.995 : 1.005; // 0.5% stop loss
          targetPercent = signalType === 'BUY' ? 1.015 : 0.985; // 1.5% target
          break;
        case 'stocks':
          stopLossPercent = signalType === 'BUY' ? 0.98 : 1.02; // 2% stop loss
          targetPercent = signalType === 'BUY' ? 1.05 : 0.95; // 5% target
          break;
        case 'commodities':
          stopLossPercent = signalType === 'BUY' ? 0.97 : 1.03; // 3% stop loss
          targetPercent = signalType === 'BUY' ? 1.06 : 0.94; // 6% target
          break;
        default:
          stopLossPercent = signalType === 'BUY' ? 0.98 : 1.02;
          targetPercent = signalType === 'BUY' ? 1.05 : 0.95;
      }
      
      const stopLoss = livePrice * stopLossPercent;
      const targetPrice = livePrice * targetPercent;
      
      // Only generate signals with reasonable confidence (market-specific thresholds)
      const minConfidence = asset.market === 'crypto' ? 50 : 60;
      
      if (signalType !== 'HOLD' && confidence >= minConfidence) {
        const signalData = {
          symbol: asset.symbol,
          type: signalType,
          confidence,
          entryPrice: livePrice,
          targetPrice,
          stopLoss,
          timeframe: '15M',
          market: asset.market,
          description: `${signalType} signal for ${asset.market} with ${confidence}% confidence`,
          reasoning: `RSI=${currentRSI.toFixed(2)}, MACD=${currentMACD.toFixed(4)}, EMA=${currentEMA.toFixed(4)}, SMA=${currentSMA.toFixed(4)}, MA_Cross=${maCrossover.toFixed(2)}%, Sentiment=${newsSentiment.toFixed(2)}, Strength=${signalStrength.toFixed(2)}`,
          technicalIndicators: { 
            rsi: currentRSI, 
            macd: currentMACD, 
            ema: currentEMA, 
            sma: currentSMA, 
            newsSentiment,
            signalStrength,
            maCrossover,
            marketMultiplier,
            volatilityFactor
          },
          status: 'active',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          source: 'enhanced_ai',
          risk: confidence > 80 ? 'high' : confidence > 65 ? 'medium' : 'low',
          dataQuality: {
            pricePoints: priceHistory.length,
            dataAge: 'recent',
            marketType: asset.market,
            confidenceBreakdown: {
              rsi: rsiConfidence,
              macd: macdConfidence,
              ma: maConfidence,
              sentiment: sentimentConfidence,
              strength: strengthConfidence
            }
          }
        };
        
        // Remove expired or lower-confidence signals for this asset
        await Signal.deleteMany({
          symbol: asset.symbol,
          $or: [
            { expiresAt: { $lt: new Date() } },
            { confidence: { $lt: confidence } }
          ]
        });
        
        const newSignal = await Signal.create(signalData);
        broadcastSignal(newSignal);
        
        console.log(`🎯 Generated ${signalType} signal for ${asset.symbol} (${asset.market}) with ${confidence}% confidence`);
      } else {
        console.log(`⚪ HOLD signal for ${asset.symbol} (${asset.market}) - confidence: ${confidence}%`);
      }
    } catch (error) {
      console.error(`Error generating signal for ${asset.symbol}:`, error.message);
    }
  }
  
  console.log('🎯 Signal generation completed');
}

// --- Enhanced price history updater with rate limiting ---
const assets = [
  { symbol: 'BTCUSDT', market: 'crypto' },
  { symbol: 'ETHUSDT', market: 'crypto' },
  { symbol: 'EURUSD', market: 'forex' },
  { symbol: 'GBPUSD', market: 'forex' },
  { symbol: 'AAPL', market: 'stocks' },
  { symbol: 'TSLA', market: 'stocks' },
  { symbol: 'GOLD', market: 'commodities' },
  { symbol: 'OIL', market: 'commodities' },
];

// Declare interval variables at the top to avoid temporal dead zone issues
let priceHistoryInterval;
let signalGenerationInterval;
let demoMonitorInterval;
let marketUpdateInterval;
let portfolioUpdateInterval;

// --- Function to start all intervals (called after server starts) ---
function startIntervals() {
  console.log('🔄 Initializing all intervals and services...');
  
  // Debug: Check all functions before starting intervals
  console.log('🔍 Function validation:');
  console.log(`- startPriceUpdates: ${typeof startPriceUpdates}`);
  console.log(`- generateSignals: ${typeof generateSignals}`);
  console.log(`- monitorDemoPositions: ${typeof monitorDemoPositions}`);
  console.log(`- updateMarketData: ${typeof updateMarketData}`);
  console.log(`- updatePortfolioData: ${typeof updatePortfolioData}`);
  
  try {
    // Start price update service
    if (typeof startPriceUpdates === 'function') {
      startPriceUpdates();
    } else {
      console.error('⚠️ startPriceUpdates is not a function, type:', typeof startPriceUpdates);
    }
    
    // Start price history updater
    priceHistoryInterval = setInterval(async () => {
      console.log('🔄 Starting price history update...');
      
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        
        try {
          // Add delay between requests to respect rate limits
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay between assets
          }
          
          const price = await fetchLatestPriceWithRetry(asset.symbol, asset.market);
          if (!price) {
            console.log(`⚠️ Skipping ${asset.symbol} - no price data available`);
            continue;
          }
          
          if (!priceHistories[asset.symbol]) priceHistories[asset.symbol] = [];
          priceHistories[asset.symbol].push(price);
          
          // Keep only the last 30 prices
          if (priceHistories[asset.symbol].length > 30) {
            priceHistories[asset.symbol] = priceHistories[asset.symbol].slice(-30);
          }
          
          console.log(`✅ Updated ${asset.symbol} (${asset.market}): $${price} (${priceHistories[asset.symbol].length} points)`);
        } catch (error) {
          console.error(`Error updating price history for ${asset.symbol}:`, error.message);
        }
      }
      
      console.log('✅ Price history update completed');
    }, 2 * 60 * 1000); // every 2 minutes

    // Start signal generation
    if (typeof generateSignals === 'function') {
      signalGenerationInterval = setInterval(generateSignals, 15 * 60 * 1000); // every 15 minutes
    } else {
      console.error('⚠️ generateSignals is not a function');
    }
    
    // Start demo monitoring interval
    if (typeof monitorDemoPositions === 'function') {
      demoMonitorInterval = setInterval(monitorDemoPositions, 60 * 1000); // every minute
    } else {
      console.error('⚠️ monitorDemoPositions is not a function');
    }
    
    // Start market update interval
    if (typeof updateMarketData === 'function') {
      marketUpdateInterval = setInterval(updateMarketData, 5 * 60 * 1000);
      setTimeout(updateMarketData, 10 * 1000); // Initial update after 10 seconds
    } else {
      console.error('⚠️ updateMarketData is not a function');
    }
    
    // Start portfolio update interval
    if (typeof updatePortfolioData === 'function') {
      portfolioUpdateInterval = setInterval(updatePortfolioData, 5 * 60 * 1000);
      setTimeout(updatePortfolioData, 10 * 1000); // Initial update after 10 seconds
    } else {
      console.error('⚠️ updatePortfolioData is not a function');
    }
    
    console.log('✅ All intervals started successfully');
  } catch (error) {
    console.error('❌ Error starting intervals:', error.message);
    console.error('Stack:', error.stack);
  }
}

// --- Signals API Endpoint ---
app.get('/api/signals', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const signals = await Signal.find({ status: 'active' });
    res.json({ signals });
  } catch (err) {
    console.error('Error fetching signals:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// Add this RIGHT AFTER your existing /api/signals route
console.log('📈 Adding price endpoints...');

// Single price endpoint
app.get('/api/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    console.log(`📈 Fetching price for ${symbol}`);
    
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
      timeout: 10000
    });
    
    const price = Number(response.data.price);
    console.log(`✅ Got price for ${symbol}: $${price}`);
    
    res.json({ 
      symbol, 
      price,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Price fetch failed for ${req.params.symbol}:`, error.message);
    res.status(500).json({ 
      error: 'Failed to fetch price',
      symbol: req.params.symbol,
      message: error.message
    });
  }
});

// Bulk prices endpoint
app.post('/api/prices', async (req, res) => {
  try {
    const { symbols } = req.body;
    console.log(`📈 Backend fetching prices for symbols:`, symbols);
    
    const prices = {};
    
    for (const symbol of symbols) {
      try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
          timeout: 5000
        });
        prices[symbol] = Number(response.data.price);
        console.log(`✅ ${symbol}: $${prices[symbol]}`);
      } catch (error) {
        console.error(`❌ Failed to fetch ${symbol}:`, error.message);
        prices[symbol] = null;
      }
    }
    
    res.json({ 
      prices,
      timestamp: new Date().toISOString(),
      source: 'binance'
    });
    
  } catch (error) {
    console.error('❌ Bulk price fetch failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch prices',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('✅ Price endpoints added');
// Fetch historical close prices from Binance (for crypto symbols)
async function getPriceHistory(symbol, length = 50) {
  try {
    // Binance expects symbols like BTCUSDT, ETHUSDT, etc.
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=${length}`;
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();
    
    if (!Array.isArray(data)) return [];
    
    // Each item: [openTime, open, high, low, close, ...]
    return data.map(item => parseFloat(item[4])); // close prices
  } catch (error) {
    console.error(`Error fetching price history for ${symbol}:`, error.message);
    return [];
  }
}

// --- Demo Position Monitoring Job ---
let monitorDemoPositions;
let demoMonitorInterval;
try {
  const demoMonitor = require('./jobs/demoPositionMonitor');
  monitorDemoPositions = demoMonitor.monitorDemoPositions;
  console.log('✅ Demo position monitor loaded');
} catch (error) {
  console.error('⚠️ Demo position monitor not found:', error.message);
  // Create a mock function to prevent crashes
  monitorDemoPositions = () => console.log('Demo position monitoring skipped - module not found');
}

// Ensure monitorDemoPositions is always a function
if (typeof monitorDemoPositions !== 'function') {
  monitorDemoPositions = () => console.log('Demo position monitoring disabled - no valid function');
}

// Demo monitoring interval will be started by startIntervals() function

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  console.error('Stack:', err.stack);
  
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
  clearInterval(priceUpdateInterval);
  clearInterval(priceHistoryInterval);
  clearInterval(signalGenerationInterval);
  clearInterval(marketUpdateInterval);
  clearInterval(portfolioUpdateInterval);
  clearInterval(demoMonitorInterval);
  
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
    } catch (error) {
      console.error('❌ Error closing MongoDB:', error.message);
    }
    
    console.log('👋 Goodbye!');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Global error handlers
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  if (process.env.NODE_ENV !== 'development') {
    console.error('Stack:', err.stack);
    // Don't exit in development to prevent crashes during debugging
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

// Handle Windows CTRL+C
if (process.platform === "win32") {
  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", () => {
    process.emit("SIGINT");
  });
}

// --- Start the Server ---
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 Market data: http://localhost:${PORT}/api/market/data`);
      console.log(`📈 Signals: http://localhost:${PORT}/api/signals`);
      console.log(`💼 Portfolio: http://localhost:${PORT}/api/portfolio`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📅 Started at: ${new Date().toISOString()}`);
      
      // API Key status
      console.log('\n🔑 API Key Status:');
      console.log(`Alpha Vantage: ${ALPHA_VANTAGE_KEY ? '✅ Available' : '❌ Missing'}`);
      console.log(`Twelve Data: ${TWELVE_DATA_KEY ? '✅ Available' : '❌ Missing'}`);
      console.log(`News API: ${process.env.NEWS_API_KEY ? '✅ Available' : '❌ Missing'}`);
      
      // Service status
      console.log('\n🔧 Service Status:');
      console.log(`MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`WebSocket: ✅ Running`);
      console.log(`Price Updates: ✅ Every 5 seconds`);
      console.log(`Market Updates: ✅ Every 5 minutes`);
      console.log(`Portfolio Updates: ✅ Every 5 minutes`);
      console.log(`Signal Generation: ✅ Every 15 minutes`);
      console.log(`Demo Position Monitor: ✅ Every minute`);
      
      // Start intervals after server is fully initialized
      setTimeout(() => {
        startIntervals();
      }, 3000); // Wait 3 seconds for everything to be fully initialized
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    
    // Provide helpful troubleshooting information
    if (error.message.includes('EADDRINUSE')) {
      console.log('\n🔧 Port already in use:');
      console.log(`Kill the process using port ${PORT} or use a different port`);
      console.log(`Try: lsof -ti:${PORT} | xargs kill -9`);
    }
    
    process.exit(1);
  }
};

// Start the server
console.log('🚀 Starting Apterra Trading App Backend...');
console.log('📅 Startup Time:', new Date().toISOString());
console.log('🌍 Current IP: 197.248.68.197 (Add to MongoDB whitelist if needed)');

startServer();

// API key warnings
if (!ALPHA_VANTAGE_KEY) console.warn('⚠️ Alpha Vantage API key missing - forex/stocks data limited');
if (!TWELVE_DATA_KEY) console.warn('⚠️ Twelve Data API key missing - commodities data limited');
if (!process.env.NEWS_API_KEY) console.warn('⚠️ News API key missing - sentiment analysis disabled');

// Export app for testing
module.exports = app;