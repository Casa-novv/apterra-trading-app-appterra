const mongoose = require('mongoose');
// Example DemoPosition schema
const DemoPositionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  symbol: String,
  type: String, // or 'direction'
  quantity: Number,
  entryPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  // ... other fields ...
});
module.exports = mongoose.model('DemoPosition', DemoPositionSchema);