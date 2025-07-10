const express = require('express');
const router = express.Router();
const marketService = require('../services/marketService');
const priceService = require('../services/priceService');

// Get API status
router.get('/api-status', (req, res) => {
  const status = priceService.getAPIStatus();
  res.json({
    timestamp: new Date().toISOString(),
    apis: status,
    summary: {
      available: Object.values(status).filter(api => api.available).length,
      total: Object.keys(status).length,
      inCooldown: Object.values(status).filter(api => api.inCooldown).length,
      totalFailures: Object.values(status).reduce((sum, api) => sum + api.failures, 0)
    }
  });
});

// Force refresh prices (for testing)
router.post('/refresh', async (req, res) => {
  try {
    const prices = await marketService.updatePrices();
    res.json({
      success: true,
      pricesUpdated: Object.keys(prices).length,
      prices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;