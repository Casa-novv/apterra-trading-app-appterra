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
const priceUpdateInterval = setInterval(async () => {
  try {
    const prices = await fetchCurrentPrices();
    if (prices) {
      wss.clients.forEach(client => {
        try {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'prices', prices }));
          }
        } catch (error) {
          console.error('Error broadcasting prices:', error.message);
        }
      });
    }
  } catch (error) {
    console.error('Error in price update interval:', error.message);
  }
}, 5000);

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

const marketUpdateInterval = setInterval(updateMarketData, 5 * 60 * 1000);
// Initial update after 10 seconds
setTimeout(updateMarketData, 10 * 1000);

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

const portfolioUpdateInterval = setInterval(updatePortfolioData, 5 * 60 * 1000);
setTimeout(updatePortfolioData, 10 * 1000);

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

// --- Rolling price history updater (every 30s) ---
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

const priceHistoryInterval = setInterval(async () => {
  for (const asset of assets) {
    try {
      const price = await fetchLatestPrice(asset.symbol, asset.market);
      if (!price) continue;
      
      if (!priceHistories[asset.symbol]) priceHistories[asset.symbol] = [];
      priceHistories[asset.symbol].push(price);
      
      // Keep only the last 30 prices
      if (priceHistories[asset.symbol].length > 30) {
        priceHistories[asset.symbol] = priceHistories[asset.symbol].slice(-30);
      }
    } catch (error) {
      console.error(`Error updating price history for ${asset.symbol}:`, error.message);
    }
  }
}, 30 * 1000); // every 30 seconds

// --- Signal generation (every 15 minutes) ---
const signalGenerationInterval = setInterval(async () => {
  if (mongoose.connection.readyState !== 1) {
    console.log('MongoDB not connected - skipping signal generation');
    return;
  }

  for (const asset of assets) {
    try {
      const priceHistory = priceHistories[asset.symbol] || [];
      if (priceHistory.length < 20) continue; // Need enough data for indicators
      
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
      
      // --- Bypass AI for now ---
      const predictedTrend = 0;
      
      // --- News sentiment (optional, can skip for speed) ---
      let newsSentiment = 0;
      try {
        newsSentiment = await analyzeNewsSentiment(asset.symbol);
      } catch (err) {
        newsSentiment = 0;
      }
      
      // --- Signal logic (example: combine indicators) ---
      let signalType = 'HOLD';
      if (currentRSI > 60 && currentMACD > 0 && currentEMA > currentSMA) {
        signalType = 'BUY';
      } else if (currentRSI < 40 && currentMACD < 0 && currentEMA < currentSMA) {
        signalType = 'SELL';
      }
      
      // Confidence: combine indicator strengths
      const confidence = Math.round(
        Math.abs(currentRSI - 50) +
        Math.abs(currentMACD) * 10 +
        Math.abs(currentEMA - currentSMA) +
        Math.abs(newsSentiment) * 5
      );
      
      const livePrice = priceHistory[priceHistory.length - 1];
      const stopLoss = livePrice * (signalType === 'BUY' ? 0.98 : 1.02);
      const targetPrice = livePrice * (signalType === 'BUY' ? 1.05 : 0.95);
      
      if (signalType !== 'HOLD') {
        const signalData = {
          symbol: asset.symbol,
          type: signalType,
          confidence,
          entryPrice: livePrice,
          targetPrice,
          stopLoss,
          timeframe: '15M',
          market: asset.market,
          description: `Signal: ${signalType} (${confidence}%)`,
          reasoning: `RSI=${currentRSI}, MACD=${currentMACD}, EMA=${currentEMA}, SMA=${currentSMA}, Sentiment=${newsSentiment}`,
          technicalIndicators: { rsi: currentRSI, macd: currentMACD, ema: currentEMA, sma: currentSMA, newsSentiment },
          status: 'active',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          source: 'ai',
          risk: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low'
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
      }
    } catch (error) {
      console.error(`Error generating signal for ${asset.symbol}:`, error.message);
    }
  }
}, 15 * 60 * 1000); // every 15 minutes

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
try {
  const demoMonitor = require('./jobs/demoPositionMonitor');
  monitorDemoPositions = demoMonitor.monitorDemoPositions;
  const demoMonitorInterval = setInterval(monitorDemoPositions, 60 * 1000); // every minute
  console.log('✅ Demo position monitor loaded');
} catch (error) {
  console.error('⚠️ Demo position monitor not found:', error.message);
  // Create a mock function to prevent crashes
    monitorDemoPositions = () => console.log('Demo position monitoring skipped - module not found');
  const demoMonitorInterval = setInterval(monitorDemoPositions, 60 * 1000); // every minute
}

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
  clearInterval(marketUpdateInterval);
  clearInterval(portfolioUpdateInterval);
  clearInterval(priceHistoryInterval);
  clearInterval(signalGenerationInterval);
  
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