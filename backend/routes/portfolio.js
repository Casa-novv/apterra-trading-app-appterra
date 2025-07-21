const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const DemoAccount = require('../models/DemoAccount');

// Get portfolio for user
router.get('/:userId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId });
    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }
    res.json(portfolio);
  } catch (error) {
    console.error('❌ Error fetching portfolio:', error.message);
    res.status(500).json({ msg: 'Error fetching portfolio' });
  }
});

// Create portfolio for user
router.post('/:userId', async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.params.userId });
    if (portfolio) {
      return res.status(400).json({ msg: 'Portfolio already exists' });
    }
    
    portfolio = await Portfolio.create({
      user: req.params.userId,
      balance: req.body.balance || 100000,
      positions: [],
      tradeHistory: []
    });
    
    res.status(201).json(portfolio);
  } catch (error) {
    console.error('❌ Error creating portfolio:', error.message);
    res.status(500).json({ msg: 'Error creating portfolio' });
  }
});

// Update portfolio
router.patch('/:userId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOneAndUpdate(
      { user: req.params.userId },
      req.body,
      { new: true }
    );
    
    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }
    
    res.json(portfolio);
  } catch (error) {
    console.error('❌ Error updating portfolio:', error.message);
    res.status(500).json({ msg: 'Error updating portfolio' });
  }
});

// Get portfolio positions
router.get('/:userId/positions', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId });
    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }
    res.json(portfolio.positions || []);
  } catch (error) {
    console.error('❌ Error fetching portfolio positions:', error.message);
    res.status(500).json({ msg: 'Error fetching portfolio positions' });
  }
});

// Get portfolio trade history
router.get('/:userId/history', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId });
    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }
    res.json(portfolio.tradeHistory || []);
  } catch (error) {
    console.error('❌ Error fetching portfolio history:', error.message);
    res.status(500).json({ msg: 'Error fetching portfolio history' });
  }
});

// Add position to portfolio
router.post('/:userId/positions', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId });
    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }
    
    const position = {
      id: Date.now().toString(),
      symbol: req.body.symbol,
      type: req.body.type,
      quantity: req.body.quantity,
      entryPrice: req.body.entryPrice,
      currentPrice: req.body.currentPrice || req.body.entryPrice,
      targetPrice: req.body.targetPrice,
      stopLoss: req.body.stopLoss,
      openedAt: new Date(),
      status: 'open'
    };
    
    portfolio.positions.push(position);
    await portfolio.save();
    
    res.status(201).json(portfolio);
  } catch (error) {
    console.error('❌ Error adding position:', error.message);
    res.status(500).json({ msg: 'Error adding position' });
  }
});

// Update position in portfolio
router.patch('/:userId/positions/:positionId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId });
    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }
    
    const positionIndex = portfolio.positions.findIndex(
      pos => pos.id === req.params.positionId
    );
    
    if (positionIndex === -1) {
      return res.status(404).json({ msg: 'Position not found' });
    }
    
    portfolio.positions[positionIndex] = {
      ...portfolio.positions[positionIndex],
      ...req.body
    };
    
    await portfolio.save();
    res.json(portfolio);
  } catch (error) {
    console.error('❌ Error updating position:', error.message);
    res.status(500).json({ msg: 'Error updating position' });
  }
});

// Close position in portfolio
router.patch('/:userId/positions/:positionId/close', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.params.userId });
    if (!portfolio) {
      return res.status(404).json({ msg: 'Portfolio not found' });
    }
    
    const positionIndex = portfolio.positions.findIndex(
      pos => pos.id === req.params.positionId
    );
    
    if (positionIndex === -1) {
      return res.status(404).json({ msg: 'Position not found' });
    }
    
    const position = portfolio.positions[positionIndex];
    const closePrice = req.body.closePrice || position.currentPrice;
    
    // Calculate P&L
    let pnl = 0;
    if (position.type === 'BUY') {
      pnl = (closePrice - position.entryPrice) * position.quantity;
    } else {
      pnl = (position.entryPrice - closePrice) * position.quantity;
    }
    
    // Update position
    position.currentPrice = closePrice;
    position.pnl = pnl;
    position.status = 'closed';
    position.closedAt = new Date();
    
    // Move to trade history
    portfolio.tradeHistory.push(position);
    portfolio.positions.splice(positionIndex, 1);
    
    // Update balance
    portfolio.balance += pnl;
    
    await portfolio.save();
    res.json(portfolio);
  } catch (error) {
    console.error('❌ Error closing position:', error.message);
    res.status(500).json({ msg: 'Error closing position' });
  }
});

module.exports = router; 