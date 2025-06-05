import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  spread?: number;
}

export interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketNews {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  url: string;
  publishedAt: string;
  impact: 'low' | 'medium' | 'high';
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  date: string;
  time: string;
  impact: 'low' | 'medium' | 'high';
  forecast?: string;
  previous?: string;
  actual?: string;
}

interface MarketState {
  // Market data
  marketData: Record<string, MarketData>;
  watchlist: string[];
  
  // Charts
  chartData: Record<string, ChartData[]>;
  selectedTimeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
  
  // News and events
  news: MarketNews[];
  economicEvents: EconomicEvent[];
  
  // Loading states
  loading: {
    marketData: boolean;
    chartData: boolean;
    news: boolean;
    events: boolean;
  };
  
  // Error states
  error: {
    marketData: string | null;
    chartData: string | null;
    news: string | null;
    events: string | null;
  };
  
  // Connection status
  isConnected: boolean;
  lastUpdate: number | null;
}

const initialState: MarketState = {
  marketData: {},
  watchlist: ['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD', 'AAPL', 'GOOGL', 'TSLA'],
  chartData: {},
  selectedTimeframe: '1h',
  news: [],
  economicEvents: [],
  loading: {
    marketData: false,
    chartData: false,
    news: false,
    events: false,
  },
  error: {
    marketData: null,
    chartData: null,
    news: null,
    events: null,
  },
  isConnected: false,
  lastUpdate: null,
};

// Async thunks
export const fetchMarketData = createAsyncThunk(
  'market/fetchMarketData',
  async (symbols: string[]) => {
    const response = await fetch('/api/market/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbols }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch market data');
    }
    
    return response.json();
  }
);

export const fetchChartData = createAsyncThunk(
  'market/fetchChartData',
  async ({ symbol, timeframe, limit = 100 }: { symbol: string; timeframe: string; limit?: number }) => {
    const response = await fetch(`/api/market/chart/${symbol}?timeframe=${timeframe}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch chart data');
    }
    
    const data = await response.json();
    return { symbol, data: data.data };
  }
);

export const fetchMarketNews = createAsyncThunk(
  'market/fetchNews',
  async (limit: number = 20) => {
    const response = await fetch(`/api/market/news?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch market news');
    }
    
    return response.json();
  }
);

export const fetchEconomicEvents = createAsyncThunk(
  'market/fetchEconomicEvents',
  async () => {
    const response = await fetch('/api/market/economic-events');
    
    if (!response.ok) {
      throw new Error('Failed to fetch economic events');
    }
    
    return response.json();
  }
);

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    // Real-time market data updates
    updateMarketData: (state, action: PayloadAction<MarketData>) => {
      const data = action.payload;
      state.marketData[data.symbol] = data;
      state.lastUpdate = Date.now();
      state.isConnected = true;
    },
    
    updateMultipleMarketData: (state, action: PayloadAction<MarketData[]>) => {
      action.payload.forEach(data => {
        state.marketData[data.symbol] = data;
      });
      state.lastUpdate = Date.now();
      state.isConnected = true;
    },
    
    // Chart data updates
    updateChartData: (state, action: PayloadAction<{ symbol: string; data: ChartData }>) => {
      const { symbol, data } = action.payload;
      if (!state.chartData[symbol]) {
        state.chartData[symbol] = [];
      }
      
      // Add new data point and keep only last 1000 points
      state.chartData[symbol].push(data);
      if (state.chartData[symbol].length > 1000) {
        state.chartData[symbol] = state.chartData[symbol].slice(-1000);
      }
    },
    
    // Watchlist management
    addToWatchlist: (state, action: PayloadAction<string>) => {
      const symbol = action.payload;
      if (!state.watchlist.includes(symbol)) {
        state.watchlist.push(symbol);
      }
    },
    
    removeFromWatchlist: (state, action: PayloadAction<string>) => {
      const symbol = action.payload;
      state.watchlist = state.watchlist.filter(s => s !== symbol);
    },
    
    reorderWatchlist: (state, action: PayloadAction<string[]>) => {
      state.watchlist = action.payload;
    },
    
    // Timeframe selection
    setTimeframe: (state, action: PayloadAction<'1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'>) => {
      state.selectedTimeframe = action.payload;
    },
    
    // Connection status
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    
    // Clear errors
    clearError: (state, action: PayloadAction<keyof MarketState['error']>) => {
      state.error[action.payload] = null;
    },
    
    clearAllErrors: (state) => {
      state.error = {
        marketData: null,
        chartData: null,
        news: null,
        events: null,
      };
    },
    
    // Reset state
    resetMarketState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch market data
    builder
      .addCase(fetchMarketData.pending, (state) => {
        state.loading.marketData = true;
        state.error.marketData = null;
      })
      .addCase(fetchMarketData.fulfilled, (state, action) => {
        state.loading.marketData = false;
        action.payload.forEach((data: MarketData) => {
          state.marketData[data.symbol] = data;
        });
        state.lastUpdate = Date.now();
      })
      .addCase(fetchMarketData.rejected, (state, action) => {
        state.loading.marketData = false;
        state.error.marketData = action.error.message || 'Failed to fetch market data';
      });
    
    // Fetch chart data
    builder
      .addCase(fetchChartData.pending, (state) => {
        state.loading.chartData = true;
        state.error.chartData = null;
      })
      .addCase(fetchChartData.fulfilled, (state, action) => {
        state.loading.chartData = false;
        const { symbol, data } = action.payload;
        state.chartData[symbol] = data;
      })
      .addCase(fetchChartData.rejected, (state, action) => {
        state.loading.chartData = false;
        state.error.chartData = action.error.message || 'Failed to fetch chart data';
      });
    
    // Fetch market news
    builder
      .addCase(fetchMarketNews.pending, (state) => {
        state.loading.news = true;
        state.error.news = null;
      })
      .addCase(fetchMarketNews.fulfilled, (state, action) => {
        state.loading.news = false;
        state.news = action.payload;
      })
      .addCase(fetchMarketNews.rejected, (state, action) => {
        state.loading.news = false;
        state.error.news = action.error.message || 'Failed to fetch market news';
      });
    
    // Fetch economic events
    builder
      .addCase(fetchEconomicEvents.pending, (state) => {
        state.loading.events = true;
        state.error.events = null;
      })
      .addCase(fetchEconomicEvents.fulfilled, (state, action) => {
        state.loading.events = false;
        state.economicEvents = action.payload;
      })
      .addCase(fetchEconomicEvents.rejected, (state, action) => {
        state.loading.events = false;
        state.error.events = action.error.message || 'Failed to fetch economic events';
      });
  },
});

export const {
  updateMarketData,
  updateMultipleMarketData,
  updateChartData,
  addToWatchlist,
  removeFromWatchlist,
  reorderWatchlist,
  setTimeframe,
  setConnectionStatus,
  clearError,
  clearAllErrors,
  resetMarketState,
} = marketSlice.actions;

export default marketSlice.reducer;

// Selectors
export const selectMarketData = (state: { market: MarketState }) => state.market.marketData;
export const selectWatchlist = (state: { market: MarketState }) => state.market.watchlist;
export const selectChartData = (state: { market: MarketState }) => state.market.chartData;
export const selectMarketNews = (state: { market: MarketState }) => state.market.news;
export const selectEconomicEvents = (state: { market: MarketState }) => state.market.economicEvents;
export const selectMarketLoading = (state: { market: MarketState }) => state.market.loading;
export const selectMarketErrors = (state: { market: MarketState }) => state.market.error;
export const selectConnectionStatus = (state: { market: MarketState }) => state.market.isConnected;
export const selectSelectedTimeframe = (state: { market: MarketState }) => state.market.selectedTimeframe;

// Complex selectors
export const selectWatchlistData = (state: { market: MarketState }) => {
  const { watchlist, marketData } = state.market;
  return watchlist.map(symbol => marketData[symbol]).filter(Boolean);
};

export const selectSymbolData = (symbol: string) => (state: { market: MarketState }) => {
  return state.market.marketData[symbol];
};

export const selectSymbolChartData = (symbol: string) => (state: { market: MarketState }) => {
  return state.market.chartData[symbol] || [];
};
export {};