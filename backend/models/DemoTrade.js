const mongoose = require('mongoose');
const DemoTradeSchema = new mongoose.Schema({
  symbol: String,
  entryPrice: Number,
  exitPrice: Number,
  quantity: Number,
  direction: String,
  profit: Number,
  openedAt: Date,
  closedAt: Date,
  signalId: String,
});
module.exports = mongoose.model('DemoTrade', DemoTradeSchema);