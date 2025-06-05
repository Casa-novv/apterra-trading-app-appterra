// API service layer
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { TradingSignal, MarketData, Portfolio, User, Position, Trade } from '../types';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 10000,
});

// Request interceptor to attach an auth token to every request, if it exists
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling that prevents redirect loops
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const currentPath = window.location.pathname;
    // Capture the called URL (if available)
    const errorUrl = error.config?.url || '';
    
    // If a 401 error occurs, and we're not already on the login page,
    // and the failing URL is not the verify endpoint, then clear the token and redirect.
    if (
      error.response?.status === 401 &&
      currentPath !== '/login' &&
      !errorUrl.includes('/auth/verify')
    ) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication API methods
export const authAPI = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },
  
  register: async (userData: { email: string; password: string; name: string }) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },
  
  verifyToken: async () => {
    const response = await apiClient.get('/auth/verify');
    return response.data;
  },
  
  refreshToken: async () => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },
};

// Other API methods remain unchanged...
export const signalsAPI = {
  getSignals: async (): Promise<TradingSignal[]> => {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.SIGNALS);
    return response.data;
  },
  
  getSignalById: async (id: string): Promise<TradingSignal> => {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.SIGNALS}/${id}`);
    return response.data;
  },
  
  getSignalsBySymbol: async (symbol: string): Promise<TradingSignal[]> => {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.SIGNALS}/symbol/${symbol}`);
    return response.data;
  },
};

export const marketAPI = {
  getMarketData: async (symbols: string[]): Promise<MarketData[]> => {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.MARKET_DATA, {
      params: { symbols: symbols.join(',') }
    });
    return response.data;
  },
  
  getHistoricalData: async (symbol: string, timeframe: string) => {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.MARKET_DATA}/historical`, {
      params: { symbol, timeframe }
    });
    return response.data;
  },
  
  getRealTimePrice: async (symbol: string) => {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.MARKET_DATA}/realtime/${symbol}`);
    return response.data;
  },
};

export const portfolioAPI = {
  getPortfolio: async (): Promise<Portfolio> => {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.PORTFOLIO);
    return response.data;
  },
  
  updatePortfolio: async (portfolioData: Partial<Portfolio>) => {
    const response = await apiClient.put(API_CONFIG.ENDPOINTS.PORTFOLIO, portfolioData);
    return response.data;
  },
  
  updatePosition: async (position: Position) => {
    const response = await apiClient.put(`${API_CONFIG.ENDPOINTS.PORTFOLIO}/position`, position);
    return response.data;
  },
  
  addPosition: async (position: Omit<Position, 'id'>) => {
    const response = await apiClient.post(`${API_CONFIG.ENDPOINTS.PORTFOLIO}/position`, position);
    return response.data;
  },
  
  removePosition: async (symbol: string) => {
    const response = await apiClient.delete(`${API_CONFIG.ENDPOINTS.PORTFOLIO}/position/${symbol}`);
    return response.data;
  },
  
  getRecentTrades: async (): Promise<Trade[]> => {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.PORTFOLIO}/trades`);
    return response.data;
  },
  
  getPortfolioPerformance: async (): Promise<number> => {
    // TODO: Replace with actual API call
    return 0; // placeholder
  },
};

export const newsAPI = {
  getMarketNews: async (symbols?: string[]) => {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.NEWS, {
      params: symbols ? { symbols: symbols.join(',') } : {}
    });
    return response.data;
  },
  
  getNewsBySymbol: async (symbol: string) => {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.NEWS}/symbol/${symbol}`);
    return response.data;
  },
};

// External API services for real data
export const externalAPI = {
  // Alpha Vantage for forex and stock data
  getForexData: async (fromSymbol: string, toSymbol: string) => {
    try {
      const response = await axios.get(API_CONFIG.EXTERNAL_APIS.ALPHA_VANTAGE, {
        params: {
          function: 'FX_INTRADAY',
          from_symbol: fromSymbol,
          to_symbol: toSymbol,
          interval: '5min',
          apikey: API_CONFIG.ALPHA_VANTAGE_KEY,
        }
      });
      return response.data;
    } catch (error) {
      console.error('Alpha Vantage API error:', error);
      throw error;
    }
  },
  
  // CoinGecko for crypto data
  getCryptoData: async (ids: string[]) => {
    try {
      const response = await axios.get(`${API_CONFIG.EXTERNAL_APIS.COINGECKO}/simple/price`, {
        params: {
          ids: ids.join(','),
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true,
        }
      });
      return response.data;
    } catch (error) {
      console.error('CoinGecko API error:', error);
      throw error;
    }
  },
  
  // News API for market news
  getFinancialNews: async (query: string = 'trading forex stocks') => {
    try {
      const response = await axios.get(`${API_CONFIG.EXTERNAL_APIS.NEWS_API}/everything`, {
        params: {
          q: query,
          domains: 'bloomberg.com,reuters.com,cnbc.com,marketwatch.com',
          sortBy: 'publishedAt',
          language: 'en',
          apiKey: API_CONFIG.NEWS_API_KEY,
        }
      });
      return response.data;
    } catch (error) {
      console.error('News API error:', error);
      throw error;
    }
  },
};

export default apiClient;