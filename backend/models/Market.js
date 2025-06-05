const mongoose = require('mongoose');

const MarketSchema = new mongoose.Schema({
  symbol: String,
  price: Number,
  change24h: Number,
  volume: Number,
  lastUpdated: Date
});

module.exports = mongoose.model('Market', MarketSchema);