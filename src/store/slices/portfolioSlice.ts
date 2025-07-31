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
  balance: any;
  openPositions: any;
  portfolio: any;
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
  // Defaults needed for AutoTradeStats
  maxDailyTrades: number;
  maxPositions: number;
  minConfidence: number;
  maxRisk: number;
  maxDrawdown: number;
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
  balance: 100000,
  openPositions: [],
  portfolio: [],
  // Defaults for stats
  maxDailyTrades: 100,
  maxPositions: 0,
  minConfidence: 0,
  maxRisk: 0,
  maxDrawdown: 0,
};

export const fetchPortfolio = createAsyncThunk(
  'portfolio/fetchPortfolio',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/api/demo-account/${userId}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch portfolio');
    }
  }
);

export const openDemoPosition = createAsyncThunk(
  'portfolio/openDemoPosition',
  async ({ userId, signal }: { userId: string; signal: any }, { rejectWithValue }) => {
    try {
      const positionData = {
        symbol:    signal.symbol,
        direction: signal.type.toUpperCase(),
        quantity:  signal.positionSize || 1,
        entryPrice:  signal.entryPrice,
        targetPrice: signal.targetPrice,
        stopLoss:    signal.stopLoss,
        signalId:    signal.id,
        market:      signal.market,
        timeframe:   signal.timeframe,
      };
      const response = await axios.post(`/api/demo-account/${userId}/positions`, positionData);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to open demo position');
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
  async (
    payload: { userId: string; balance: number },
    { rejectWithValue }
  ) => {
    const { userId, balance } = payload;
    try {
      const response = await axios.patch(`/api/demo-account/${userId}/reset`, { balance });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset demo account');
    }
  }
);


export const closeDemoPosition = createAsyncThunk(
  'portfolio/closeDemoPosition',
  async ({ userId, positionId }: { userId: string; positionId: string }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`/api/demo-account/${userId}/positions/${positionId}/close`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to close demo position');
    }
  }
);

export const closeAllDemoPositions = createAsyncThunk(
  'portfolio/closeAllDemoPositions',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`/api/demo-account/${userId}/positions/close-all`);
      return response.data;
    } catch (error: any) {
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
        if (position) Object.assign(position, updates);
      }
    },
    positionClosed: (state) => {
      state.notifications.positionClosed = true;
    },
    autoPositionClosed: (state, action) => {
      const { closureType, positionData } = action.payload;
      if (closureType === 'take_profit_hit') state.notifications.takeProfitHit = true;
      if (closureType === 'stop_loss_hit') state.notifications.stopLossHit = true;
      if (state.demoAccount) {
        state.demoAccount.openPositions = state.demoAccount.openPositions.filter(
          p => p.id !== positionData.positionId
        );
        state.demoAccount.tradeHistory.push({
          ...positionData,
          status: 'closed',
          closedAt: new Date().toISOString(),
          closureType
        });
        state.demoAccount.balance += positionData.pnl;
      }
    },
    startPositionMonitoring: (state) => { state.positionMonitoring.active = true; state.positionMonitoring.lastCheck = new Date().toISOString(); },
    stopPositionMonitoring: (state) => { state.positionMonitoring.active = false; },
    updatePositionMonitoring: (state, action) => {
      state.positionMonitoring.lastCheck = new Date().toISOString();
      state.positionMonitoring.positionsChecked = action.payload.positionsChecked || 0;
    },
    clearNotifications: (state) => {
      state.notifications = { positionClosed: false, takeProfitHit: false, stopLossHit: false };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPortfolio.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchPortfolio.fulfilled, (state, action) => { state.loading = false; state.demoAccount = action.payload; state.lastUpdate = new Date().toISOString(); })
      .addCase(fetchPortfolio.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; });
    // ... other extraReducers unchanged ...
  },
});

// Selectors
export const selectPortfolio = (state: any) => state.portfolio.demoAccount;
export const selectPortfolioStats = createSelector(
  [
    (state: any) => state.portfolio.demoAccount,
    (state: any) => state.portfolio
  ],
  (demoAccount, slice) => {
    if (!demoAccount) {
      return {
        winRate: 0,
        totalTrades: 0,
        totalProfitLoss: 0,
        tradesToday: 0,
        maxDailyTrades: slice.maxDailyTrades,
        activePositions: 0,
        maxPositions: slice.maxPositions,
        minConfidence: slice.minConfidence,
        maxRisk: slice.maxRisk,
        maxDrawdown: slice.maxDrawdown,
        openPositions: 0,
        closedPositions: 0,
        balance: slice.balance ?? 100000,
        totalPnL: 0,
        totalReturnPercentage: 0,
        successRate: 0,
        profitFactor: 0,
        takeProfitHits: 0,
        stopLossHits: 0,
        avgHoldingTime: 0,
      };
    }

    const openPositions = demoAccount.openPositions || [];
    const closedPositions = demoAccount.tradeHistory || [];
    const totalWins = closedPositions.filter((p: { pnl: number }) => p.pnl > 0).length;
    const totalLosses = closedPositions.filter((p: { pnl: number }) => p.pnl < 0).length;
    const successRate = closedPositions.length ? (totalWins / closedPositions.length) * 100 : 0;
    const totalTrades = openPositions.length + closedPositions.length;
    const totalPnL = [...openPositions, ...closedPositions].reduce((sum: number, p: { pnl: number }) => sum + (p.pnl || 0), 0);
    const balance = demoAccount.balance ?? 100000;
    const totalReturnPercentage = ((balance - 100000) / 100000) * 100;
    const profitFactor = totalLosses > 0
      ? closedPositions.filter((p: { pnl: number }) => p.pnl > 0).reduce((sum: number, p: { pnl: number }) => sum + p.pnl, 0) /
        Math.abs(closedPositions.filter((p: { pnl: number }) => p.pnl < 0).reduce((sum: number, p: { pnl: number }) => sum + p.pnl, 0))
      : 0;
    const takeProfitHits = closedPositions.filter((p: { closureType?: string }) => p.closureType === 'take_profit_hit').length;
    const stopLossHits = closedPositions.filter((p: { closureType?: string }) => p.closureType === 'stop_loss_hit').length;
    const avgHoldingTime = closedPositions.length
      ? closedPositions.reduce((sum: number, p: { openedAt: string, closedAt?: string }) => {
          if (p.openedAt && p.closedAt) {
            return sum + (new Date(p.closedAt).getTime() - new Date(p.openedAt).getTime());
          }
          return sum;
        }, 0) / closedPositions.length / (1000 * 60 * 60) // in hours
      : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tradesToday = closedPositions.filter((p: { openedAt: string }) => new Date(p.openedAt) >= today).length;

    return {
      winRate: successRate,
      totalTrades,
      totalProfitLoss: totalPnL,
      tradesToday,
      maxDailyTrades: slice.maxDailyTrades,
      activePositions: openPositions.length,
      maxPositions: slice.maxPositions,
      minConfidence: slice.minConfidence,
      maxRisk: slice.maxRisk,
      maxDrawdown: slice.maxDrawdown,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      balance,
      totalPnL,
      totalReturnPercentage,
      successRate,
      profitFactor,
      takeProfitHits,
      stopLossHits,
      avgHoldingTime,
    };
  }
);

export const selectPositionsNearTakeProfit = (state: any) => {
  const demoAccount = state.portfolio.demoAccount;
  if (!demoAccount) return [];
  // Example: positions within 2% of targetPrice
  return (demoAccount.openPositions || []).filter((p: any) =>
    p.targetPrice && Math.abs((p.currentPrice - p.targetPrice) / p.targetPrice) < 0.02
  );
};

export const selectPositionsNearStopLoss = (state: any) => {
  const demoAccount = state.portfolio.demoAccount;
  if (!demoAccount) return [];
  // Example: positions within 2% of stopLoss
  return (demoAccount.openPositions || []).filter((p: any) =>
    p.stopLoss && Math.abs((p.currentPrice - p.stopLoss) / p.stopLoss) < 0.02
  );
};

export const selectPortfolioNotifications = (state: any) => state.portfolio.notifications;

export const { updatePortfolio, clearPortfolio, updatePosition, positionClosed, autoPositionClosed, startPositionMonitoring, stopPositionMonitoring, updatePositionMonitoring, clearNotifications } = portfolioSlice.actions;
export default portfolioSlice.reducer;
