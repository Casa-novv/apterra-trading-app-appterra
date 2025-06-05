const mongoose = require('mongoose');

const PortfolioSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  amount: { type: Number, required: true },
  entryPrice: { type: Number, required: true },
  currentPrice: Number,
  pnl: Number,
  pnlPercent: Number,
  openedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'active' }
});

module.exports = mongoose.model('Portfolio', PortfolioSchema);
