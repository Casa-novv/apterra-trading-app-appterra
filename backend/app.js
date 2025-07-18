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
let Signal, Market, Portfolio, PriceHistory;
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
// Instead of ta, we use technicalindicators:
const { RSI, MACD, Stochastic, BollingerBands } = require('technicalindicators');
const jwt = require('jsonwebtoken');
const Sentiment = require('sentiment');
const tf = require('@tensorflow/tfjs');
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

console.log('📈 Starting enhanced price update service...');

// Helper function to get CoinGecko ID from symbol
const getCoinGeckoId = (symbol) => {
  const mapping = {
    'BTCUSDT': 'bitcoin',
    'ETHUSDT': 'ethereum',
    'BNBUSDT': 'binancecoin',
    'ADAUSDT': 'cardano',
    'SOLUSDT': 'solana',
    'XRPUSDT': 'ripple',
    'DOTUSDT': 'polkadot',
    'LINKUSDT': 'chainlink',
    'AVAXUSDT': 'avalanche-2',
    'MATICUSDT': 'matic-network'
  };
  return mapping[symbol];
};

// Add this helper to save prices to the database
async function savePricesToDatabase(priceArray) {
  for (const { symbol, price } of priceArray) {
    try {
      await PriceHistory.create({
        symbol,
        price,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error(`❌ Error saving price for ${symbol}:`, err.message);
    }
  }
}

// Define the updatePrices function
const updatePrices = async () => {
  priceUpdateCycle++;
  // Log only every 10th cycle
  if (priceUpdateCycle % 10 === 0) {
    console.log(`🔄 Price update cycle #${priceUpdateCycle}`);
  }
  try {
    console.log('🔄 Starting price update cycle...');
    
    // Get symbols to fetch
    const symbols = assets.map(asset => asset.symbol);
    console.log(`🔍 Fetching prices for: ${symbols.join(', ')}`);
    
    const results = await fetchCurrentPrices();
    // results is an object like { BTC: price, ETH: price, ... }
    if (results && Object.keys(results).length > 0) {
      // Convert results object to array of price objects for savePricesToDatabase
      const priceArray = Object.entries(results).map(([symbol, price]) => ({ symbol, price }));
      await savePricesToDatabase(priceArray);
      console.log(`✅ Updated ${priceArray.length} prices successfully`);
      // Update price histories
      await updatePriceHistories();
      // Emit to connected clients if io is available
      if (typeof io !== 'undefined') {
        io.emit('priceUpdate', priceArray);
        io.emit('portfolioUpdate', { message: 'Portfolio data updated' });
        io.emit('marketDataUpdate', { message: 'Market data updated' });
      }
    } else {
      console.error('⚠️ No prices fetched from fetchCurrentPrices');
    }
  } catch (error) {
    console.error('❌ Error in updatePrices:', error.message);
  }
};

// Define the updatePriceHistories function
const updatePriceHistories = async () => {
  priceHistoryCycle++;
  // Log only every 10th cycle
  if (priceHistoryCycle % 10 === 0) {
    console.log(`🔄 Price history update cycle #${priceHistoryCycle}`);
  }
  try {
    console.log('🔄 Updating price histories...');
    
    for (const asset of assets) {
      try {
        console.log(`📈 Fetching ${asset.symbol} (${asset.market}) - Attempt 1`);
        
        let price = null;
        let source = 'unknown';
        
        // Try different APIs based on market type
        if (asset.market === 'crypto') {
          // Try Binance first for crypto
          try {
            const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${asset.symbol}`, {
              timeout: 5000
            });
            price = parseFloat(response.data.price);
            source = 'Binance';
          } catch (error) {
            console.log(`📈 Fetching ${asset.symbol} (${asset.market}) - Attempt 2`);
            // Fallback to CoinGecko mapping
            const coinGeckoId = getCoinGeckoId(asset.symbol);
            if (coinGeckoId) {
              try {
                const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`, {
                  timeout: 5000
                });
                price = response.data[coinGeckoId]?.usd;
                source = 'CoinGecko';
              } catch (cgError) {
                console.log(`📈 Fetching ${asset.symbol} (${asset.market}) - Attempt 3`);
              }
            }
          }
        } else if (asset.market === 'forex') {
          // Try forex API
          const base = asset.symbol.slice(0, 3);
          const quote = asset.symbol.slice(3, 6);
          
          try {
            const response = await axios.get(`https://api.fxratesapi.com/latest?base=${base}&symbols=${quote}`, {
              timeout: 5000
            });
            price = response.data.rates[quote];
            source = 'fxratesapi.com';
          } catch (error) {
            console.log(`📈 Fetching ${asset.symbol} (${asset.market}) - Attempt 2`);
            try {
              const response = await axios.get(`https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`, {
                timeout: 5000
              });
              price = response.data.rates[quote];
              source = 'exchangerate.host';
            } catch (error2) {
              console.log(`📈 Fetching ${asset.symbol} (${asset.market}) - Attempt 3`);
            }
          }
        } else if (asset.market === 'stocks') {
          // Try Alpha Vantage for stocks
          try {
            const response = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset.symbol}&apikey=demo`, {
              timeout: 10000
            });
            price = parseFloat(response.data['Global Quote']?.['05. price']);
            source = 'Alpha Vantage';
          } catch (error) {
            console.log(`📈 Fetching ${asset.symbol} (${asset.market}) - Attempt 2`);
            try {
              const response = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${asset.symbol}`, {
                timeout: 5000
              });
              price = response.data.quoteResponse.result[0]?.regularMarketPrice;
              source = 'Yahoo Finance';
            } catch (error2) {
              console.log(`📈 Fetching ${asset.symbol} (${asset.market}) - Attempt 3`);
            }
          }
        } else if (asset.market === 'commodities') {
          // Use fallback prices for commodities
          const fallbackPrices = {
            'GOLD': 2650 + (Math.random() - 0.5) * 20,
            'OIL': 68.5 + (Math.random() - 0.5) * 5,
            'SILVER': 31.5 + (Math.random() - 0.5) * 2,
            'COPPER': 4.15 + (Math.random() - 0.5) * 0.3
          };
          
          try {
            const response = await axios.get(`https://api.metals.live/v1/spot/${asset.symbol.toLowerCase()}`, {
              timeout: 5000
            });
            price = response.data.price;
            source = 'metals.live';
          } catch (error) {
            console.log(`⚠️ Commodity API failed for ${asset.symbol}: ${error.message}`);
            price = fallbackPrices[asset.symbol] || 100;
            source = 'fallback';
            console.log(`📊 Using fallback price for ${asset.symbol}: ${price}`);
          }
        }
        
        if (price && !isNaN(price) && price > 0) {
          // Save to price history
          const priceHistory = new PriceHistory({
            symbol: asset.symbol,
            price: price,
            timestamp: new Date(),
            market: asset.market,
            source: source
          });
          
          await priceHistory.save();
          
          console.log(`✅ ${asset.symbol}: ${price} (${source})`);
          
          // Get count of price points for this symbol
          const count = await PriceHistory.countDocuments({ symbol: asset.symbol });
          console.log(`📊 ${asset.symbol}: ${count} price points`);
          
        } else {
          console.log(`❌ All attempts failed for ${asset.symbol}: ${price}`);
        }
        
      } catch (error) {
        console.error(`❌ Error fetching ${asset.symbol}:`, error.message);
      }
    }
    
    console.log('✅ Price history update completed');
    
  } catch (error) {
    console.error('❌ Error updating price histories:', error.message);
  }
};

// --- Enhanced signal generation function ---

async function generateSignals() {
  // Simple check - if MongoDB is not connected, skip silently
  if (mongoose.connection.readyState !== 1) {
    console.log('🔌 MongoDB not connected - skipping signal generation');
    return;
  }

  console.log('🤖 Starting signal generation...');
  
  // Check if we have enough price data (no more waiting loops)
  let assetsWithSufficientData = 0;
  
  for (const asset of assets) {
    const priceHistory = priceHistories[asset.symbol] || [];
    if (priceHistory.length >= 20) {
      assetsWithSufficientData++;
    }
  }
  
  if (assetsWithSufficientData === 0) {
    console.log('⚠️ No assets have sufficient price data yet - skipping signal generation');
    return;
  }
  
  console.log(`📊 Generating signals for ${assetsWithSufficientData}/${assets.length} assets with sufficient data`);

  // Process each asset type with specific logic
  for (const asset of assets) {
    try {
      const priceHistory = priceHistories[asset.symbol] || [];
      
      // Skip if insufficient data
      if (priceHistory.length < 20) {
        console.log(`⚪ Skipping ${asset.symbol} - only ${priceHistory.length} price points`);
        continue;
      }
      
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
      console.error(`❌ Error processing ${asset.symbol}:`, error.message);
    }
  }
  
  return null;
}

// Now set up the intervals AFTER the functions are defined
console.log('⏰ Setting up intervals...');

// Start price updates every 5 minutes (development)
setInterval(updatePrices, 30 * 1000); // every 30 seconds

// Start signal generation every 2 minutes  
signalGenerationInterval = setInterval(generateSignals, 2 * 60 * 1000);

// Initial calls
console.log('🚀 Starting initial updates...');
updatePrices();
updatePriceHistories();
setTimeout(generateSignals, 5000); // Wait 5 seconds before first signal generation


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
      // Reduced logging frequency - only log every 10th attempt
      if (Math.random() < 0.1) {
        console.log('🔌 MongoDB not connected - skipping market data update');
      }
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
      // Reduced logging frequency - only log every 10th attempt
      if (Math.random() < 0.1) {
        console.log('🔌 MongoDB not connected - skipping portfolio update');
      }
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
async function fetchLatestPriceWithRetry(symbol, market, maxRetries = 2) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // Add delay for rate limiting (stagger requests)
      if (retryCount > 0) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const price = await fetchLatestPrice(symbol, market);
      if (price !== null && price > 0) {
        return price;
      }
      
      // Only log on final attempt to reduce spam
      if (retryCount === maxRetries - 1) {
        console.log(`⚠️ API returned invalid price for ${symbol} after ${maxRetries} attempts`);
      }
      
      retryCount++;
    } catch (error) {
      // Only log errors on final attempt
      if (retryCount === maxRetries - 1) {
        console.error(`❌ API error for ${symbol}: ${error.message}`);
      }
      retryCount++;
    }
  }
  
  return null;
}

// Helper for retry logic with exponential backoff
async function retryWithBackoff(fn, retries = 3, delay = 1000, factor = 2) {
  let attempt = 0;
  let lastError;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise(res => setTimeout(res, delay * Math.pow(factor, attempt)));
      }
      attempt++;
    }
  }
  throw lastError;
}
// Example usage for a price fetch (Binance):
async function fetchBinancePrice(symbol) {
  return retryWithBackoff(
    async () => {
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, { timeout: 10000 });
      if (!response.data.price) throw new Error('No price in response');
      return parseFloat(response.data.price);
    },
    4, // retries
    1000, // initial delay
    2 // exponential factor
  );
}

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  // Don't log database connection errors repeatedly
  if (err.message && err.message.includes('bufferCommands')) {
    return res.status(503).json({
      error: 'Database temporarily unavailable',
      timestamp: new Date().toISOString(),
      suggestion: 'Please try again later or check /api/health for system status'
    });
  }
  
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
    } catch (err) {
      console.error('❌ Failed to close MongoDB connection:', err.message);
    }
    
    process.exit(0);
  });
};

// Start the HTTP server (add this at the end of the file)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});