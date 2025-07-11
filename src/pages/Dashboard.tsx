import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Refresh,
  AccountBalance,
  ShowChart,
  Assessment,
  Star,
  NotificationsActive,
  LocalFireDepartment,
  Speed,
  Timeline,
  Visibility,
  Info,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchSignals } from '../store/slices/signalSlice';
import { useNavigate } from 'react-router-dom';

// Safe number formatter
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return defaultValue;
  }
  return Number(value);
};

// Safe percentage formatter
const safePercentage = (value: any, decimals: number = 2): string => {
  const num = safeNumber(value, 0);
  return num.toFixed(decimals);
};

// Safe currency formatter
const safeCurrency = (value: any, decimals: number = 2): string => {
  const num = safeNumber(value, 0);
  return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// StatCard Component with safe rendering
const StatCard: React.FC<{
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
  color?: string;
}> = ({ title, value, change, changeType, subtitle, icon, loading = false, color }) => {
  const theme = useTheme();
  
  return (
    <Card
      sx={{
        background: theme.palette.background.paper,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${theme.palette.divider}`,
        transition: 'transform 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
        },
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              component="div" 
              sx={{ 
                fontWeight: 'bold',
                color: color || 'inherit'
              }}
            >
              {loading ? '...' : value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {change && (
              <Box display="flex" alignItems="center" mt={1}>
                {changeType === 'positive' ? (
                  <TrendingUp sx={{ color: theme.palette.success.main, fontSize: 16, mr: 0.5 }} />
                ) : (
                  <TrendingDown sx={{ color: theme.palette.error.main, fontSize: 16, mr: 0.5 }} />
                )}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: changeType === 'positive' ? theme.palette.success.main : theme.palette.error.main 
                  }}
                >
                  {change}
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: color || theme.palette.primary.main, opacity: 0.7 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const getGreeting = (userName: string) => {
  const hour = new Date().getHours();
  const greetings = [
    // Morning greetings (5-11 AM)
    ...(hour >= 5 && hour < 12 ? [
      `Good morning, ${userName}! ☀️ Ready to conquer the markets today?`,
      `Rise and shine, ${userName}! 🌅 Let's make some profitable trades!`,
      `Morning, ${userName}! ☕ Time to turn coffee into cash!`,
      `Good morning, ${userName}! 🚀 Today's looking bullish for your portfolio!`,
      `Hey ${userName}! 🌟 Let's start this trading day strong!`,
    ] : []),
    
    // Afternoon greetings (12-17 PM)
    ...(hour >= 12 && hour < 17 ? [
      `Good afternoon, ${userName}! 📈 How are your trades performing?`,
      `Afternoon, ${userName}! 💰 Time to check those winning positions!`,
      `Hey ${userName}! ⚡ Let's keep the momentum going!`,
      `Good afternoon, ${userName}! 🎯 Ready to spot some opportunities?`,
      `Afternoon trader ${userName}! 🔥 Let's make some money moves!`,
    ] : []),
    
    // Evening greetings (17-21 PM)
    ...(hour >= 17 && hour < 21 ? [
      `Good evening, ${userName}! 🌆 Time to review today's performance!`,
      `Evening, ${userName}! 📊 Let's analyze those market moves!`,
      `Hey ${userName}! 🌙 Perfect time for some strategic planning!`,
      `Good evening, ${userName}! ✨ Ready for some after-hours insights?`,
      `Evening trader ${userName}! 🎪 Let's see what the markets brought us!`,
    ] : []),
    
    // Night greetings (21-5 AM)
    ...(hour >= 21 || hour < 5 ? [
      `Good evening, ${userName}! 🌃 Burning the midnight oil?`,
      `Hey night owl ${userName}! 🦉 Checking those global markets?`,
      `Evening, ${userName}! 🌟 Perfect time for crypto trading!`,
      `Good night, ${userName}! 🌙 Don't forget to set those stop losses!`,
      `Late night trading, ${userName}? 💫 The markets never sleep!`,
    ] : []),
    
    // General motivational greetings
    `Welcome back, ${userName}! 💎 Diamond hands make diamond profits!`,
    `Hey ${userName}! 🚀 Ready to reach for the moon?`,
    `What's up, ${userName}! 🎯 Let's hit those profit targets!`,
    `Welcome, ${userName}! 🔥 Your name is waiting for some action!`,
    `Hey there, ${userName}! ⚡ Time to make the market work for you!`,
  ];
  
  return greetings[Math.floor(Math.random() * greetings.length)];
};

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Redux state with safe defaults
  const { signals = [], loading: signalsLoading = false } = useAppSelector((state: any) => state.signals || {});
  const userId = useAppSelector((state: any) => state.auth.user?._id || state.auth.user?.id);

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [demoAccount, setDemoAccount] = useState<any>(null);
  const [greeting, setGreeting] = useState('');

  // Calculate safe portfolio stats
  const portfolioStats = {
    balance: safeNumber(demoAccount?.balance, 100000),
    totalPnL: safeNumber(demoAccount?.openPositions?.reduce((sum: number, pos: any) => {
      const entry = safeNumber(pos.entryPrice, 0);
      const current = safeNumber(pos.currentPrice || pos.entryPrice, entry);
      const qty = safeNumber(pos.quantity, 0);
      const type = pos.type || pos.direction || 'BUY';
      let pnl = 0;
      if (type === 'BUY') pnl = (current - entry) * qty;
      else if (type === 'SELL') pnl = (entry - current) * qty;
      return sum + pnl;
    }, 0), 0),
    openPositions: safeNumber(demoAccount?.openPositions?.length, 0),
    closedPositions: safeNumber(demoAccount?.tradeHistory?.length, 0),
    totalWins: safeNumber(demoAccount?.tradeHistory?.filter((pos: any) => safeNumber(pos.pnl, 0) > 0).length, 0),
    totalLosses: safeNumber(demoAccount?.tradeHistory?.filter((pos: any) => safeNumber(pos.pnl, 0) <= 0).length, 0),
    todaysPnL: 0, // Calculate based on today's trades
    largestWin: safeNumber(Math.max(...(demoAccount?.tradeHistory?.map((pos: any) => safeNumber(pos.pnl, 0)) || [0])), 0),
    largestLoss: safeNumber(Math.min(...(demoAccount?.tradeHistory?.map((pos: any) => safeNumber(pos.pnl, 0)) || [0])), 0),
    avgWinAmount: 0,
    avgLossAmount: 0,
    profitFactor: 1,
  };

  // Calculate derived stats safely
  (portfolioStats as any).totalReturnPercentage = portfolioStats.balance > 0 
    ? (portfolioStats.totalPnL / portfolioStats.balance) * 100 
    : 0;
  
  (portfolioStats as any).successRate = portfolioStats.closedPositions > 0 
    ? (portfolioStats.totalWins / portfolioStats.closedPositions) * 100 
    : 0;

  const winTrades = demoAccount?.tradeHistory?.filter((pos: any) => safeNumber(pos.pnl, 0) > 0) || [];
  const lossTrades = demoAccount?.tradeHistory?.filter((pos: any) => safeNumber(pos.pnl, 0) <= 0) || [];
  
  portfolioStats.avgWinAmount = winTrades.length > 0 
    ? winTrades.reduce((sum: number, pos: any) => sum + safeNumber(pos.pnl, 0), 0) / winTrades.length 
    : 0;
  
  portfolioStats.avgLossAmount = lossTrades.length > 0 
    ? Math.abs(lossTrades.reduce((sum: number, pos: any) => sum + safeNumber(pos.pnl, 0), 0) / lossTrades.length)
    : 0;
  
  portfolioStats.profitFactor = portfolioStats.avgLossAmount > 0 
    ? portfolioStats.avgWinAmount / portfolioStats.avgLossAmount 
    : 1;

  // Signal stats with safe defaults
  const signalStats = {
    activeSignals: safeNumber(signals.filter((s: any) => s.status === 'active' || !s.status).length, 0),
    highConfidence: safeNumber(signals.filter((s: any) => safeNumber(s.confidence, 0) >= 80).length, 0),
    todaysSignals: safeNumber(signals.filter((s: any) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const signalDate = new Date(s.timestamp || s.createdAt || Date.now());
      return signalDate >= today;
    }).length, 0),
  };

  // Safe arrays for rendering
  const topPerformingPositions = (demoAccount?.openPositions || [])
    .map((pos: any) => {
      const entry = safeNumber(pos.entryPrice, 0);
      const current = safeNumber(pos.currentPrice || pos.entryPrice, entry);
      const qty = safeNumber(pos.quantity, 0);
      const type = pos.type || pos.direction || 'BUY';
      let pnl = 0;
      if (type === 'BUY') pnl = (current - entry) * qty;
      else if (type === 'SELL') pnl = (entry - current) * qty;
      const invested = entry * qty;
      const pnlPercentage = invested !== 0 ? (pnl / invested) * 100 : 0;
      return {
        ...pos,
        id: pos.id || pos._id || Math.random().toString(),
        pnl,
        pnlPercentage,
        type
      };
    })
    .filter((pos: any) => pos.pnl > 0)
    .sort((a: any, b: any) => b.pnl - a.pnl);

  const worstPerformingPositions = (demoAccount?.openPositions || [])
    .map((pos: any) => {
      const entry = safeNumber(pos.entryPrice, 0);
      const current = safeNumber(pos.currentPrice || pos.entryPrice, entry);
      const qty = safeNumber(pos.quantity, 0);
      const type = pos.type || pos.direction || 'BUY';
      let pnl = 0;
      if (type === 'BUY') pnl = (current - entry) * qty;
      else if (type === 'SELL') pnl = (entry - current) * qty;
      const invested = entry * qty;
      const pnlPercentage = invested !== 0 ? (pnl / invested) * 100 : 0;
      return {
        ...pos,
        id: pos.id || pos._id || Math.random().toString(),
        pnl,
        pnlPercentage,
        type
      };
    })
    .filter((pos: any) => pos.pnl < 0)
    .sort((a: any, b: any) => a.pnl - b.pnl);

  const highConfidenceSignals = signals.filter((s: any) => safeNumber(s.confidence, 0) >= 80);
  const recentTrades = (demoAccount?.tradeHistory || []).slice(-10);

  // Fetch data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        await dispatch(fetchSignals());
        
        if (userId) {
          // Fetch demo account data
          const response = await fetch(`/api/demo-account/${userId}`);
          if (response.ok) {
            const accountData = await response.json();
            setDemoAccount(accountData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data data error');
      }
    };

    fetchAllData();
  }, [dispatch, userId]);

  // Get user from Redux state
  const user = useAppSelector((state: any) => state.auth.user);

  useEffect(() => {
    if (user?.name || user?.username || user?.email) {
      const userName = user?.username || user?.name || user?.email?.split('@')[0] || 'Trader';
      setGreeting(getGreeting(userName));
    }
  }, [user]);

  // Generate alerts based on portfolio and signals
  useEffect(() => {
    const newAlerts = [];

    // Portfolio alerts
    if (portfolioStats.totalPnL < -1000) {
      newAlerts.push({
        type: 'warning',
        message: `Portfolio down ${safeCurrency(Math.abs(portfolioStats.totalPnL))}`,
        action: 'Review positions',
      });
    }

    const successRate = (portfolioStats.totalWins / (portfolioStats.totalWins + portfolioStats.totalLosses)) * 100;
    if (successRate < 50 && portfolioStats.closedPositions > 5) {
      newAlerts.push({
        type: 'error',
        message: `Success rate below 50% (${safePercentage(successRate, 1)}%)`,
        action: 'Analyze strategy',
      });
    }

    // Signal alerts
    if (signalStats.highConfidence > 0) {
      newAlerts.push({
        type: 'success',
        message: `${signalStats.highConfidence} high-confidence signals available`,
        action: 'View signals',
      });
    }

    setAlerts(newAlerts);
  }, [portfolioStats, signalStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchSignals());
      
      if (userId) {
        const response = await fetch(`/api/demo-account/${userId}`);
        if (response.ok) {
          const accountData = await response.json();
          setDemoAccount(accountData);
        }
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
    setRefreshing(false);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Trading Dashboard
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Real-time overview of your trading performance
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={refreshing}
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
            '&:hover': {
              background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.primary.dark || theme.palette.primary.main} 90%)`,
            },
          }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </Box>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Box mb={4}>
          {alerts.map((alert, index) => (
            <Alert
              key={index}
              severity={alert.type}
              action={
                <Button color="inherit" size="small">
                  {alert.action}
                </Button>
              }
              sx={{ mb: 1 }}
            >
              {alert.message}
            </Alert>
          ))}
        </Box>
      )}

      {/* Welcome Greeting */}
      {greeting && (
        <Paper
          sx={{
            p: 3,
            mb: 4,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}20 0%, ${theme.palette.secondary.main}20 100%)`,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 'bold',
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1
                }}
              >
                {greeting}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your trading dashboard is ready • Demo Balance: ${safeCurrency(portfolioStats.balance)}
              </Typography>
            </Box>
            <Box sx={{ fontSize: '2rem' }}>
              {new Date().getHours() >= 5 && new Date().getHours() < 12 ? '☀️' :
               new Date().getHours() >= 12 && new Date().getHours() < 17 ? '🌤️' :
               new Date().getHours() >= 17 && new Date().getHours() < 21 ? '🌆' : '🌙'}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Main Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Portfolio Balance"
            value={`${safeCurrency(portfolioStats.balance)}`}
            subtitle="Demo Account"
            icon={<AccountBalance sx={{ fontSize: 40 }} />}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total P&L"
            value={`${safeCurrency(portfolioStats.totalPnL)}`}
            change={`${safePercentage((portfolioStats.totalPnL / portfolioStats.balance) * 100)}%`}
            changeType={portfolioStats.totalPnL >= 0 ? 'positive' : 'negative'}
            icon={<ShowChart sx={{ fontSize: 40 }} />}
            color={portfolioStats.totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Success Rate"
            value={`${safePercentage((portfolioStats.totalWins / (portfolioStats.totalWins + portfolioStats.totalLosses)) * 100, 1)}%`}
            subtitle={`${portfolioStats.totalWins}W / ${portfolioStats.totalLosses}L`}
            icon={<Assessment sx={{ fontSize: 40 }} />}
            color={(portfolioStats.totalWins / (portfolioStats.totalWins + portfolioStats.totalLosses)) * 100 >= 60 ? theme.palette.success.main : theme.palette.warning.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Active Signals"
            value={signalStats.activeSignals.toString()}
            subtitle={`${signalStats.highConfidence} high confidence`}
            icon={<NotificationsActive sx={{ fontSize: 40 }} />}
            color={theme.palette.info.main}
          />
        </Grid>
      </Grid>

      {/* Secondary Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Open Positions"
            value={portfolioStats.openPositions.toString()}
            icon={<Timeline sx={{ fontSize: 32 }} />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Profit Factor"
            value={safePercentage(portfolioStats.profitFactor, 2)}
            subtitle="Avg Win/Loss Ratio"
            icon={<Speed sx={{ fontSize: 32 }} />}
            color={portfolioStats.profitFactor >= 1.5 ? theme.palette.success.main : theme.palette.warning.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Largest Win"
            value={`${safeCurrency(portfolioStats.largestWin)}`}
            icon={<TrendingUp sx={{ fontSize: 32 }} />}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Largest Loss"
            value={`${safeCurrency(Math.abs(portfolioStats.largestLoss))}`}
            icon={<TrendingDown sx={{ fontSize: 32 }} />}
            color={theme.palette.error.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard
            title="Today's Signals"
            value={signalStats.todaysSignals.toString()}
            icon={<LocalFireDepartment sx={{ fontSize: 32 }} />}
            color={theme.palette.warning.main}
          />
        </Grid>
      </Grid>

      {/* Performance Tables */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              background: theme.palette.background.paper,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box p={3}>
              <Typography variant="h6" sx={{ color: theme.palette.success.main, fontWeight: 'bold', mb: 2 }}>
                📈 Top Performing Positions
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">P&L</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topPerformingPositions.slice(0, 5).map((position: any) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body2" fontWeight="bold">
                            {position.symbol || 'N/A'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={position.type || 'BUY'}
                          color={position.type === 'BUY' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ color: theme.palette.success.main, fontWeight: 'bold' }}
                        >
                          ${safeCurrency(position.pnl)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ color: theme.palette.success.main, fontWeight: 'bold' }}
                        >
                          +{safePercentage(position.pnlPercentage)}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {topPerformingPositions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No profitable positions
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              background: theme.palette.background.paper,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box p={3}>
              <Typography variant="h6" sx={{ color: theme.palette.error.main, fontWeight: 'bold', mb: 2 }}>
                📉 Worst Performing Positions
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">P&L</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {worstPerformingPositions.slice(0, 5).map((position: any) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body2" fontWeight="bold">
                            {position.symbol || 'N/A'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={position.type || 'BUY'}
                          color={position.type === 'BUY' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ color: theme.palette.error.main, fontWeight: 'bold' }}
                        >
                          ${safeCurrency(position.pnl)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ color: theme.palette.error.main, fontWeight: 'bold' }}
                        >
                          {safePercentage(position.pnlPercentage)}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {worstPerformingPositions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No losing positions
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* High Confidence Signals & Recent Trades */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              background: theme.palette.background.paper,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box p={3}>
              <Typography variant="h6" sx={{ color: theme.palette.warning.main, fontWeight: 'bold', mb: 2 }}>
                🔥 High Confidence Signals
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Confidence</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {highConfidenceSignals.slice(0, 5).map((signal: any) => (
                    <TableRow key={signal.id || Math.random()}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body2" fontWeight="bold">
                            {signal.symbol || 'N/A'}
                          </Typography>
                          <Chip
                            label={signal.market?.toUpperCase() || 'CRYPTO'}
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1, fontSize: '0.6rem' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={signal.type || 'BUY'}
                          color={signal.type === 'BUY' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" alignItems="center" justifyContent="flex-end">
                          <LinearProgress
                            variant="determinate"
                            value={safeNumber(signal.confidence, 0)}
                            sx={{
                              width: 40,
                              height: 4,
                              borderRadius: 2,
                              mr: 1,
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: safeNumber(signal.confidence, 0) >= 90 
                                  ? theme.palette.success.main 
                                  : theme.palette.warning.main,
                              },
                            }}
                          />
                          <Typography variant="body2" fontWeight="bold">
                            {safePercentage(signal.confidence, 0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View signal details">
                          <IconButton size="small" sx={{ color: theme.palette.primary.main }}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {highConfidenceSignals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No high confidence signals available
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              background: theme.palette.background.paper,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box p={3}>
              <Typography variant="h6" sx={{ color: theme.palette.info.main, fontWeight: 'bold', mb: 2 }}>
                📋 Recent Trades
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">P&L</TableCell>
                    <TableCell align="right">Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTrades.slice(0, 5).map((trade: any) => (
                    <TableRow key={trade.id || trade._id || Math.random()}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {trade.symbol || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={trade.type || trade.direction || 'BUY'}
                          color={(trade.type || trade.direction) === 'BUY' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            color: safeNumber(trade.pnl, 0) >= 0 ? theme.palette.success.main : theme.palette.error.main,
                            fontWeight: 'bold'
                          }}
                        >
                          ${safeCurrency(trade.pnl)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {trade.closedAt 
                            ? new Date(trade.closedAt).toLocaleDateString()
                            : new Date(trade.openedAt || Date.now()).toLocaleDateString()
                          }
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentTrades.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No recent trades
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper
        sx={{
          p: 3,
          background: theme.palette.background.paper,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6" sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 3 }}>
          🚀 Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<ShowChart />}
              sx={{
                background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                '&:hover': {
                  background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.primary.dark || theme.palette.primary.main} 90%)`,
                },
              }}
              onClick={() => navigate('/portfolio')}
            >
              View Portfolio
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<NotificationsActive />}
              sx={{
                background: `linear-gradient(45deg, ${theme.palette.warning.main} 30%, ${theme.palette.warning.main} 90%)`,
                '&:hover': {
                  background: `linear-gradient(45deg, ${theme.palette.warning.dark} 30%, ${theme.palette.warning.main} 90%)`,
                },
              }}
              onClick={() => navigate('/signals')}
            >
              View Signals
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Assessment />}
              onClick={() => navigate('/analytics')}
            >
              Analytics
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Info />}
              onClick={() => navigate('/help')}
            >
              Help & Support
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Footer Info */}
      <Box mt={4} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          Last updated: {new Date().toLocaleString()} • 
          Demo Account • 
          Data refreshes every 30 seconds
        </Typography>
      </Box>
    </Container>
  );
};

export default Dashboard;
