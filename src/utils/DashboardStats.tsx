import React from 'react';
import { Paper, Typography, Box, Tooltip, LinearProgress } from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  TrendingUp,
  TrendingDown,
  ShowChart,
  Assessment,
  SignalCellularAlt,
  EmojiEvents,
} from '@mui/icons-material';
import { formatCurrency, formatPercentage } from './formatters';

interface DashboardStatsProps {
  metrics: {
    totalValue: number;
    dailyPnL: number;
    dailyPnLPercentage: number;
    totalPnL: number;
    totalPnLPercentage: number;
    activePositions: number;
    todayTrades: number;
    winRate: number;
    activeSignals: number;
    signalAccuracy: number;
  };
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ metrics }) => {
  return (
    <Paper sx={{ p: 3, background: 'rgba(26,26,46,0.85)', borderRadius: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ color: '#00d4aa', fontWeight: 'bold' }}>
        Quick Stats
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Total value of all open positions">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Value
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" color="#fff">
                  {formatCurrency(metrics.totalValue)}
                </Typography>
                <Assessment sx={{ color: '#00d4aa' }} />
              </Box>
            </Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Profit or loss for today">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Daily P&L
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography
                  variant="h6"
                  color={metrics.dailyPnL >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(metrics.dailyPnL)}
                </Typography>
                {metrics.dailyPnL >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
              </Box>
            </Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Total profit or loss for all time">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total P&L
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography
                  variant="h6"
                  color={metrics.totalPnL >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(metrics.totalPnL)}
                </Typography>
                {metrics.totalPnL >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
              </Box>
            </Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Percentage of winning trades">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Win Rate
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" color="#fff">
                  {formatPercentage(metrics.winRate)}
                </Typography>
                <EmojiEvents sx={{ color: '#FFD700' }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.winRate * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  mt: 1,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#FFD700',
                  },
                }}
              />
            </Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Number of currently open positions">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Active Positions
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" color="#fff">
                  {metrics.activePositions}
                </Typography>
                <ShowChart sx={{ color: '#00d4aa' }} />
              </Box>
            </Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Number of trades executed today">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Today's Trades
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" color="#fff">
                  {metrics.todayTrades}
                </Typography>
                <Assessment sx={{ color: '#00d4aa' }} />
              </Box>
            </Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Number of currently active signals">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Active Signals
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" color="#fff">
                  {metrics.activeSignals}
                </Typography>
                <SignalCellularAlt sx={{ color: '#00d4aa' }} />
              </Box>
            </Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip title="Accuracy of all signals generated">
            <Box>
              <Typography variant="body2" color="text.secondary">
                Signal Accuracy
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" color="#fff">
                  {formatPercentage(metrics.signalAccuracy)}
                </Typography>
                <TrendingUp sx={{ color: '#00d4aa' }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.signalAccuracy * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  mt: 1,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#00d4aa',
                  },
                }}
              />
            </Box>
          </Tooltip>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default DashboardStats;