import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Portfolio, Position, Trade } from '../../types';
import { portfolioAPI } from '../../services/api';

interface PortfolioState {
  portfolio: Portfolio | null;
  loading: boolean;
  error: string | null;
  simulationMode: boolean;
  recentTrades: Trade[];
  performance: number; // Portfolio performance metric
}

const initialState: PortfolioState = {
  portfolio: null,
  loading: false,
  error: null,
  simulationMode: true,
  recentTrades: [],
  performance: 0, // Initial performance metric
};

// 🔹 Fetch portfolio data from API
export const fetchPortfolio = createAsyncThunk(
  'portfolio/fetchPortfolio',
  async (_, { rejectWithValue }) => {
    try {
      const response = await portfolioAPI.getPortfolio();
      return response;
    } catch (error) {
      return rejectWithValue('Failed to fetch portfolio');
    }
  }
);

// 🔹 Fetch recent trades
export const fetchRecentTrades = createAsyncThunk(
  'portfolio/fetchRecentTrades',
  async (_, { rejectWithValue }) => {
    try {
      const response = await portfolioAPI.getRecentTrades();
      return response;
    } catch (error) {
      return rejectWithValue('Failed to fetch recent trades');
    }
  }
);

// 🔹 Fetch portfolio performance
export const fetchPortfolioPerformance = createAsyncThunk(
  'portfolio/fetchPortfolioPerformance',
  async (_, { rejectWithValue }) => {
    try {
      const response = await portfolioAPI.getPortfolioPerformance();
      return response;
    } catch (error) {
      return rejectWithValue('Failed to fetch portfolio performance');
    }
  }
);

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    toggleSimulationMode: (state) => {
      state.simulationMode = !state.simulationMode;
    },
    addPosition: (state, action: PayloadAction<Position>) => {
      if (state.portfolio) {
        state.portfolio.positions.push(action.payload);
      }
    },
    removePosition: (state, action: PayloadAction<string>) => {
      if (state.portfolio) {
        state.portfolio.positions = state.portfolio.positions.filter(
          pos => pos.symbol !== action.payload
        );
      }
    },
    updatePortfolioValue: (state, action: PayloadAction<number>) => {
      if (state.portfolio) {
        state.portfolio.totalValue = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPortfolio.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortfolio.fulfilled, (state, action) => {
        state.loading = false;
        state.portfolio = action.payload;
      })
      .addCase(fetchPortfolio.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchRecentTrades.fulfilled, (state, action) => {
        state.recentTrades = action.payload;
      })
      .addCase(fetchPortfolioPerformance.fulfilled, (state, action) => {
        state.performance = action.payload;
      });
  },
});

// 🔹 Selectors for easy state access
export const selectPortfolioSummary = (state: { portfolio: PortfolioState }) => state.portfolio.portfolio;
export const selectRecentTrades = (state: { portfolio: PortfolioState }) => state.portfolio.recentTrades;
export const selectPortfolioPerformance = (state: { portfolio: PortfolioState }) => state.portfolio.performance;

export const {
  toggleSimulationMode,
  addPosition,
  removePosition,
  updatePortfolioValue,
} = portfolioSlice.actions;

export default portfolioSlice.reducer;
