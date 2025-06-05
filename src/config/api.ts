// API configuration and endpoints
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api',
  WEBSOCKET_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:5000',
  
  // External API Keys (store in environment variables)
  ALPHA_VANTAGE_KEY: process.env.REACT_APP_ALPHA_VANTAGE_KEY,
  FINANCIAL_MODELING_PREP_KEY: process.env.REACT_APP_FINANCIAL_MODELING_PREP_KEY,
  NEWS_API_KEY: process.env.REACT_APP_NEWS_API_KEY,
  
  // API Endpoints
  ENDPOINTS: {
    SIGNALS: '/signals',
    MARKET_DATA: '/market-data',
    PORTFOLIO: '/portfolio',
    NEWS: '/news',
  },
  
  EXTERNAL_APIS: {
    ALPHA_VANTAGE: 'https://www.alphavantage.co/query',
    COINGECKO: 'https://api.coingecko.com/api/v3',
    NEWS_API: 'https://newsapi.org/v2',
  },
};

// Rate limiting configuration
export const RATE_LIMITS = {
  ALPHA_VANTAGE: 5, // calls per minute
  FINANCIAL_MODELING_PREP: 250, // calls per day for free tier
  NEWS_API: 1000, // calls per day for free tier
};
export {};