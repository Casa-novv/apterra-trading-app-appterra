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
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Import Mongoose models
const Signal = require('./models/Signal');     // AI signals
const Market = require('./models/Market');       // Market data
const Portfolio = require('./models/Portfolio'); // Portfolio holdings

// Set up auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Demo account routes
const demoAccountRoutes = require('./routes/demoAccount');
app.use('/api/demo-account', demoAccountRoutes);

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
});

function sendAllActiveSignals(ws) {
  Signal.find({ status: 'active' })
    .then(signals => {
      signals.forEach(signal => {
        ws.send(JSON.stringify({ type: 'new_signal', signal }));
      });
    })
    .catch(err => console.error(err));
}

// --- Price Data Fetching ---
// External API keys.
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;

async function fetchFromCoinGecko() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';
  const response = await fetch(url);
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
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const data = await response.json();
    if (!data.price)
      throw new Error('Binance rate limit or bad data');
    prices[symbol.replace('USDT', '')] = parseFloat(data.price);
  }
  return { BTC: prices.BTC, ETH: prices.ETH, SOL: prices.SOL };
}

async function fetchFromAlphaVantage() {
  const symbols = { BTC: 'BTCUSD', ETH: 'ETHUSD', SOL: 'SOLUSD' };
  const prices = {};
  for (const [key, symbol] of Object.entries(symbols)) {
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${key}&to_currency=USD&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
    if (!rate)
      throw new Error('Alpha Vantage rate limit or bad data');
    prices[key] = parseFloat(rate);
  }
  return prices;
}

async function fetchFromTwelveData() {
  const url = `https://api.twelvedata.com/price?symbol=BTC/USD,ETH/USD,SOL/USD&apikey=${TWELVE_DATA_KEY}`;
  const response = await fetch(url);
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

setInterval(async () => {
  const prices = await fetchCurrentPrices();
  if (prices) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'prices', prices }));
      }
    });
  }
}, 5000);

// --- Market Data Endpoint & Update ---
app.get('/api/market/data', async (req, res) => {
  try {
    const market = await Market.find();
    res.json({ market, lastUpdated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ msg: 'Error fetching market data' });
  }
});

async function updateMarketData() {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';
    const response = await fetch(url);
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
    console.error('Error updating market data:', err);
  }
}
setInterval(updateMarketData, 5 * 60 * 1000);
updateMarketData();

// --- Portfolio Endpoints & Update ---
app.get('/api/portfolio', async (req, res) => {
  try {
    const portfolio = await Portfolio.find();
    res.json({ portfolio });
  } catch (err) {
    res.status(500).json({ msg: 'Error fetching portfolio' });
  }
});

async function updatePortfolioData() {
  try {
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
    console.error('Error updating portfolio data:', err);
  }
}
setInterval(updatePortfolioData, 5 * 60 * 1000);
setTimeout(updatePortfolioData, 10 * 1000);

// --- AI Signal Generation ---
// Deep learning prediction and sentiment analysis functions

let trendModel = null;
(async () => {
  try {
    trendModel = await tf.loadLayersModel('https://example.com/model.json');
    console.log('Trend model loaded');
  } catch (err) {
    console.error('Failed to load trend model:', err);
  }
})();

async function predictTrend(priceHistory) {
  if (!trendModel || priceHistory.length < 20) return 0;
  try {
    const inputTensor = tf.tensor2d([priceHistory.slice(-20)], [1, 20]);
    const prediction = trendModel.predict(inputTensor).dataSync()[0];
    return prediction;
  } catch (err) {
    console.error('Error in deep learning prediction:', err);
    return 0;
  }
}

async function analyzeNewsSentiment(symbol) {
  try {
    const response = await axios.get(`https://newsapi.org/v2/everything?q=${symbol}&apiKey=${process.env.NEWS_API_KEY}`);
    const scores = response.data.articles.map(article => {
      return new Sentiment().analyze(article.title).score;
    });
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  } catch (err) {
    console.error('Error fetching news sentiment:', err);
    return 0;
  }
}

async function generateSignal(symbol, market) {
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
      const response = await fetch(url);
      const data = await response.json();
      return parseFloat(data.price);
    } else if (market === 'forex') {
      // Alpha Vantage for forex
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol.slice(0,3)}&to_currency=${symbol.slice(3,6)}&apikey=${ALPHA_VANTAGE_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
      return rate ? parseFloat(rate) : null;
    } else if (market === 'stocks') {
      // Alpha Vantage for stocks
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      const price = data['Global Quote']?.['05. price'];
      return price ? parseFloat(price) : null;
    } else if (market === 'commodities') {
      // Twelve Data for commodities (e.g., GOLD, OIL)
      const url = `https://api.twelvedata.com/price?symbol=${symbol}/USD&apikey=${TWELVE_DATA_KEY}`;
      const response = await fetch(url);
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

setInterval(async () => {
  for (const asset of assets) {
    const price = await fetchLatestPrice(asset.symbol, asset.market);
    if (!price) continue;
    if (!priceHistories[asset.symbol]) priceHistories[asset.symbol] = [];
    priceHistories[asset.symbol].push(price);
    // Keep only the last 30 prices
    if (priceHistories[asset.symbol].length > 30) {
      priceHistories[asset.symbol] = priceHistories[asset.symbol].slice(-30);
    }
  }
}, 30 * 1000); // every 30 seconds

// --- Signal generation (every 15 minutes) ---
setInterval(async () => {
  for (const asset of assets) {
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
  }
}, 15 * 60 * 1000); // every 15 minutes

// --- Signals API Endpoint ---
app.get('/api/signals', async (req, res) => {
  try {
    const signals = await Signal.find({ status: 'active' });
    res.json({ signals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  mongoose.connection.close();
  server.close(() => process.exit(0));
});

// --- Start the Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (!ALPHA_VANTAGE_KEY) console.warn('Alpha Vantage API key missing');
if (!TWELVE_DATA_KEY) console.warn('Twelve Data API key missing');
if (!process.env.NEWS_API_KEY) console.warn('News API key missing');

// Fetch historical close prices from Binance (for crypto symbols)
async function getPriceHistory(symbol, length = 50) {
  // Binance expects symbols like BTCUSDT, ETHUSDT, etc.
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=${length}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  // Each item: [openTime, open, high, low, close, ...]
  return data.map(item => parseFloat(item[4])); // close prices
}

// --- Demo Position Monitoring Job ---
const { monitorDemoPositions } = require('./jobs/demoPositionMonitor');
setInterval(monitorDemoPositions, 60 * 1000); // every minute