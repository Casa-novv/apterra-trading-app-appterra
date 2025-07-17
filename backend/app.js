require('dotenv').config();
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
// At the very top of your file (after imports but before any other code)
let priceUpdateInterval;
let signalGenerationInterval;
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

// Define the updatePrices function
const updatePrices = async () => {
  try {
    console.log('🔄 Starting price update cycle...');
    
    // Get symbols to fetch
    const symbols = assets.map(asset => asset.symbol);
    console.log(`🔍 Fetching prices for: ${symbols.join(', ')}`);
    
    const results = await fetchPricesFromMultipleAPIs(symbols);
    
    if (results.length > 0) {
      // Save to database
      await savePricesToDatabase(results);
      console.log(`✅ Updated ${results.length} prices successfully`);
      
      // Update price histories
      await updatePriceHistories();
      
      // Emit to connected clients if io is available
      if (typeof io !== 'undefined') {
        io.emit('priceUpdate', results);
        io.emit('portfolioUpdate', { message: 'Portfolio data updated' });
        io.emit('marketDataUpdate', { message: 'Market data updated' });
      }
    } else {
      console.log('⚠️ No prices were updated this cycle');
    }
    
  } catch (error) {
    console.error('❌ Error in updatePrices:', error.message);
  }
};

// Define the updatePriceHistories function
const updatePriceHistories = async () => {
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

// Define the signal generation function
const generateSignals = async () => {
  try {
    console.log('🤖 Starting enhanced signal generation...');
    const priceHistories = await PriceHistory.find({}).sort({ timestamp: -1 });
    const groupedBySymbol = {};
    priceHistories.forEach(entry => {
      if (!groupedBySymbol[entry.symbol]) groupedBySymbol[entry.symbol] = [];
      groupedBySymbol[entry.symbol].push(entry.price);
    });
    let signalsGenerated = 0;
    const timeframes = [60, 240, 1440]; // 1H, 4H, 1D
    for (const asset of userConfig.assets) {
      try {
        for (const tf of timeframes) {
          const priceHistory = getTimeframeHistory(groupedBySymbol, asset.symbol, tf);
          if (priceHistory.length < 26) continue; // For MACD/Bollinger
          // --- Technical Indicators ---
          const rsi = RSI.calculate({ values: priceHistory.slice(0, 14).reverse(), period: 14 });
          const macd = MACD.calculate({
            values: priceHistory.slice(0, 26).reverse(),
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
          });
          const stochastic = Stochastic.calculate({
            high: priceHistory.slice(0, 14).map(p => p * 1.01),
            low: priceHistory.slice(0, 14).map(p => p * 0.99),
            close: priceHistory.slice(0, 14),
            period: 14,
            signalPeriod: 3
          });
          const bb = BollingerBands.calculate({
            period: 20,
            values: priceHistory.slice(0, 20).reverse(),
            stdDev: 2
          });
          const lastRSI = rsi[rsi.length - 1];
          const lastMACD = macd[macd.length - 1];
          const lastStoch = stochastic[stochastic.length - 1];
          const lastBB = bb[bb.length - 1];
          // --- Sentiment ---
          const sentiment = await getSentimentScore(asset.symbol);
          // --- Signal logic ---
          let signalType = null;
          let confidence = 50;
          if (lastRSI < 30 && lastStoch.k < 20) {
            signalType = 'BUY';
            confidence = 70;
          } else if (lastRSI > 70 && lastStoch.k > 80) {
            signalType = 'SELL';
            confidence = 70;
          }
          if (lastMACD && lastMACD.MACD > lastMACD.signal) {
            if (signalType === 'BUY') confidence += 10;
            else signalType = 'BUY';
          } else if (lastMACD && lastMACD.MACD < lastMACD.signal) {
            if (signalType === 'SELL') confidence += 10;
            else signalType = 'SELL';
          }
          // Bollinger Bands
          const currentPrice = priceHistory[0];
          if (lastBB && currentPrice < lastBB.lower) {
            signalType = 'BUY';
            confidence += 5;
          } else if (lastBB && currentPrice > lastBB.upper) {
            signalType = 'SELL';
            confidence += 5;
          }
          // Sentiment
          if (sentiment > 0.5) {
            if (signalType === 'BUY') confidence += 5;
          } else if (sentiment < -0.5) {
            if (signalType === 'SELL') confidence += 5;
          }
          // Price momentum
          const previousPrice = priceHistory[1];
          const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
          if (priceChange > 1) {
            signalType = 'BUY';
            confidence += 5;
          } else if (priceChange < -1) {
            signalType = 'SELL';
            confidence += 5;
          }
          // Risk management
          const positionSize = calculatePositionSize(10000, 1, signalType === 'BUY' ? currentPrice * 0.98 : currentPrice * 1.02, currentPrice);
          // Only generate strong signals
          if (signalType && confidence >= userConfig.minConfidence) {
            const signal = new Signal({
              symbol: asset.symbol,
              type: signalType,
              confidence: Math.min(99, Math.round(confidence)),
              entryPrice: currentPrice,
              targetPrice: signalType === 'BUY' ? currentPrice * 1.02 : currentPrice * 0.98,
              stopLoss: signalType === 'BUY' ? currentPrice * 0.98 : currentPrice * 1.02,
              market: asset.market,
              timeframe: tf === 60 ? '1H' : tf === 240 ? '4H' : '1D',
              description: `${signalType} signal (RSI: ${lastRSI?.toFixed(2)}, MACD: ${lastMACD?.MACD?.toFixed(2)}, Stoch: ${lastStoch?.k?.toFixed(2)}, BB: ${lastBB ? `${lastBB.lower.toFixed(2)}-${lastBB.upper.toFixed(2)}` : 'n/a'}, Sentiment: ${sentiment.toFixed(2)})`,
              positionSize,
              timestamp: new Date()
            });
            await signal.save();
            signalsGenerated++;
            await sendSignalNotification(signal); // Notification
            console.log(`✅ ${asset.symbol} [${signal.timeframe}]: ${signalType} signal generated (${confidence}% confidence)`);
          } else {
            console.log(`⏭️ ${asset.symbol} [${tf}]: No strong signal generated (${signalType}, ${confidence}% confidence)`);
          }
        }
      } catch (error) {
        console.error(`❌ Error generating signal for ${asset.symbol}:`, error.message);
      }
    }
    // --- Recommendations for further improvements ---
    // 1. Add more technical indicators (Stochastic, Bollinger Bands, etc.)
    // 2. Use ML models for advanced signal generation
    // 3. Incorporate news/sentiment analysis for stocks/crypto
    // 4. Add multi-timeframe analysis (1H, 4H, 1D)
    // 5. Add risk management and position sizing logic
    // 6. Store and analyze past signal performance for feedback
    // 7. Allow user-configurable asset lists and signal thresholds
    // 8. Add more robust error handling and fallback APIs
    // 9. Support for more markets/assets dynamically
    // 10. Add notification/webhook integration for signals
    console.log(`🎯 Signal generation completed: ${signalsGenerated} signals generated`);
  } catch (error) {
    console.error('❌ Error in signal generation:', error.message);
  }
};

// Now set up the intervals AFTER the functions are defined
console.log('⏰ Setting up intervals...');

// Start price updates every 30 seconds
priceUpdateInterval = setInterval(updatePrices, 30 * 1000);

// Start signal generation every 2 minutes  
signalGenerationInterval = setInterval(generateSignals, 2 * 60 * 1000);

// Initial calls
console.log('🚀 Starting initial updates...');
updatePrices();
setTimeout(generateSignals, 5000); // Wait 5 seconds before first signal generation

// Graceful shutdown (place this at the very end of your file)
const gracefulShutdown = (signal) => {
  console.log(`📴 Received ${signal}. Shutting down gracefully...`);
  
  // Clear intervals if they exist
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    console.log('✅ Price update interval cleared');
  }
  if (signalGenerationInterval) {
    clearInterval(signalGenerationInterval);
    console.log('✅ Signal generation interval cleared');
  }
  
  // Close database connection
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close(() => {
      console.log('📴 Database connection closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

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
// Enhanced asset list with more cryptocurrencies and better coverage
const assets = [
  // Major Cryptocurrencies
  { symbol: 'BTCUSDT', market: 'crypto', priority: 'high' },
  { symbol: 'ETHUSDT', market: 'crypto', priority: 'high' },
  { symbol: 'BNBUSDT', market: 'crypto', priority: 'high' },
  { symbol: 'ADAUSDT', market: 'crypto', priority: 'medium' },
  { symbol: 'SOLUSDT', market: 'crypto', priority: 'high' },
  { symbol: 'XRPUSDT', market: 'crypto', priority: 'medium' },
  { symbol: 'DOTUSDT', market: 'crypto', priority: 'medium' },
  { symbol: 'AVAXUSDT', market: 'crypto', priority: 'medium' },
  { symbol: 'MATICUSDT', market: 'crypto', priority: 'medium' },
  { symbol: 'LINKUSDT', market: 'crypto', priority: 'medium' },
  
  // Major Forex Pairs
  { symbol: 'EURUSD', market: 'forex', priority: 'high' },
  { symbol: 'GBPUSD', market: 'forex', priority: 'high' },
  { symbol: 'USDJPY', market: 'forex', priority: 'high' },
  { symbol: 'AUDUSD', market: 'forex', priority: 'medium' },
  { symbol: 'USDCAD', market: 'forex', priority: 'medium' },
  { symbol: 'NZDUSD', market: 'forex', priority: 'low' },
  
  // Popular Stocks
  { symbol: 'AAPL', market: 'stocks', priority: 'high' },
  { symbol: 'TSLA', market: 'stocks', priority: 'high' },
  { symbol: 'GOOGL', market: 'stocks', priority: 'high' },
  { symbol: 'MSFT', market: 'stocks', priority: 'high' },
  { symbol: 'AMZN', market: 'stocks', priority: 'medium' },
  { symbol: 'NVDA', market: 'stocks', priority: 'medium' },
  { symbol: 'META', market: 'stocks', priority: 'medium' },
  
  // Commodities
  { symbol: 'GOLD', market: 'commodities', priority: 'high' },
  { symbol: 'SILVER', market: 'commodities', priority: 'medium' },
  { symbol: 'OIL', market: 'commodities', priority: 'high' },
  { symbol: 'COPPER', market: 'commodities', priority: 'low' },
];

// Enhanced price fetching with fallback mechanisms
const forexService = require('./services/forexService');
const commoditiesService = require('./services/commoditiesService');

// Enhanced price fetching with new services
async function fetchLatestPriceEnhanced(symbol, market) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📈 Fetching ${symbol} (${market}) - Attempt ${attempt}`);
      
      if (market === 'crypto') {
        // Crypto logic (keep your existing code)
        try {
          const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
          const response = await fetch(url, { timeout: 8000 });
          if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
          const data = await response.json();
          if (data.price) {
            console.log(`✅ ${symbol}: ${data.price} (Binance)`);
            return parseFloat(data.price);
          }
        } catch (binanceError) {
          console.warn(`⚠️ Binance failed for ${symbol}:`, binanceError.message);
          
          // Fallback: CoinGecko
          const coinId = getCoinGeckoId(symbol);
          if (coinId) {
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
            const response = await fetch(url, { timeout: 8000 });
            const data = await response.json();
            if (data[coinId]?.usd) {
              console.log(`✅ ${symbol}: ${data[coinId].usd} (CoinGecko)`);
              return data[coinId].usd;
            }
          }
        }
      } 
      
      else if (market === 'forex') {
        // Use new forex service
        const base = symbol.slice(0, 3);
        const quote = symbol.slice(3, 6);
        const result = await forexService.getExchangeRate(base, quote);
        console.log(`✅ ${symbol}: ${result.rate} (${result.source})`);
        return result.rate;
      }
      
      else if (market === 'stocks') {
        // Enhanced stock fetching (keep your existing Alpha Vantage + Yahoo logic)
        if (process.env.ALPHA_VANTAGE_KEY) {
          try {
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_KEY}`;
            const response = await fetch(url, { timeout: 10000 });
            const data = await response.json();
            const price = data['Global Quote']?.['05. price'];
            if (price) {
              console.log(`✅ ${symbol}: ${price} (Alpha Vantage)`);
              return parseFloat(price);
            }
          } catch (stockError) {
            console.warn(`⚠️ Alpha Vantage stocks failed for ${symbol}:`, stockError.message);
          }
        }
        
        // Fallback: Yahoo Finance
        try {
          const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
          const response = await fetch(url, { timeout: 8000 });
          const data = await response.json();
          const price = data.quoteResponse?.result?.[0]?.regularMarketPrice;
          if (price) {
            console.log(`✅ ${symbol}: ${price} (Yahoo Finance)`);
            return price;
          }
        } catch (yahooError) {
          console.warn(`⚠️ Yahoo Finance failed for ${symbol}:`, yahooError.message);
        }
      }
      
      else if (market === 'commodities') {
        // Use new commodities service
        const result = await commoditiesService.getCommodityPrice(symbol);
        console.log(`✅ ${symbol}: ${result.price} (${result.source})`);
        return result.price;
      }
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed for ${symbol}:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff
        console.log(`⏳ Retrying ${symbol} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ All attempts failed for ${symbol}:`, lastError?.message);
  return null;
}

// Helper function for CoinGecko IDs
function getCoinGeckoId(binanceSymbol) {
  const mapping = {
    'BTCUSDT': 'bitcoin',
    'ETHUSDT': 'ethereum',
    'BNBUSDT': 'binancecoin',
    'ADAUSDT': 'cardano',
    'SOLUSDT': 'solana',
    'XRPUSDT': 'ripple',
    'DOTUSDT': 'polkadot',
    'AVAXUSDT': 'avalanche-2',
    'MATICUSDT': 'matic-network',
    'LINKUSDT': 'chainlink',
  };
  return mapping[binanceSymbol] || null;
}

// Enhanced price history updater with better error handling
const priceHistoryInterval = setInterval(async () => {
  console.log('🔄 Updating price histories...');
  
  // Process high priority assets first
  const highPriorityAssets = assets.filter(asset => asset.priority === 'high');
  const mediumPriorityAssets = assets.filter(asset => asset.priority === 'medium');
  const lowPriorityAssets = assets.filter(asset => asset.priority === 'low');
  
  const processAssets = async (assetList, batchSize = 3) => {
    for (let i = 0; i < assetList.length; i += batchSize) {
      const batch = assetList.slice(i, i + batchSize);
      
      await Promise.allSettled(batch.map(async (asset) => {
        try {
          const price = await fetchLatestPriceEnhanced(asset.symbol, asset.market);
          if (price && price > 0) {
            if (!priceHistories[asset.symbol]) priceHistories[asset.symbol] = [];
            priceHistories[asset.symbol].push(price);
            
            // Keep last 50 prices for better technical analysis
            if (priceHistories[asset.symbol].length > 50) {
              priceHistories[asset.symbol] = priceHistories[asset.symbol].slice(-50);
            }
            
            console.log(`📊 ${asset.symbol}: ${priceHistories[asset.symbol].length} price points`);
          }
        } catch (error) {
          console.error(`❌ Error updating ${asset.symbol}:`, error.message);
        }
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < assetList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };
  
  // Process in priority order
  await processAssets(highPriorityAssets, 5);
  await processAssets(mediumPriorityAssets, 3);
  await processAssets(lowPriorityAssets, 2);
  
  console.log('✅ Price history update completed');
}, 30 * 1000); // Every 30 seconds

// Enhanced signal generation with better logging
const signalGenerationInterval = setInterval(async () => {
  if (mongoose.connection.readyState !== 1) {
    console.log('MongoDB not connected - skipping signal generation');
    return;
  }

  console.log('🤖 Starting enhanced signal generation...');
  console.log('📊 Current price histories:');
  
  // Log current state
  Object.keys(priceHistories).forEach(symbol => {
    console.log(`   ${symbol}: ${priceHistories[symbol]?.length || 0} data points`);
  });
  
  let signalsGenerated = 0;
  
  // Process assets in priority order
  const sortedAssets = assets.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  for (const asset of sortedAssets) {
    try {
      const priceHistory = priceHistories[asset.symbol] || [];
      
      // Require minimum 5 data points for testing (reduce from 20)
      if (priceHistory.length < 5) {
        console.log(`⏭️ ${asset.symbol}: Insufficient data (${priceHistory.length}/5)`);
        continue;
      }
      
      console.log(`🔍 Analyzing ${asset.symbol} (${asset.market})...`);
      
      // Enhanced technical analysis
      const analysis = await performEnhancedTechnicalAnalysis(priceHistory, asset);
      
      console.log(`📊 ${asset.symbol} Analysis:`, {
        shouldGenerate: analysis.shouldGenerateSignal,
        signalType: analysis.signalType,
        confidence: analysis.confidence,
        signalStrength: analysis.signalStrength,
        bullishSignals: analysis.analysis.bullishSignals,
        bearishSignals: analysis.analysis.bearishSignals
      });
      
      if (analysis.shouldGenerateSignal) {
        // Validate signal before saving
        const isValid = await validateSignal({
          symbol: asset.symbol,
          type: analysis.signalType,
          confidence: analysis.confidence,
          entryPrice: analysis.analysis.currentPrice,
          targetPrice: 0, // Will be calculated in generateEnhancedSignal
          stopLoss: 0,    // Will be calculated in generateEnhancedSignal
          market: asset.market,
          timestamp: new Date()
        });
        
        if (isValid) {
          const signal = await generateEnhancedSignal(asset, analysis);
          if (signal) {
            signalsGenerated++;
            logSignalGeneration(asset, analysis, signal);
          }
        } else {
          console.log(`⚠️ ${asset.symbol}: Signal validation failed`);
        }
      } else {
        console.log(`⏭️ ${asset.symbol}: No signal generated (insufficient strength)`);
      }
      
    } catch (error) {
      console.error(`❌ Error generating signal for ${asset.symbol}:`, error.message);
    }
  }
  
  console.log(`🎯 Signal generation completed: ${signalsGenerated} signals generated`);
  
  // Update performance tracking
  await trackSignalPerformance();
  
}, 2 * 60 * 1000); // Every 2 minutes

// Enhanced technical analysis function
async function performEnhancedTechnicalAnalysis(priceHistory, asset) {
  const prices = priceHistory.slice(-30); // Use last 30 prices
  const currentPrice = prices[prices.length - 1];
  const previousPrice = prices[prices.length - 2];
  
  // Calculate multiple technical indicators
  const sma5 = calculateSMA(prices, 5);
  const sma10 = calculateSMA(prices, 10);
  const sma20 = calculateSMA(prices, 20);
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const rsi = calculateRSI(prices, 14);
  const macd = calculateMACD(prices);
  const bollinger = calculateBollingerBands(prices, 20, 2);
  const stochastic = calculateStochastic(prices, 14);
  const volume = generateVolumeIndicator(asset.market);
  
  // Market-specific adjustments
  const marketMultiplier = getMarketMultiplier(asset.market);
  const volatility = calculateVolatility(prices);
  
  // Signal strength calculation
  let bullishSignals = 0;
  let bearishSignals = 0;
  let signalStrength = 0;
  
  // Moving Average Signals
  if (currentPrice > sma5 && sma5 > sma10 && sma10 > sma20) {
    bullishSignals += 2;
    signalStrength += 15;
  }
  if (currentPrice < sma5 && sma5 < sma10 && sma10 < sma20) {
    bearishSignals += 2;
    signalStrength += 15;
  }
  
  // MACD Signals
  if (macd.macd > macd.signal && macd.histogram > 0) {
    bullishSignals += 1;
    signalStrength += 10;
  }
  if (macd.macd < macd.signal && macd.histogram < 0) {
    bearishSignals += 1;
    signalStrength += 10;
  }
  
  // RSI Signals
  if (rsi < 30) {
    bullishSignals += 1; // Oversold
    signalStrength += 8;
  }
  if (rsi > 70) {
    bearishSignals += 1; // Overbought
    signalStrength += 8;
  }
  
  // Bollinger Bands
  if (currentPrice < bollinger.lower) {
    bullishSignals += 1;
    signalStrength += 7;
  }
  if (currentPrice > bollinger.upper) {
    bearishSignals += 1;
    signalStrength += 7;
  }
  
  // Stochastic
  if (stochastic.k < 20 && stochastic.d < 20) {
    bullishSignals += 1;
    signalStrength += 6;
  }
  if (stochastic.k > 80 && stochastic.d > 80) {
    bearishSignals += 1;
    signalStrength += 6;
  }
  
  // Price momentum
  const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
  if (Math.abs(priceChange) > 0.5) {
    signalStrength += 5;
  }
  
  // Volume confirmation (simulated)
  if (volume > 1.2) {
    signalStrength += 8;
  }
  
  // Determine signal type and confidence
  let signalType = null;
  let confidence = 0;
  
  if (bullishSignals > bearishSignals && bullishSignals >= 2) {
    signalType = 'BUY';
    confidence = Math.min(95, 50 + signalStrength * marketMultiplier);
  } else if (bearishSignals > bullishSignals && bearishSignals >= 2) {
    signalType = 'SELL';
    confidence = Math.min(95, 50 + signalStrength * marketMultiplier);
  }
  
  // Apply volatility adjustment
  if (volatility > 0.05) {
    confidence *= 0.9; // Reduce confidence in high volatility
  }
  
  // Market-specific confidence adjustments
  if (asset.market === 'crypto') {
    confidence *= 0.95; // Crypto is more volatile
  } else if (asset.market === 'forex') {
    confidence *= 1.05; // Forex is more predictable
  }
  
  const shouldGenerateSignal = signalType && confidence >= 60 && signalStrength >= 25;
  
  return {
    shouldGenerateSignal,
    signalType,
    confidence: Math.round(confidence),
    signalStrength,
    indicators: {
      sma5, sma10, sma20, ema12, ema26, rsi, macd, bollinger, stochastic, volume
    },
    analysis: {
      bullishSignals,
      bearishSignals,
      volatility,
      priceChange,
      currentPrice
    }
  };
}

// Enhanced signal generation
async function generateEnhancedSignal(asset, analysis) {
  try {
    const currentPrice = analysis.analysis.currentPrice;
    const volatility = analysis.analysis.volatility;
    
    // Calculate dynamic stop loss and take profit based on volatility and market
    let stopLossPercent, takeProfitPercent;
    
    switch (asset.market) {
      case 'crypto':
        stopLossPercent = Math.max(2, volatility * 100 * 0.8);
        takeProfitPercent = Math.max(4, volatility * 100 * 1.5);
        break;
      case 'forex':
        stopLossPercent = Math.max(0.5, volatility * 100 * 0.6);
        takeProfitPercent = Math.max(1, volatility * 100 * 1.2);
        break;
      case 'stocks':
        stopLossPercent = Math.max(1.5, volatility * 100 * 0.7);
        takeProfitPercent = Math.max(3, volatility * 100 * 1.3);
        break;
      case 'commodities':
        stopLossPercent = Math.max(1, volatility * 100 * 0.75);
        takeProfitPercent = Math.max(2, volatility * 100 * 1.4);
        break;
      default:
        stopLossPercent = 2;
        takeProfitPercent = 4;
    }
    
    // Calculate prices
    let entryPrice, targetPrice, stopLoss;
    
    if (analysis.signalType === 'BUY') {
      entryPrice = currentPrice;
      targetPrice = currentPrice * (1 + takeProfitPercent / 100);
      stopLoss = currentPrice * (1 - stopLossPercent / 100);
    } else {
      entryPrice = currentPrice;
      targetPrice = currentPrice * (1 - takeProfitPercent / 100);
      stopLoss = currentPrice * (1 + stopLossPercent / 100);
    }
    
    // Generate timeframe based on confidence and market
    const timeframes = ['15M', '1H', '4H', '1D'];
    let timeframe;
    if (analysis.confidence >= 85) timeframe = '1D';
    else if (analysis.confidence >= 75) timeframe = '4H';
    else if (analysis.confidence >= 65) timeframe = '1H';
    else timeframe = '15M';
    
    // Generate description
    const description = generateSignalDescription(asset, analysis);
    
    const signalData = {
      symbol: asset.symbol,
      market: asset.market,
      type: analysis.signalType,
      confidence: analysis.confidence,
      entryPrice:currentPrice,
      targetPrice,
      stopLoss,
      timeframe,
    }
  };
}
