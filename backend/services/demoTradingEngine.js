const DemoAccount = require('../models/DemoAccount');
const DemoPosition = require('../models/DemoPosition');
const DemoTrade = require('../models/DemoTrade');
const Signal = require('../models/Signal');

async function processSignalForAllDemoUsers(signal) {
  const demoAccounts = await DemoAccount.find({ autoTrading: true }).populate('openPositions');
  for (const account of demoAccounts) {
    // Example: Only trade if confidence > 70 and not too many open positions
    if (
      signal.confidence >= 70 &&
      account.openPositions.length < account.maxOpenPositions
    ) {
      // Open position
      const position = await DemoPosition.create({
        symbol: signal.symbol,
        entryPrice: signal.entryPrice,
        quantity: 1, // or calculate based on balance
        direction: signal.type,
        stopLoss: signal.stopLoss,
        targetPrice: signal.targetPrice,
        openedAt: new Date(),
        signalId: signal._id,
      });
      account.openPositions.push(position._id);
      await account.save();
    }
  }
}

module.exports = { processSignalForAllDemoUsers };