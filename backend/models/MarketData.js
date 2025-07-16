const mongoose = require('mongoose');

const marketDataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  market: {
    type: String,
    required: true,
    enum: ['crypto', 'forex', 'stocks', 'commodities']
  },
  price: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    default: 0
  },
  change24h: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    required: true
  }
});

// Create compound index for efficient queries
marketDataSchema.index({ symbol: 1, timestamp: -1 });
marketDataSchema.index({ market: 1, timestamp: -1 });

// TTL index to automatically delete old data after 7 days
marketDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('MarketData', marketDataSchema);