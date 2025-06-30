const express = require('express');
const router = express.Router();
const axios = require('axios');
const DemoAccount = require('../models/DemoAccount');
const DemoPosition = require('../models/DemoPosition');

// Helper function to fetch current price
const fetchCurrentPrice = async (symbol) => {
  try {
    // Use your existing price API endpoint
    const response = await axios.get(`http://localhost:3000/api/price/${symbol}`);
    return response.data.price;
  } catch (error) {
    console.log(`❌ Failed to fetch current price for ${symbol}:`, error.message);
    return null;
  }
};

// Get demo account for user
router.get('/:userId', async (req, res) => {
  const account = await DemoAccount.findOne({ user: req.params.userId })
    .populate('openPositions')
    .populate('tradeHistory');
  if (!account) return res.status(404).json({ msg: 'No demo account found' });
  res.json(account);
});

// Create demo account for user
router.post('/:userId', async (req, res) => {
  let account = await DemoAccount.findOne({ user: req.params.userId });
  if (account) return res.status(400).json({ msg: 'Demo account already exists' });
  account = await DemoAccount.create({ user: req.params.userId });
  res.json(account);
});

// Reset demo account for user
router.patch('/:userId/reset', async (req, res) => {
  const { balance } = req.body;
  const account = await DemoAccount.findOne({ user: req.params.userId });
  if (!account) return res.status(404).json({ msg: 'No demo account found' });
  account.balance = balance || 100000;
  account.openPositions = [];
  account.tradeHistory = [];
  await account.save();
  res.json(account);
});

// Create a new demo position for user
router.post('/:userId/positions', async (req, res) => {
  const { symbol, direction, quantity, entryPrice, targetPrice, stopLoss, signalId, market, timeframe } = req.body;
  const account = await DemoAccount.findOne({ user: req.params.userId });
  if (!account) return res.status(404).json({ msg: 'No demo account found' });

  // Create the position
  const position = await DemoPosition.create({
    user: req.params.userId,
    symbol,
    type: direction,
    quantity,
    entryPrice,
    currentPrice: entryPrice,
    targetPrice,
    stopLoss,
    signalId,
    market,
    timeframe,
    openedAt: new Date(),
    status: 'open',
  });

  // Add to account's openPositions
  account.openPositions.push(position._id);
  await account.save();

  // Return the updated account with populated openPositions
  const updatedAccount = await DemoAccount.findOne({ user: req.params.userId })
    .populate('openPositions')
    .populate('tradeHistory');
  res.json(updatedAccount);
});

// Get all open positions for a user's demo account
router.get('/:userId/positions', async (req, res) => {
  const account = await DemoAccount.findOne({ user: req.params.userId }).populate('openPositions');
  if (!account) return res.status(404).json({ msg: 'No demo account found' });
  res.json(account.openPositions);
});

// Close a single open position
router.patch('/:userId/positions/:positionId/close', async (req, res) => {
  try {
    const { userId, positionId } = req.params;
    const account = await DemoAccount.findOne({ user: userId })
      .populate('openPositions')
      .populate('tradeHistory');
    if (!account) return res.status(404).json({ msg: 'No demo account found' });

    // Find the position
    const positionIndex = account.openPositions.findIndex(
      (pos) => pos._id.toString() === positionId
    );
    if (positionIndex === -1) return res.status(404).json({ msg: 'Position not found' });

    // Get the position doc
    const position = account.openPositions[positionIndex];

    // 🔥 FETCH CURRENT PRICE BEFORE CLOSING
    const livePrice = await fetchCurrentPrice(position.symbol);
    const currentPrice = livePrice || position.currentPrice || position.entryPrice;
    
    const entryPrice = Number(position.entryPrice);
    const quantity = Number(position.quantity);
    const positionType = position.type || position.direction || 'BUY';

    console.log(`💰 Closing ${position.symbol}:`);
    console.log(`  - Entry Price: ${entryPrice}`);
    console.log(`  - Live Price: ${livePrice}`);
    console.log(`  - Current Price (used): ${currentPrice}`);
    console.log(`  - Quantity: ${quantity}`);
    console.log(`  - Type: ${positionType}`);

    // Calculate P&L
    let pnl = 0;
    if (positionType === 'BUY') {
      pnl = (currentPrice - entryPrice) * quantity;
      console.log(`  - BUY P&L: (${currentPrice} - ${entryPrice}) * ${quantity} = ${pnl}`);
    } else if (positionType === 'SELL') {
      pnl = (entryPrice - currentPrice) * quantity;
      console.log(`  - SELL P&L: (${entryPrice} - ${currentPrice}) * ${quantity} = ${pnl}`);
    }

    console.log(`  - Old Balance: ${account.balance}`);

    // 🔥 KEY FIX: Add P&L to account balance
    account.balance = Number(account.balance) + Number(pnl);

    console.log(`  - New Balance: ${account.balance}`);

    // Update position with live price and P&L
    position.currentPrice = currentPrice;
    position.pnl = pnl;
    position.status = 'closed';
    position.closedAt = new Date();
    
    if (position.save) {
      await position.save();
    }

    // Move to tradeHistory
    account.tradeHistory.push(position._id);
    account.openPositions.splice(positionIndex, 1);
    await account.save();

    // Return updated account
    const updatedAccount = await DemoAccount.findOne({ user: userId })
      .populate('openPositions')
      .populate('tradeHistory');
    res.json(updatedAccount);
  } catch (err) {
    console.error('❌ Error closing position:', err);
    res.status(500).json({ msg: 'Failed to close position', error: err.message });
  }
});

// Close all open positions
router.patch('/:userId/positions/close-all', async (req, res) => {
  try {
    const { userId } = req.params;
    const account = await DemoAccount.findOne({ user: userId })
      .populate('openPositions')
      .populate('tradeHistory');
    if (!account) return res.status(404).json({ msg: 'No demo account found' });

    console.log(`💰 Closing all positions for user ${userId}`);
    console.log(`  Old Balance: ${account.balance}`);

    let totalPnL = 0;

    for (const position of account.openPositions) {
      // 🔥 FETCH CURRENT PRICE BEFORE CLOSING
      const livePrice = await fetchCurrentPrice(position.symbol);
      const currentPrice = livePrice || position.currentPrice || position.entryPrice;
      
      const entryPrice = Number(position.entryPrice);
      const quantity = Number(position.quantity);
      const positionType = position.type || position.direction || 'BUY';

      console.log(`🔍 Position ${position.symbol} details:`);
      console.log(`  - Entry Price: ${entryPrice}`);
      console.log(`  - Live Price: ${livePrice}`);
      console.log(`  - Current Price (used): ${currentPrice}`);
      console.log(`  - Quantity: ${quantity}`);
      console.log(`  - Type: ${positionType}`);

      let pnl = 0;
      if (positionType === 'BUY') {
        pnl = (currentPrice - entryPrice) * quantity;
        console.log(`  - BUY P&L: (${currentPrice} - ${entryPrice}) * ${quantity} = ${pnl}`);
      } else if (positionType === 'SELL') {
        pnl = (entryPrice - currentPrice) * quantity;
        console.log(`  - SELL P&L: (${entryPrice} - ${currentPrice}) * ${quantity} = ${pnl}`);
      }

      totalPnL += pnl;

      console.log(`  ${position.symbol}: P&L = ${pnl}`);

      // Update position with live price and P&L
      position.currentPrice = currentPrice;
      position.pnl = pnl;
      position.status = 'closed';
      position.closedAt = new Date();
      
      if (position.save) {
        await position.save();
      }
      
      account.tradeHistory.push(position._id);
    }

    account.balance = Number(account.balance) + Number(totalPnL);

    console.log(`  Total P&L: ${totalPnL}`);
    console.log(`  New Balance: ${account.balance}`);

    account.openPositions = [];
    await account.save();

    const updatedAccount = await DemoAccount.findOne({ user: userId })
      .populate('openPositions')
      .populate('tradeHistory');
    res.json(updatedAccount);
  } catch (err) {
    console.error('❌ Error closing all positions:', err);
    res.status(500).json({ msg: 'Failed to close all positions', error: err.message });
  }
});

module.exports = router;