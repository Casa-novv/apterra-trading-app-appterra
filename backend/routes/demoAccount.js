const express = require('express');
const router = express.Router();
const DemoAccount = require('../models/DemoAccount');
const DemoPosition = require('../models/DemoPosition');

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
    type: direction, // or direction: direction,
    quantity,
    entryPrice,
    currentPrice: entryPrice, // <-- set this!
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

    // Use currentPrice if provided, else fallback to entryPrice
    const currentPrice = position.currentPrice ?? position.entryPrice;

    // Calculate P&L
    let pnl = 0;
    if (position.direction === 'BUY' || position.type === 'BUY') {
      pnl = (currentPrice - position.entryPrice) * position.quantity;
    } else {
      pnl = (position.entryPrice - currentPrice) * position.quantity;
    }
    position.pnl = pnl;
    position.status = 'closed';
    position.closedAt = new Date();
    await position.save?.();

    // Update account balance
    account.balance += pnl;

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

    for (const position of account.openPositions) {
      const currentPrice = position.currentPrice ?? position.entryPrice;
      let pnl = 0;
      if (position.direction === 'BUY' || position.type === 'BUY') {
        pnl = (currentPrice - position.entryPrice) * position.quantity;
      } else {
        pnl = (position.entryPrice - currentPrice) * position.quantity;
      }
      position.pnl = pnl;
      position.status = 'closed';
      position.closedAt = new Date();
      await position.save?.();
      account.balance += pnl;
      account.tradeHistory.push(position._id);
    }
    account.openPositions = [];
    await account.save();

    const updatedAccount = await DemoAccount.findOne({ user: userId })
      .populate('openPositions')
      .populate('tradeHistory');
    res.json(updatedAccount);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to close all positions', error: err.message });
  }
});

module.exports = router;