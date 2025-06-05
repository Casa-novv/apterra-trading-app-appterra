const DemoAccount = require('../models/DemoAccount');
const DemoPosition = require('../models/DemoPosition');
const DemoTrade = require('../models/DemoTrade');
const getPrice = require('../utils/getPrice'); // You need a helper to fetch live prices

async function monitorDemoPositions() {
  const accounts = await DemoAccount.find({}).populate('openPositions');
  for (const account of accounts) {
    for (const posId of account.openPositions) {
      const position = await DemoPosition.findById(posId);
      if (!position) continue;
      const currentPrice = await getPrice(position.symbol);
      let shouldClose = false;
      let profit = 0;
      if (position.direction === 'BUY') {
        if (currentPrice >= position.targetPrice || currentPrice <= position.stopLoss) {
          shouldClose = true;
          profit = (currentPrice - position.entryPrice) * position.quantity;
        }
      } else {
        if (currentPrice <= position.targetPrice || currentPrice >= position.stopLoss) {
          shouldClose = true;
          profit = (position.entryPrice - currentPrice) * position.quantity;
        }
      }
      if (shouldClose) {
        // Close position
        await DemoTrade.create({
          symbol: position.symbol,
          entryPrice: position.entryPrice,
          exitPrice: currentPrice,
          quantity: position.quantity,
          direction: position.direction,
          profit,
          openedAt: position.openedAt,
          closedAt: new Date(),
          signalId: position.signalId,
        });
        account.balance += profit;
        account.openPositions = account.openPositions.filter(id => id.toString() !== posId.toString());
        await account.save();
        await DemoPosition.findByIdAndDelete(posId);
      }
    }
  }
}

module.exports = { monitorDemoPositions };