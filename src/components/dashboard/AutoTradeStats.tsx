import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Speed,
  Psychology,
  Warning,
  CheckCircle,
  Info,
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/redux';
import { selectAutoTradeStats } from '../../store/slices/portfolioSlice';
import autoTradeService from '../../services/autoTradeService';

const AutoTradeStats: React.FC = () => {
  const stats = useAppSelector(selectAutoTradeStats);
  const isEnabled = autoTradeService.isEnabled();

  const getWinRateColor = (rate: number) => {
    if (rate >= 70) return 'success';
    if (rate >= 50) return 'warning';
    return 'error';
  };

  const getProfitLossColor = (value: number) => {
    return value >= 0 ? 'success' : 'error';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (!isEnabled) {
    return (
      <Card sx={{ height: '100%', background: 'rgba(255, 193, 7, 0.1)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Warning color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6" color="warning.main">
              Auto-Trade Disabled
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Enable auto-trade in settings to start automatic trading based on your criteria.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Speed sx={{ mr: 1, color: 'primary.main' }} />
            Auto-Trade Performance
          </Typography>
          <Chip
            label="Active"
            color="success"
            size="small"
            icon={<CheckCircle />}
          />
        </Box>

        <Grid container spacing={2}>
          {/* Win Rate */}
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color={`${getWinRateColor(stats.winRate)}.main`}>
                {formatPercentage(stats.winRate)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Win Rate
              </Typography>
            </Box>
          </Grid>

          {/* Total Trades */}
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary.main">
                {stats.totalTrades}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Trades
              </Typography>
            </Box>
          </Grid>

          {/* Profit/Loss */}
          <Grid item xs={12}>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Total P&L
              </Typography>
              <Typography
                variant="h6"
                color={getProfitLossColor(stats.totalProfitLoss)}
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {stats.totalProfitLoss >= 0 ? (
                  <TrendingUp sx={{ mr: 0.5, fontSize: '1rem' }} />
                ) : (
                  <TrendingDown sx={{ mr: 0.5, fontSize: '1rem' }} />
                )}
                {formatCurrency(stats.totalProfitLoss)}
              </Typography>
            </Box>
          </Grid>

          {/* Daily Progress */}
          <Grid item xs={12}>
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Daily Progress
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.tradesToday}/{stats.maxDailyTrades}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(stats.tradesToday / stats.maxDailyTrades) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </Grid>

          {/* Active Positions */}
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="info.main">
                {stats.activePositions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Positions
              </Typography>
            </Box>
          </Grid>

          {/* Max Positions */}
          <Grid item xs={6}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {stats.maxPositions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Max Positions
              </Typography>
            </Box>
          </Grid>

          {/* Criteria Summary */}
          <Grid item xs={12}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Active Criteria
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Chip
                  label={`Min Confidence: ${stats.minConfidence}%`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Max Risk: ${stats.maxRisk}%`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`Max Drawdown: ${stats.maxDrawdown}%`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default AutoTradeStats; 