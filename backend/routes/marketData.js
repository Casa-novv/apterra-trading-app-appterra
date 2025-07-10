const express = require('express');
const router = express.Router();
const axios = require('axios');

// Mock market data for demo purposes
const generateMockMarketData = (symbols) => {
  const data = {};
  
  symbols.forEach(symbol => {
    // Generate realistic mock data
    const basePrice = symbol.includes('USD') ? 
      (Math.random() * 2 + 0.5) : // Forex rates
      (Math.random() * 50000 + 1000); // Crypto/stock prices
    
    const change = (Math.random() - 0.5) * 10; // -5% to +5% change
    
    data[symbol] = {
      price: basePrice,
      change: change,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString(),
    };
  });
  
  return data;
};

// Get market data for multiple symbols
router.get('/', async (req, res) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ message: 'Symbols parameter is required' });
    }
    
    const symbolArray = symbols.split(',');
    
    // For demo purposes, return mock data
    // In production, you'd fetch from real APIs
    const marketData = generateMockMarketData(symbolArray);
    
    res.json(marketData);
  } catch (error) {
    console.error('Market data fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch market data' });
  }
});

// Get specific symbol data
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const marketData = generateMockMarketData([symbol]);
    res.json(marketData[symbol]);
  } catch (error) {
    console.error('Symbol data fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch symbol data' });
  }
});

module.exports = router;