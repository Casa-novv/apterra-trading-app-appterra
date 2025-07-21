import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axios from 'axios';

interface Position {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  market: string;
  pnl: number;
  pnlPercentage: number;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed';
  signalId?: string;
  closureType?: 'manual' | 'take_profit_hit' | 'stop_loss_hit';
}

interface DemoAccount {
  _id: string;
  user: string;
  balance: number;
  openPositions: Position[];
  tradeHistory: Position[];
  createdAt: string;
  updatedAt: string;
}

interface PortfolioState {
  demoAccount: DemoAccount | null;
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
  positionMonitoring: {
    active: boolean;
    lastCheck: string | null;
    positionsChecked: number;
  };
  notifications: {
    positionClosed: boolean;
    takeProfitHit: boolean;
    stopLossHit: boolean;
  };
}

const initialState: PortfolioState = {
  demoAccount: null,
  loading: false,
  error: null,
  lastUpdate: null,
  positionMonitoring: {
    active: false,
    lastCheck: null,
    positionsChecked: 0,
  },
  notifications: {
    positionClosed: false,
    takeProfitHit: false,
    stopLossHit: false,
  },
};

export const fetchPortfolio = createAsyncThunk(
  'portfolio/fetchPortfolio',
  async (userId: string, { rejectWithValue }) => {
    try {
      console.log('🔄 Fetching portfolio for user:', userId);
      const response = await axios.get(`/api/demo-account/${userId}`);
      console.log('✅ Portfolio data received:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch portfolio:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch portfolio');
    }
  }
);

export const createDemoAccount = createAsyncThunk(
  'portfolio/createDemoAccount',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/demo-account/${userId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create demo account');
    }
  }
);

export const resetDemoAccount = createAsyncThunk(
  'portfolio/resetDemoAccount',
  async ({ userId, balance }: { userId: string; balance: number }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`/api/demo-account/${userId}/reset`, { balance });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset demo account');
    }
  }
);

export const openDemoPosition = createAsyncThunk(
  'portfolio/openDemoPosition',
  async ({ 
    userId, 
    signal 
  }: { 
    userId: string; 
    signal: any; 
  }, { rejectWithValue }) => {
    try {
      console.log('🎯 Opening demo position for signal:', signal);
      
      const positionData = {
        symbol: signal.symbol,
        direction: signal.type.toUpperCase(),
        quantity: signal.positionSize || 1,
        entryPrice: signal.entryPrice,
        targetPrice: signal.targetPrice,
        stopLoss: signal.stopLoss,
        signalId: signal.id,
        market: signal.market,
        timeframe: signal.timeframe,
      };
      
      const response = await axios.post(`/api/demo-account/${userId}/positions`, positionData);
      console.log('✅ Demo position opened:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to open demo position:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to open demo position');
    }
  }
);

export const closeDemoPosition = createAsyncThunk(
  'portfolio/closeDemoPosition',
  async ({ 
    userId, 
    positionId 
  }: { 
    userId: string; 
    positionId: string; 
  }, { rejectWithValue }) => {
    try {
      console.log('🔒 Closing demo position:', positionId);
      const response = await axios.patch(`/api/demo-account/${userId}/positions/${positionId}/close`);
      console.log('✅ Demo position closed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to close demo position:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to close demo position');
    }
  }
);

export const closeAllDemoPositions = createAsyncThunk(
  'portfolio/closeAllDemoPositions',
  async (userId: string, { rejectWithValue }) => {
    try {
      console.log('🔒 Closing all demo positions for user:', userId);
      const response = await axios.patch(`/api/demo-account/${userId}/positions/close-all`);
      console.log('✅ All demo positions closed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to close all demo positions:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to close all demo positions');
    }
  }
);

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    updatePortfolio: (state, action) => {
      state.demoAccount = action.payload;
      state.lastUpdate = new Date().toISOString();
    },
    clearPortfolio: (state) => {
      state.demoAccount = null;
    },
    updatePosition: (state, action) => {
      if (state.demoAccount) {
        const { positionId, updates } = action.payload;
        const position = state.demoAccount.openPositions.find(p => p.id === positionId);
        if (position) {
          Object.assign(position, updates);
        }
      }
    },
    positionClosed: (state, action) => {
      // Handle manual position closure
      state.notifications.positionClosed = true;
      // The actual portfolio update will come from the API response
    },
    autoPositionClosed: (state, action) => {
      const { closureType, positionData } = action.payload;
      
      if (closureType === 'take_profit_hit') {
        state.notifications.takeProfitHit = true;
      } else if (closureType === 'stop_loss_hit') {
        state.notifications.stopLossHit = true;
      }
      
      // Update portfolio with closed position
      if (state.demoAccount) {
        // Remove from open positions
        state.demoAccount.openPositions = state.demoAccount.openPositions.filter(
          p => p.id !== positionData.positionId
        );
        
        // Add to trade history
        state.demoAccount.tradeHistory.push({
          ...positionData,
          status: 'closed',
          closedAt: new Date().toISOString(),
          closureType: closureType === 'take_profit_hit' ? 'take_profit_hit' : 'stop_loss_hit',
        });
        
        // Update balance
        state.demoAccount.balance += positionData.pnl;
      }
    },
    startPositionMonitoring: (state) => {
      state.positionMonitoring.active = true;
      state.positionMonitoring.lastCheck = new Date().toISOString();
    },
    stopPositionMonitoring: (state) => {
      state.positionMonitoring.active = false;
    },
    updatePositionMonitoring: (state, action) => {
      state.positionMonitoring.lastCheck = new Date().toISOString();
      state.positionMonitoring.positionsChecked = action.payload.positionsChecked || 0;
    },
    clearNotifications: (state) => {
      state.notifications = {
        positionClosed: false,
        takeProfitHit: false,
        stopLossHit: false,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Portfolio
      .addCase(fetchPortfolio.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortfolio.fulfilled, (state, action) => {
        state.loading = false;
        state.demoAccount = action.payload;
        state.lastUpdate = new Date().toISOString();
      })
      .addCase(fetchPortfolio.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Demo Account
      .addCase(createDemoAccount.fulfilled, (state, action) => {
        state.demoAccount = action.payload;
        state.lastUpdate = new Date().toISOString();
      })
      // Reset Demo Account
      .addCase(resetDemoAccount.fulfilled, (state, action) => {
        state.demoAccount = action.payload;
        state.lastUpdate = new Date().toISOString();
      })
      // Open Demo Position
      .addCase(openDemoPosition.fulfilled, (state, action) => {
        state.demoAccount = action.payload;
        state.lastUpdate = new Date().toISOString();
      })
      // Close Demo Position
      .addCase(closeDemoPosition.fulfilled, (state, action) => {
        state.demoAccount = action.payload;
        state.lastUpdate = new Date().toISOString();
        state.notifications.positionClosed = true;
      })
      // Close All Demo Positions
      .addCase(closeAllDemoPositions.fulfilled, (state, action) => {
        state.demoAccount = action.payload;
        state.lastUpdate = new Date().toISOString();
        state.notifications.positionClosed = true;
      });
  },
});

// Selectors
export const selectPortfolio = (state: any) => state.portfolio?.demoAccount;
export const selectPortfolioLoading = (state: any) => state.portfolio?.loading || false;
export const selectPortfolioError = (state: any) => state.portfolio?.error;
export const selectPositionMonitoring = (state: any) => state.portfolio?.positionMonitoring;
export const selectPortfolioNotifications = (state: any) => state.portfolio?.notifications;

export const selectPortfolioStats = createSelector(
  [selectPortfolio],
  (demoAccount) => {
    if (!demoAccount) {
      return {
        totalValue: 0,
        totalReturn: 0,
        totalReturnPercentage: 0,
        todaysPnL: 0,
        totalPnL: 0,
        openPositions: 0,
        closedPositions: 0,
        balance: 100000,
        successRate: 0,
        totalWins: 0,
        totalLosses: 0,
        avgWinAmount: 0,
        avgLossAmount: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        winStreak: 0,
        lossStreak: 0,
        takeProfitHits: 0,
        stopLossHits: 0,
        avgHoldingTime: 0,
      };
    }

    const openPositions = demoAccount.openPositions || [];
    const closedPositions = demoAccount.tradeHistory || [];

    // Calculate open positions stats
    const totalValue = openPositions.reduce(
      (sum: number, pos: Position) => sum + (pos.quantity * pos.currentPrice),
      0
    );
    const totalInvested = openPositions.reduce(
      (sum: number, pos: Position) => sum + (pos.quantity * pos.entryPrice),
      0
    );
    const totalPnL = openPositions.reduce((sum: number, pos: Position) => sum + pos.pnl, 0);
    const totalReturn = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

    // Calculate closed positions stats
    const totalWins = closedPositions.filter((pos: Position) => pos.pnl > 0).length;
    const totalLosses = closedPositions.filter((pos: Position) => pos.pnl < 0).length;
    const successRate = closedPositions.length > 0 ? (totalWins / closedPositions.length) * 100 : 0;

    const winningTrades = closedPositions.filter((pos: Position) => pos.pnl > 0);
    const losingTrades = closedPositions.filter((pos: Position) => pos.pnl < 0);

    const avgWinAmount = winningTrades.length > 0 
      ? winningTrades.reduce((sum: number, pos: Position) => sum + pos.pnl, 0) / winningTrades.length 
      : 0;
    const avgLossAmount = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum: number, pos: Position) => sum + pos.pnl, 0) / losingTrades.length)
      : 0;

    const profitFactor = avgLossAmount > 0 ? avgWinAmount / avgLossAmount : 0;
    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map((pos: Position) => pos.pnl)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map((pos: Position) => pos.pnl)) : 0;

    // Calculate closure type stats
    const takeProfitHits = closedPositions.filter((pos: Position) => pos.closureType === 'take_profit_hit').length;
    const stopLossHits = closedPositions.filter((pos: Position) => pos.closureType === 'stop_loss_hit').length;

    // Calculate average holding time
    const holdingTimes = closedPositions
      .filter((pos: Position) => pos.openedAt && pos.closedAt)
      .map((pos: Position) => {
        const opened = new Date(pos.openedAt);
        const closed = new Date(pos.closedAt!);
        return (closed.getTime() - opened.getTime()) / (1000 * 60 * 60); // hours
      });
    
    const avgHoldingTime = holdingTimes.length > 0 
      ? holdingTimes.reduce((sum, time) => sum + time, 0) / holdingTimes.length 
      : 0;

    // Calculate today's P&L
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysTrades = closedPositions.filter((pos: Position) => {
      const tradeDate = new Date(pos.openedAt);
      return tradeDate >= today;
    });
    const todaysPnL = todaysTrades.reduce((sum: number, pos: Position) => sum + pos.pnl, 0);

    return {
      totalValue,
      totalReturn,
      totalReturnPercentage: totalReturn,
      todaysPnL,
      totalPnL,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      balance: demoAccount.balance,
      successRate,
      totalWins,
      totalLosses,
      avgWinAmount,
      avgLossAmount,
      profitFactor,
      largestWin,
      largestLoss,
      winStreak: 0, // You can implement streak calculation
      lossStreak: 0,
      takeProfitHits,
      stopLossHits,
      avgHoldingTime,
    };
  }
);

export const selectTopPerformingPositions = createSelector(
  [selectPortfolio],
  (demoAccount) => {
    if (!demoAccount?.openPositions) return [];
    return [...demoAccount.openPositions]
      .sort((a, b) => b.pnlPercentage - a.pnlPercentage)
      .slice(0, 5);
  }
);

export const selectWorstPerformingPositions = createSelector(
  [selectPortfolio],
  (demoAccount) => {
    if (!demoAccount?.openPositions) return [];
    return [...demoAccount.openPositions]
      .sort((a, b) => a.pnlPercentage - b.pnlPercentage)
      .slice(0, 5);
  }
);

export const selectRecentTrades = createSelector(
  [selectPortfolio],
  (demoAccount) => {
    if (!demoAccount?.tradeHistory) return [];
    return [...demoAccount.tradeHistory]
      .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
      .slice(0, 10);
  }
);

export const selectPositionsNearTakeProfit = createSelector(
  [selectPortfolio],
  (demoAccount) => {
    if (!demoAccount?.openPositions) return [];
    return demoAccount.openPositions.filter((pos: Position) => {
      if (!pos.targetPrice || !pos.currentPrice) return false;
      const distance = Math.abs(pos.currentPrice - pos.targetPrice) / pos.entryPrice;
      return distance <= 0.02; // Within 2% of take profit
    });
  }
);

export const selectPositionsNearStopLoss = createSelector(
  [selectPortfolio],
  (demoAccount) => {
    if (!demoAccount?.openPositions) return [];
    return demoAccount.openPositions.filter((pos: Position) => {
      if (!pos.stopLoss || !pos.currentPrice) return false;
      const distance = Math.abs(pos.currentPrice - pos.stopLoss) / pos.entryPrice;
      return distance <= 0.02; // Within 2% of stop loss
    });
  }
);

export const { 
  updatePortfolio, 
  clearPortfolio, 
  updatePosition, 
  positionClosed, 
  autoPositionClosed,
  startPositionMonitoring,
  stopPositionMonitoring,
  updatePositionMonitoring,
  clearNotifications,
} = portfolioSlice.actions;
export default portfolioSlice.reducer;
