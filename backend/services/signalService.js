const axios = require('axios');

// Helper for retry logic with exponential backoff
async function retryWithBackoff(fn, retries = 3, delay = 1000, factor = 2) {
  let attempt = 0;
  let lastError;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise(res => setTimeout(res, delay * Math.pow(factor, attempt)));
      }
      attempt++;
    }
  }
  throw lastError;
}

class MultiMarketSignalService {
  // Deprecated: All signal generation logic has been unified in app.js
  // This class is now a stub for compatibility.

  async generateAllSignals() {
    console.warn('[DEPRECATED] MultiMarketSignalService: Use the unified generateSignals logic in app.js instead.');
    return [];
  }
}

module.exports = MultiMarketSignalService;
