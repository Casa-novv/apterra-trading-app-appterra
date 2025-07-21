import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface TradingSignal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  market: 'forex' | 'crypto' | 'stocks' | 'commodities';
  description: string;
  reasoning: string;
  technicalIndicators: {
    rsi?: number;
    macd?: number;
    sma?: number;
    ema?: number;
    bollinger?: {
      upper: number;
      middle: number;
      lower: number;
    };
    // Enterprise ML specific indicators
    mlPredictions?: any;
    source?: string;
    modelUsed?: string;
  };
  status: 'active' | 'executed' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
  executedAt?: string;
  executedPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  tags: string[];
  source: 'ai' | 'manual' | 'copy_trading' | 'enterprise_ml';
  accuracy?: number;
  risk: 'low' | 'medium' | 'high';
  positionSize?: number;
  counterfactuals?: Record<string, any>;
  featureImportance?: Record<string, number>;
  metadata?: {
    processingTime?: number;
    modelsUsed?: string[];
    latency?: number;
  };
}

export interface SignalFilter {
  markets: string[];
  types: string[];
  confidence: [number, number];
  risk: string[];
  status: string[];
  timeframes: string[];
  symbols: string[];
}

export interface SignalStats {
  total: number;
  active: number;
  executed: number;
  expired: number;
  winRate: number;
  avgConfidence: number;
  totalPnl: number;
  bestSignal: TradingSignal | null;
  worstSignal: TradingSignal | null;
  byMarket: Record<string, number>;
  byTimeframe: Record<string, number>;
  recentPerformance: {
    date: string;
    signals: number;
    winRate: number;
    pnl: number;
  }[];
}

interface SignalsState {
  // Signals data
  signals: TradingSignal[];
  activeSignals: TradingSignal[];
  signalHistory: TradingSignal[];
  
  // Filtering and sorting
  filters: SignalFilter;
  sortBy: 'createdAt' | 'confidence' | 'pnl' | 'symbol';
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
  
  // Statistics
  stats: SignalStats;
  
  // UI state
  selectedSignal: TradingSignal | null;
  viewMode: 'list' | 'grid' | 'chart';
  
  // Loading states
  loading: {
    signals: boolean;
    stats: boolean;
    executing: boolean;
  };
  
  // Error states
  error: {
    signals: string | null;
    stats: string | null;
    executing: string | null;
  };
  
  // Real-time updates
  lastUpdate: number | null;
  isConnected: boolean;
}

const initialState: SignalsState = {
  signals: [],
  activeSignals: [],
  signalHistory: [],
  filters: {
    markets: [],
    types: [],
    confidence: [0, 100],
    risk: [],
    status: [],
    timeframes: [],
    symbols: [],
  },
  sortBy: 'createdAt',
  sortOrder: 'desc',
  searchQuery: '',
  stats: {
    total: 0,
    active: 0,
    executed: 0,
    expired: 0,
    winRate: 0,
    avgConfidence: 0,
    totalPnl: 0,
    bestSignal: null,
    worstSignal: null,
    byMarket: {},
    byTimeframe: {},
    recentPerformance: [],
  },
  selectedSignal: null,
  viewMode: 'list',
  loading: {
    signals: false,
    stats: false,
    executing: false,
  },
  error: {
    signals: null,
    stats: null,
    executing: null,
  },
  lastUpdate: null,
  isConnected: false,
};

// Async thunks
export const fetchSignals = createAsyncThunk(
  'signals/fetchSignals',
  async (params?: { limit?: number; status?: string; market?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.market) queryParams.append('market', params.market);
    
    const response = await fetch(`/api/signals?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch signals');
    }
    
    return response.json();
  }
);

export const fetchSignalStats = createAsyncThunk(
  'signals/fetchStats',
  async (timeframe: '7d' | '30d' | '90d' | '1y' = '30d') => {
    const response = await fetch(`/api/signals/stats?timeframe=${timeframe}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch signal statistics');
    }
    
    return response.json();
  }
);

export const executeSignal = createAsyncThunk(
  'signals/executeSignal',
  async ({ signalId, quantity, customPrice }: { 
    signalId: string; 
    quantity: number; 
    customPrice?: number; 
  }) => {
    const response = await fetch(`/api/signals/${signalId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ quantity, customPrice }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to execute signal');
    }
    
    return response.json();
  }
);

export const createCustomSignal = createAsyncThunk(
  'signals/createCustomSignal',
  async (signalData: Omit<TradingSignal, 'id' | 'createdAt' | 'status' | 'source'>) => {
    const response = await fetch('/api/signals/custom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(signalData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create custom signal');
    }
    
    return response.json();
  }
);

export const updateSignalStatus = createAsyncThunk(
  'signals/updateStatus',
  async ({ signalId, status }: { signalId: string; status: TradingSignal['status'] }) => {
    const response = await fetch(`/api/signals/${signalId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ status }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update signal status');
    }
    
    return response.json();
  }
);

const signalsSlice = createSlice({
  name: 'signals',
  initialState,
  reducers: {
    // Real-time signal updates
    addSignal: (state, action: PayloadAction<TradingSignal>) => {
      const signal = action.payload;
      state.signals.unshift(signal);
      
      if (signal.status === 'active') {
        state.activeSignals.unshift(signal);
      }
      
      state.lastUpdate = Date.now();
    },
    
    updateSignal: (state, action: PayloadAction<TradingSignal>) => {
      const updatedSignal = action.payload;
      const index = state.signals.findIndex(s => s.id === updatedSignal.id);
      
      if (index !== -1) {
        state.signals[index] = updatedSignal;
        
        // Update active signals
        const activeIndex = state.activeSignals.findIndex(s => s.id === updatedSignal.id);
        if (updatedSignal.status === 'active') {
          if (activeIndex === -1) {
            state.activeSignals.push(updatedSignal);
          } else {
            state.activeSignals[activeIndex] = updatedSignal;
          }
        } else if (activeIndex !== -1) {
          state.activeSignals.splice(activeIndex, 1);
        }
        
        // Update selected signal if it's the same one
        if (state.selectedSignal?.id === updatedSignal.id) {
          state.selectedSignal = updatedSignal;
        }
      }
      
      state.lastUpdate = Date.now();
    },
    
    removeSignal: (state, action: PayloadAction<string>) => {
      const signalId = action.payload;
      state.signals = state.signals.filter(s => s.id !== signalId);
      state.activeSignals = state.activeSignals.filter(s => s.id !== signalId);
      
      if (state.selectedSignal?.id === signalId) {
        state.selectedSignal = null;
      }
    },
    
    // Filtering and sorting
    setFilters: (state, action: PayloadAction<Partial<SignalFilter>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    
    setSortBy: (state, action: PayloadAction<SignalsState['sortBy']>) => {
      state.sortBy = action.payload;
    },
    
    setSortOrder: (state, action: PayloadAction<SignalsState['sortOrder']>) => {
      state.sortOrder = action.payload;
    },
    
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    
    // UI state
    setSelectedSignal: (state, action: PayloadAction<TradingSignal | null>) => {
      state.selectedSignal = action.payload;
    },
    
    setViewMode: (state, action: PayloadAction<SignalsState['viewMode']>) => {
      state.viewMode = action.payload;
    },
    
    // Connection status
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    
    // Clear errors
    clearError: (state, action: PayloadAction<keyof SignalsState['error']>) => {
      state.error[action.payload] = null;
    },
    
    clearAllErrors: (state) => {
      state.error = {
        signals: null,
        stats: null,
        executing: null,
      };
    },
    
    // Bulk operations
    markSignalsAsRead: (state, action: PayloadAction<string[]>) => {
      const signalIds = action.payload;
      state.signals.forEach(signal => {
        if (signalIds.includes(signal.id)) {
          // Add read status if needed
        }
      });
    },
    
    // Reset state
    resetSignalsState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch signals
    builder
      .addCase(fetchSignals.pending, (state) => {
        state.loading.signals = true;
        state.error.signals = null;
      })
      .addCase(fetchSignals.fulfilled, (state, action) => {
        state.loading.signals = false;
        state.signals = action.payload.signals || action.payload;
        state.activeSignals = state.signals.filter(s => s.status === 'active');
        state.signalHistory = state.signals.filter(s => s.status !== 'active');
        state.lastUpdate = Date.now();
      })
      .addCase(fetchSignals.rejected, (state, action) => {
        state.loading.signals = false;
        state.error.signals = action.error.message || 'Failed to fetch signals';
      });
    
    // Fetch signal stats
    builder
      .addCase(fetchSignalStats.pending, (state) => {
        state.loading.stats = true;
        state.error.stats = null;
      })
      .addCase(fetchSignalStats.fulfilled, (state, action) => {
        state.loading.stats = false;
        state.stats = action.payload;
      })
      .addCase(fetchSignalStats.rejected, (state, action) => {
        state.loading.stats = false;
        state.error.stats = action.error.message || 'Failed to fetch signal statistics';
      });
    
    // Execute signal
    builder
      .addCase(executeSignal.pending, (state) => {
        state.loading.executing = true;
        state.error.executing = null;
      })
      .addCase(executeSignal.fulfilled, (state, action) => {
        state.loading.executing = false;
        const { signalId, executionData } = action.payload;
        
        // Update the executed signal
        const signalIndex = state.signals.findIndex(s => s.id === signalId);
        if (signalIndex !== -1) {
          state.signals[signalIndex] = {
            ...state.signals[signalIndex],
            status: 'executed',
            executedAt: executionData.executedAt,
            executedPrice: executionData.executedPrice,
          };
        }
        
        // Remove from active signals
        state.activeSignals = state.activeSignals.filter(s => s.id !== signalId);
      })
      .addCase(executeSignal.rejected, (state, action) => {
        state.loading.executing = false;
        state.error.executing = action.error.message || 'Failed to execute signal';
      });
    
    // Create custom signal
    builder
      .addCase(createCustomSignal.pending, (state) => {
        state.loading.signals = true;
        state.error.signals = null;
      })
      .addCase(createCustomSignal.fulfilled, (state, action) => {
        state.loading.signals = false;
        const newSignal = action.payload;
        state.signals.unshift(newSignal);
        if (newSignal.status === 'active') {
          state.activeSignals.unshift(newSignal);
        }
      })
      .addCase(createCustomSignal.rejected, (state, action) => {
        state.loading.signals = false;
        state.error.signals = action.error.message || 'Failed to create custom signal';
      });
    
    // Update signal status
    builder
      .addCase(updateSignalStatus.pending, (state) => {
        state.loading.signals = true;
        state.error.signals = null;
      })
      .addCase(updateSignalStatus.fulfilled, (state, action) => {
        state.loading.signals = false;
        const updatedSignal = action.payload;
        const signalIndex = state.signals.findIndex(s => s.id === updatedSignal.id);
        
        if (signalIndex !== -1) {
          state.signals[signalIndex] = updatedSignal;
          
          // Update active signals array
          const activeIndex = state.activeSignals.findIndex(s => s.id === updatedSignal.id);
          if (updatedSignal.status === 'active') {
            if (activeIndex === -1) {
              state.activeSignals.push(updatedSignal);
            } else {
              state.activeSignals[activeIndex] = updatedSignal;
            }
          } else if (activeIndex !== -1) {
            state.activeSignals.splice(activeIndex, 1);
          }
        }
      })
      .addCase(updateSignalStatus.rejected, (state, action) => {
        state.loading.signals = false;
        state.error.signals = action.error.message || 'Failed to update signal status';
      });
  },
});

export const {
  addSignal,
  updateSignal,
  removeSignal,
  setFilters,
  clearFilters,
  setSortBy,
  setSortOrder,
  setSearchQuery,
  setSelectedSignal,
  setViewMode,
  setConnectionStatus,
  clearError,
  clearAllErrors,
  markSignalsAsRead,
  resetSignalsState,
} = signalsSlice.actions;


// Selectors
export const selectAllSignals = (state: { signals: SignalsState }) => state.signals.signals;
export const selectActiveSignals = (state: { signals: SignalsState }) => state.signals.activeSignals;
export const selectSignalHistory = (state: { signals: SignalsState }) => state.signals.signalHistory;
export const selectSignalStats = (state: { signals: SignalsState }) => state.signals.stats;
export const selectSelectedSignal = (state: { signals: SignalsState }) => state.signals.selectedSignal;
export const selectSignalFilters = (state: { signals: SignalsState }) => state.signals.filters;
export const selectSignalLoading = (state: { signals: SignalsState }) => state.signals.loading;
export const selectSignalErrors = (state: { signals: SignalsState }) => state.signals.error;
export const selectSignalViewMode = (state: { signals: SignalsState }) => state.signals.viewMode;
export const selectSignalSorting = (state: { signals: SignalsState }) => ({
  sortBy: state.signals.sortBy,
  sortOrder: state.signals.sortOrder,
});

// Complex selectors
export const selectFilteredSignals = (state: { signals: SignalsState }) => {
  const { signals, filters, searchQuery, sortBy, sortOrder } = state.signals;
  
  let filteredSignals = signals.filter(signal => {
    // Market filter
    if (filters.markets.length > 0 && !filters.markets.includes(signal.market)) {
      return false;
    }
    
    // Type filter
    if (filters.types.length > 0 && !filters.types.includes(signal.type)) {
      return false;
    }
    
    // Confidence filter
    if (signal.confidence < filters.confidence[0] || signal.confidence > filters.confidence[1]) {
      return false;
    }
    
    // Risk filter
    if (filters.risk.length > 0 && !filters.risk.includes(signal.risk)) {
      return false;
    }
    
    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(signal.status)) {
      return false;
    }
    
    // Timeframe filter
    if (filters.timeframes.length > 0 && !filters.timeframes.includes(signal.timeframe)) {
      return false;
    }
    
    // Symbol filter
    if (filters.symbols.length > 0 && !filters.symbols.includes(signal.symbol)) {
      return false;
    }
    
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        signal.symbol.toLowerCase().includes(query) ||
        signal.description.toLowerCase().includes(query) ||
        signal.reasoning.toLowerCase().includes(query) ||
        signal.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return true;
  });
  
  // Sort signals
  filteredSignals.sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'confidence':
        aValue = a.confidence;
        bValue = b.confidence;
        break;
      case 'pnl':
        aValue = a.pnl || 0;
        bValue = b.pnl || 0;
        break;
      case 'symbol':
        aValue = a.symbol;
        bValue = b.symbol;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  return filteredSignals;
};

export const selectSignalsByMarket = (market: string) => (state: { signals: SignalsState }) => {
  return state.signals.signals.filter(signal => signal.market === market);
};

export const selectSignalsBySymbol = (symbol: string) => (state: { signals: SignalsState }) => {
  return state.signals.signals.filter(signal => signal.symbol === symbol);
};

export const selectSignalsByStatus = (status: TradingSignal['status']) => (state: { signals: SignalsState }) => {
  return state.signals.signals.filter(signal => signal.status === status);
};

export const selectHighConfidenceSignals = (threshold: number = 80) => (state: { signals: SignalsState }) => {
  return state.signals.activeSignals.filter(signal => signal.confidence >= threshold);
};

export const selectRecentSignals = (hours: number = 24) => (state: { signals: SignalsState }) => {
  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
  return state.signals.signals.filter(signal => 
    new Date(signal.createdAt).getTime() > cutoffTime
  );
};

export const selectProfitableSignals = (state: { signals: SignalsState }) => {
  return state.signals.signals.filter(signal => 
    signal.pnl !== undefined && signal.pnl > 0
  );
};

export const selectSignalPerformanceByMarket = (state: { signals: SignalsState }) => {
  const { signals } = state.signals;
  const performance: Record<string, { total: number; profitable: number; totalPnl: number }> = {};
  
  signals.forEach(signal => {
    if (!performance[signal.market]) {
      performance[signal.market] = { total: 0, profitable: 0, totalPnl: 0 };
    }
    
    performance[signal.market].total++;
    if (signal.pnl !== undefined) {
      performance[signal.market].totalPnl += signal.pnl;
      if (signal.pnl > 0) {
        performance[signal.market].profitable++;
      }
    }
  });
  
  return Object.entries(performance).map(([market, data]) => ({
    market,
    total: data.total,
    profitable: data.profitable,
    winRate: data.total > 0 ? (data.profitable / data.total) * 100 : 0,
    totalPnl: data.totalPnl,
    avgPnl: data.total > 0 ? data.totalPnl / data.total : 0,
  }));
};

export const selectTodaysSignals = (state: { signals: SignalsState }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  
  return state.signals.signals.filter(signal => 
    new Date(signal.createdAt).getTime() >= todayTime
  );
};

export const selectSignalTags = (state: { signals: SignalsState }) => {
  const allTags = state.signals.signals.flatMap(signal => signal.tags);
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([tag, count]) => ({ tag, count }));
};

// Utility functions for signal analysis
export const calculateSignalAccuracy = (signals: TradingSignal[]): number => {
  const executedSignals = signals.filter(s => s.status === 'executed' && s.pnl !== undefined);
  if (executedSignals.length === 0) return 0;
  
  const profitableSignals = executedSignals.filter(s => s.pnl! > 0);
  return (profitableSignals.length / executedSignals.length) * 100;
};

export const calculateTotalPnL = (signals: TradingSignal[]): number => {
  return signals.reduce((total, signal) => {
    return total + (signal.pnl || 0);
  }, 0);
};

export const getSignalRiskDistribution = (signals: TradingSignal[]) => {
  const distribution = { low: 0, medium: 0, high: 0 };
  signals.forEach(signal => {
    distribution[signal.risk]++;
  });
  return distribution;
};

export const getSignalTimeframeDistribution = (signals: TradingSignal[]) => {
  const distribution: Record<string, number> = {};
  signals.forEach(signal => {
    distribution[signal.timeframe] = (distribution[signal.timeframe] || 0) + 1;
  });
  return distribution;
};
export default signalsSlice.reducer;
export {};