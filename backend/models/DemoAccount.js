const mongoose = require('mongoose');

const DemoAccountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  balance: { type: Number, default: 100000 },
  autoTrading: { type: Boolean, default: false },
  maxOpenPositions: { type: Number, default: 5 },
  openPositions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DemoPosition' }],
  tradeHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DemoTrade' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DemoAccount', DemoAccountSchema);