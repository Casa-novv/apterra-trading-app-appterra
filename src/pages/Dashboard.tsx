import React, { useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  Paper,
  useTheme,
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { fetchSignals } from '../store/slices/signalSlice';
import { fetchPortfolio } from '../store/slices/portfolioSlice';
import PerformanceChart from '../components/charts/PerformanceChart';
import RecentActivity from '../components/dashboard/RecentActivity';
import AutoTradeStats from '../components/dashboard/AutoTradeStats';
import EnterpriseMLInsights from '../components/dashboard/EnterpriseMLInsights';
import { useAppSelector } from '../hooks/redux';

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const signals = useAppSelector((state) => state.signals.signals);
  const portfolio = useAppSelector((state) => state.portfolio.portfolio);
  const loading = useAppSelector((state) => state.signals.loading);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchSignals({}) as any); // Typecast to any to satisfy dispatch
      dispatch(fetchPortfolio('') as any); // Typecast to any to satisfy dispatch
    }
  }, [dispatch, isAuthenticated]);

  const activeSignals = signals.filter((signal) => signal.status === 'active');
  const enterpriseSignals = signals.filter((signal) => signal.source === 'enterprise_ml');
  const highConfidenceSignals = signals.filter((signal) => signal.confidence >= 85);

  const totalValue = portfolio.reduce(
    (sum: number, position: { currentValue: number }) => sum + position.currentValue,
    0
  );
  const totalProfitLoss = portfolio.reduce(
    (sum: number, position: { profitLoss: number }) => sum + position.profitLoss,
    0
  );
  const profitLossPercentage = totalValue > 0 ? (totalProfitLoss / totalValue) * 100 : 0;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Welcome back, {user?.name || 'Trader'}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your intelligent trading dashboard is ready with real-time insights and automated trading capabilities.
        </Typography>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Typography variant="h4" color="white" sx={{ fontWeight: 'bold' }}>
                ${totalValue.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                Portfolio Value
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            height: '100%', 
            background: profitLossPercentage >= 0 
              ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
              : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
          }}>
            <CardContent>
              <Typography variant="h4" color="white" sx={{ fontWeight: 'bold' }}>
                {profitLossPercentage >= 0 ? '+' : ''}{profitLossPercentage.toFixed(2)}%
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.8)">
                P&L Today
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
            <CardContent>
              <Typography variant="h4" color="text.primary" sx={{ fontWeight: 'bold' }}>
                {activeSignals.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Signals
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }}>
            <CardContent>
              <Typography variant="h4" color="text.primary" sx={{ fontWeight: 'bold' }}>
                {enterpriseSignals.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ML Signals
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Dashboard Content */}
      <Grid container spacing={3}>
        {/* Performance Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Portfolio Performance
              </Typography>
              <PerformanceChart timeframe="1M" height={300} />
            </CardContent>
          </Card>
        </Grid>

        {/* Auto-Trade Stats */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <AutoTradeStats />
        </Grid>

        {/* Enterprise ML Insights */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <EnterpriseMLInsights />
        </Grid>

        {/* Recent Activity */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <RecentActivity />
            </CardContent>
          </Card>
        </Grid>

        {/* Signal Overview */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Signal Overview
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="primary.main" sx={{ fontWeight: 'bold' }}>
                      {activeSignals.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Signals
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="success.main" sx={{ fontWeight: 'bold' }}>
                      {highConfidenceSignals.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      High Confidence
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="info.main" sx={{ fontWeight: 'bold' }}>
                      {enterpriseSignals.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ML Generated
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
