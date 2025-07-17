const mongoose = require('mongoose');

const MarketDataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  change24h: {
    type: Number,
    default: 0
  },
  changePercent24h: {
    type: Number,
    default: 0
  },
  volume24h: {
    type: Number,
    default: 0
  },
  marketCap: {
    type: Number,
    default: 0
  },
  source: {
    type: String,
    default: 'unknown'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index on symbol and timestamp for efficient queries
MarketDataSchema.index({ symbol: 1, timestamp: -1 });

// TTL index to automatically delete old data after 30 days (separate field)
MarketDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('MarketData', MarketDataSchema);