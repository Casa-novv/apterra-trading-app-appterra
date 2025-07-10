import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axios from 'axios';

interface Position {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  market: string;
  pnl: number;
  pnlPercentage: number;
  openedAt: string;
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
}

const initialState: PortfolioState = {
  demoAccount: null,
  loading: false,
  error: null,
  lastUpdate: null,
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
      });
  },
});

// Selectors
export const selectPortfolio = (state: any) => state.portfolio?.demoAccount;
export const selectPortfolioLoading = (state: any) => state.portfolio?.loading || false;
export const selectPortfolioError = (state: any) => state.portfolio?.error;

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

export const { updatePortfolio, clearPortfolio } = portfolioSlice.actions;
export default portfolioSlice.reducer;
