const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  type: { type: String, required: true }, // 'BUY' or 'SELL'
  confidence: { type: Number, required: true },
  entryPrice: { type: Number, required: true },
  targetPrice: { type: Number, required: true },
  stopLoss: { type: Number, required: true },
  timeframe: { type: String, required: true },
  market: { type: String, required: true }, // e.g., 'crypto', 'forex', 'stocks', 'commodities'
  description: String,
  reasoning: String,
  technicalIndicators: { type: mongoose.Schema.Types.Mixed }, // Stores an object with RSI, MACD, Trend, etc.
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  source: String,
  risk: String
});

module.exports = mongoose.model('Signal', SignalSchema);