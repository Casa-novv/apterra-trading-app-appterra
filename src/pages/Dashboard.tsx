import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Chip,
  Button,
  Alert,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShowChart,
  Notifications,
  Refresh,
  Settings,
  Timeline,
  Assessment,
  Speed,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import useWebSocket, { useMarketData, useTradingSignals } from '../hooks/useWebSocket';
import {
  fetchSignals,
  selectActiveSignals,
  selectSignalStats,
  selectHighConfidenceSignals,
  selectTodaysSignals
 } from '../store/slices/signalSlice';
import {
  fetchMarketData,
  selectWatchlistData,
  selectConnectionStatus,
} from '../store/slices/marketSlice';
import {
  selectPortfolioSummary,
  selectRecentTrades,
  selectPortfolioPerformance,
  fetchPortfolio,
} from '../store/slices/portfolioSlice';
import {
  selectNotifications,
  selectUnreadCount,
} from '../store/slices/notificationsSlice';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import { formatCurrency, formatPercentage, formatNumber } from '../utils/formatters';

// Dashboard Components
import DashboardStats from '../utils/DashboardStats';
import QuickActions from '../utils/QuickActions';
import RecentActivity from '../components/dashboard/RecentActivity';
import PerformanceChart from '../components/charts/PerformanceChart';
import SignalCard from '../components/signals/SignalCard';
import MarketOverview from '../components/market/MarketOverview';
import { Link as RouterLink } from 'react-router-dom';
import { useMarketWebSocket } from '../hooks/useMarketWebSocket';
import { RootState } from '../store'; // adjust the import path as needed

interface DashboardMetrics {
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
}

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  
  // Redux state
  const { user, isAuthenticated } = useAppSelector(state => state.auth);
  const activeSignals = useAppSelector(selectActiveSignals) as Array<any>;
  interface SignalStats {
    winRate?: number;
    avgConfidence?: number;
    [key: string]: any;
  }
  const signalStats: SignalStats = useAppSelector(selectSignalStats);
  const highConfidenceSignals = useAppSelector(selectHighConfidenceSignals(85)) as Array<any>;
  const todaysSignals = useAppSelector(selectTodaysSignals);
  const watchlistData = useAppSelector(selectWatchlistData);
  const portfolioSummary = useAppSelector(selectPortfolioSummary);
  const recentTrades = useAppSelector(selectRecentTrades);
  const portfolioPerformance = useAppSelector(selectPortfolioPerformance);
  const notifications = useAppSelector((state) => selectNotifications(state));
  const unreadCount = useAppSelector(selectUnreadCount);
  const isMarketConnected = useAppSelector(selectConnectionStatus);
  
  // Loading states
  const signalsLoading = useAppSelector((state: any) => state.signals.loading.signals);
  const marketLoading = useAppSelector(state => state.market.loading.marketData);
  const portfolioLoading = useAppSelector(state => state.portfolio.loading);
  
  // WebSocket connections
  const { isConnected: wsConnected } = useWebSocket();
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
  const marketData = useMarketWebSocket(wsUrl);
  <MarketOverview data={marketData} />
  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1D');
  
  // Calculate dashboard metrics
  const dashboardMetrics: DashboardMetrics = React.useMemo(() => {
    return {
      totalValue: portfolioSummary?.totalValue || 0,
      dailyPnL: portfolioSummary?.dailyPnL || 0,
      dailyPnLPercentage: portfolioSummary?.dailyPnLPercentage || 0,
      totalPnL: portfolioSummary?.totalPnL || 0,
      totalPnLPercentage: portfolioSummary?.totalPnLPercentage || 0,
      activePositions:
        portfolioSummary?.activePositions && Array.isArray(portfolioSummary.activePositions)
        ? portfolioSummary.activePositions.length: 0,
      todayTrades: recentTrades?.filter(trade => {
        const today = new Date().toDateString();
        return trade.executedAt ? new Date(trade.executedAt).toDateString() === today : false;
      }).length || 0,
      winRate: typeof signalStats?.winRate === 'number' ? signalStats.winRate : 0,
      activeSignals: activeSignals.length,
      signalAccuracy: signalStats?.avgConfidence || 0,
    };
  }, [portfolioSummary, recentTrades, signalStats, activeSignals]);
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchSignals({ limit: 20, status: 'active' }));
      dispatch(fetchMarketData(['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD']));
      dispatch(fetchPortfolio());
    }
  }, [dispatch, isAuthenticated]);
 
  // Refresh all data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchSignals({ limit: 20, status: 'active' })),
        dispatch(fetchMarketData(['EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD'])),
        dispatch(fetchPortfolio()),
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Connection status indicator
  const getConnectionStatus = () => {
    if (wsConnected && isMarketConnected) {
      return { status: 'connected', color: 'success', text: 'Live Data' };
    } else if (wsConnected || isMarketConnected) {
      return { status: 'partial', color: 'warning', text: 'Partial Connection' };
    } else {
      return { status: 'disconnected', color: 'error', text: 'Disconnected' };
    }
  };
  
  const connectionStatus = getConnectionStatus();
  
  // Add at the top of your Dashboard component (after hooks)
const getUserName = () => {
  // Try firstName, then name, then email, then fallback
  return user?.firstName || user?.name || user?.email?.split('@')[0] || 'Trader';
};

const greetingPhrases = [
  "Welcome back, {name}!",
  "Ready to make some money, {name}?",
  "Let's chase some pips, {name}!",
  "Good to see you, {name}!",
  "Let's trade smart, {name}!",
  "Markets are moving, {name}!",
  "Let's catch some trends, {name}!",
  "Time to win, {name}!",
  "Let's analyze the markets, {name}!",
  "Your trading cockpit awaits, {name}!",
];

const [greeting, setGreeting] = useState('');

useEffect(() => {
  const name = getUserName();
  const phrase = greetingPhrases[Math.floor(Math.random() * greetingPhrases.length)];
  setGreeting(phrase.replace('{name}', name));
  // Optionally, update greeting on every login or page load
  // eslint-disable-next-line
}, [user]);

  const getRecentActivities = () => {
    // Map all to a common structure with a date
    const tradeActs = (recentTrades || []).map(t => ({
      ...t,
      type: 'Trade',
      date: t.executedAt || t.timestamp,
    }));
    const signalActs = (Array.isArray(todaysSignals) ? todaysSignals : []).map(s => ({
      ...s,
      type: 'Signal',
      date: s.createdAt,
    }));
    const notifActs = (notifications || []).map(n => ({
      ...n,
      type: 'Notification',
      date: n.timestamp,
    }));

    // Combine, sort by date desc, and take top 10
    return [...tradeActs, ...signalActs, ...notifActs]
      .filter(a => a.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  };

  if (!isAuthenticated) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">
          Please log in to access your dashboard.
        </Alert>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {greeting}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Chip
              icon={connectionStatus.status === 'connected' ? <CheckCircle /> : 
                    connectionStatus.status === 'partial' ? <Warning /> : <ErrorIcon />}
              label={connectionStatus.text}
              color={connectionStatus.color as any}
              variant="outlined"
            />
            <IconButton 
              onClick={handleRefresh} 
              disabled={refreshing}
              sx={{ 
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                }
              }}
            >
              <Refresh />
            </IconButton>
            <IconButton>
              <Settings />
            </IconButton>
          </Box>
        </Box>
        
        {/* Notifications Bar */}
        {unreadCount > 0 && (
          <Alert 
            severity="info" 
            icon={<Notifications />}
            sx={{ mb: 2 }}
          >
            You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Alert>
        )}
      </Box>
      
      {/* Navigation Buttons */}
      <Box display="flex" gap={2} mb={3}>
        <Button variant="outlined" component={RouterLink} to="/signals">
          Go to Signals
        </Button>
        <Button variant="outlined" component={RouterLink} to="/portfolio">
          Go to Portfolio
        </Button>
        <Button variant="outlined" component={RouterLink} to="/settings">
          Go to Settings
        </Button>
      </Box>
      
          {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
      {[
        {
          label: 'Portfolio Value',
          value: formatCurrency(dashboardMetrics.totalValue),
          icon: <AccountBalance color="primary" sx={{ fontSize: 40 }} />,
          loading: portfolioLoading,
          skeletonWidth: 120,
        },
        {
          label: 'Daily P&L',
           value: (
            <Box display="flex" alignItems="center" gap={1}>
              <Typography
                variant="h5"
                component="div"
                color={dashboardMetrics.dailyPnL >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(dashboardMetrics.dailyPnL)}
              </Typography>
              {dashboardMetrics.dailyPnL >= 0 ? <TrendingUp /> : <TrendingDown />}
            </Box>
          ),
          subValue: formatPercentage(dashboardMetrics.dailyPnLPercentage),
          icon: null,
          loading: portfolioLoading,
          skeletonWidth: 120,
        },
        {
          label: 'Active Signals',
          value: dashboardMetrics.activeSignals,
          subValue: `${highConfidenceSignals.length} high confidence`,
          icon: <Timeline color="primary" sx={{ fontSize: 40 }} />,
          loading: signalsLoading,
          skeletonWidth: 60,
        },
        {
          label: 'Win Rate',
          value: formatPercentage(dashboardMetrics.winRate),
          subValue: `Avg. Confidence: ${formatPercentage(dashboardMetrics.signalAccuracy)}`,
          icon: <Assessment color="primary" sx={{ fontSize: 40 }} />,
          loading: signalsLoading,
          skeletonWidth: 80,
        },
      ].map((stat, idx) => (
        <Grid 
          size={{ xs: 12, sm: 6, md: 3 }} 
          key={stat.label}
        >
          <Card sx={{ height: '100%', p: 2 }}> {/* Add padding for cleaner spacing */}
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  flexDirection: { xs: 'column', sm: 'row' }, // Stack on mobile, horizontal on desktop
                  gap: 2, // Add spacing
                }}
              >
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    {stat.label}
                  </Typography>
                  {stat.loading ? (
                    <Skeleton width={stat.skeletonWidth} height={32} />
                  ) : (
                    <Box>
                      <Typography variant="h5" component="div">
                        {stat.value}
                      </Typography>
                      {stat.subValue && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {stat.subValue}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
                {stat.icon}
              </Box>
             </CardContent>
           </Card>
         </Grid>
        ))}
       </Grid>

      
      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Portfolio Performance Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Portfolio Performance</Typography>
              <Box>
                {(['1D', '1W', '1M', '3M', '1Y'] as const).map((tf) => (
                  <Button
                    key={tf}
                    size="small"
                    variant={timeframe === tf ? 'contained' : 'text'}
                    onClick={() => setTimeframe(tf)}
                    sx={{ ml: 1 }}
                  >
                    {tf}
                  </Button>
                ))}
              </Box>
            </Box>
            {portfolioLoading ? (
              <LoadingSpinner message="Loading performance data..." />
            ) : (
              <PerformanceChart 
                data={
                  typeof portfolioPerformance === 'object' && portfolioPerformance !== null
                    ? portfolioPerformance
                    : { labels: [], data: [] }
                }
                timeframe={timeframe}
                height={320}
              />
            )}
          </Paper>
        </Grid>
        
        {/* Quick Actions & Stats */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <QuickActions />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <DashboardStats metrics={dashboardMetrics} />
            </Grid>
          </Grid>
        </Grid>
        
        {/* Active Signals */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Active Signals</Typography>
              <Button 
                variant="outlined" 
                size="small"
                component={RouterLink}
                to="/signals"
              >
                View All
              </Button>
            </Box>
            {signalsLoading ? (
              <LoadingSpinner message="Loading signals..." />
            ) : activeSignals.length === 0 ? (
              <Box 
                display="flex" 
                flexDirection="column" 
                alignItems="center" 
                justifyContent="center"
                minHeight={200}
                color="text.secondary"
              >
                <Speed sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body1">No active signals</Typography>
                <Typography variant="body2">New signals will appear here</Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {activeSignals.slice(0, 5).map((signal) => (
                  <Box key={signal.id} sx={{ mb: 2 }}>
                    <SignalCard signal={signal} compact />
                  </Box>
                ))}
                {activeSignals.length > 5 && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    align="center"
                    sx={{ mt: 2 }}
                  >
                    +{activeSignals.length - 5} more signals
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Market Overview */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Market Overview</Typography>
              <Button 
                variant="outlined" 
                size="small"
                component={RouterLink}
                to="/market"
              >
                View Market
              </Button>
            </Box>
            {marketLoading ? (
              <LoadingSpinner message="Loading market data..." />
            ) : (
              <MarketOverview data={Object.values(marketData)} compact />
            )}
          </Paper>
        </Grid>
        
        {/* Recent Activity */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
             <RecentActivity
               activities={getRecentActivities()}
             />
            {(
              (!recentTrades || recentTrades.length === 0) &&
              (!todaysSignals || (todaysSignals as any[]).length === 0) &&
              (!notifications || notifications.length === 0)
            ) && (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No recent activity yet. Your trades, signals, and notifications will appear here.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Today's Summary */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Today's Summary
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Trades Executed
                </Typography>
                <Typography variant="h6">
                  {dashboardMetrics.todayTrades}
                </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Signals Generated
                </Typography>
                <Typography variant="h6">
                  {(todaysSignals as any[]).length}
                </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Active Positions
                </Typography>
                <Typography variant="h6">
                  {dashboardMetrics.activePositions}
                </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Portfolio Change
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography 
                    variant="h6"
                    color={dashboardMetrics.dailyPnL >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(dashboardMetrics.dailyPnL)}
                  </Typography>
                  {dashboardMetrics.dailyPnL >= 0 ? 
                    <TrendingUp color="success" /> : 
                    <TrendingDown color="error" />
                  }
                </Box>
              </Box>
              
              {/* Performance Indicator */}
              <Box 
                sx={{ 
                  mt: 3, 
                  p: 2, 
                  borderRadius: 2,
                  backgroundColor: alpha(
                    dashboardMetrics.dailyPnL >= 0 ? 
                      theme.palette.success.main : 
                      theme.palette.error.main, 
                    0.1
                  ),
                  border: `1px solid ${alpha(
                    dashboardMetrics.dailyPnL >= 0 ? 
                      theme.palette.success.main : 
                      theme.palette.error.main, 
                    0.2
                  )}`
                }}
              >
                <Typography 
                  variant="body2" 
                  color={dashboardMetrics.dailyPnL >= 0 ? 'success.main' : 'error.main'}
                  fontWeight="medium"
                  align="center"
                >
                  {dashboardMetrics.dailyPnL >= 0 ? '📈' : '📉'} 
                  {dashboardMetrics.dailyPnL >= 0 ? ' Profitable Day' : ' Loss Day'}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  align="center"
                  sx={{ mt: 0.5 }}
                >
                  {formatPercentage(dashboardMetrics.dailyPnLPercentage)} change
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        
        {/* System Status */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Status
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: wsConnected ? 'success.main' : 'error.main',
                    }}
                  />
                  <Typography variant="body2">
                    WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: isMarketConnected ? 'success.main' : 'error.main',
                    }}
                  />
                  <Typography variant="body2">
                    Market Data: {isMarketConnected ? 'Live' : 'Delayed'}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: 'success.main',
                    }}
                  />
                  <Typography variant="body2">
                    Trading Engine: Active
                  </Typography>
                </Box>
              </Grid>
              
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: activeSignals.length > 0 ? 'success.main' : 'warning.main',
                    }}
                  />
                  <Typography variant="body2">
                    Signal Generation: {activeSignals.length > 0 ? 'Active' : 'Standby'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {/* Last Update Info */}
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                Last updated: {new Date().toLocaleTimeString()} • 
                Auto-refresh: {wsConnected ? 'Enabled' : 'Disabled'}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Quick Action Floating Button */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <Button
          variant="contained"
          size="large"
          startIcon={<ShowChart />}
          sx={{
            borderRadius: 8,
            px: 3,
            py: 1.5,
            boxShadow: theme.shadows[8],
            '&:hover': {
              boxShadow: theme.shadows[12],
            },
          }}
          component={RouterLink}
          to="/signals"
        >
          New Signal
        </Button>
        <Button
          variant="outlined"
          startIcon={<Assessment />}
          component={RouterLink}
          to="/analytics"
        >
          Analytics
        </Button>
      </Box>
    </Container>
  );
};

export default Dashboard;
export {};

