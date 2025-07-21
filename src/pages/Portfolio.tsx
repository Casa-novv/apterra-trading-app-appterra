import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import {
  Container,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Grid,
  useTheme,
  Alert,
  Snackbar,
  Badge,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Add,
  Edit,
  AccountBalance,
  ShowChart,
  Assessment,
  Timeline,
  Warning,
  CheckCircle,
  Error,
  Info,
  AutoAwesome,
  Speed,
  Psychology,
} from '@mui/icons-material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import { DebugPanel } from '../components/DebugPanel';
import { 
  fetchPortfolio, 
  createDemoAccount, 
  resetDemoAccount,
  closeDemoPosition,
  closeAllDemoPositions,
  selectPortfolioStats,
  selectPositionsNearTakeProfit,
  selectPositionsNearStopLoss,
  selectPortfolioNotifications,
  clearNotifications,
} from '../store/slices/portfolioSlice';
import useWebSocket from '../hooks/useWebSocket';

const safeCurrency = (value: number | string | undefined | null): string => {
  const numValue = Number(value);
  if (isNaN(numValue)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
};

const safeNumber = (value: number | string | undefined | null): string => {
  const numValue = Number(value);
  if (isNaN(numValue)) return '0.00';
  return numValue.toLocaleString(undefined, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 4 
  });
};

const safePercentage = (value: number | string | undefined | null): string => {
  const numValue = Number(value);
  if (isNaN(numValue)) return '0.00%';
  return `${numValue.toFixed(2)}%`;
};

const ORIGINAL_BALANCE = 100000;

// Enhanced price fetching with better error handling
const fetchMultiMarketPrices = async (positions: any[]) => {
  const prices: Record<string, number> = {};
  console.log('🔄 Starting price fetch for', positions.length, 'positions');

  // Group symbols by market - with fallback for missing market field
  const cryptoSymbols = positions
    .filter(p => !p.market || p.market === 'crypto' || p.symbol?.includes('USDT'))
    .map(p => p.symbol);
  
  console.log('💰 Crypto symbols to fetch:', cryptoSymbols);

  // Fetch crypto prices
  for (const symbol of cryptoSymbols) {
    if (!symbol) continue;
    
    try {
      console.log(`📈 Fetching ${symbol} from backend...`);
      
      const response = await fetch(`http://localhost:5000/api/price/${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`📊 Response status for ${symbol}:`, response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Response data for ${symbol}:`, data);
        
        if (data.price && !isNaN(data.price)) {
          prices[symbol] = Number(data.price);
          console.log(`✅ ${symbol}: $${prices[symbol]}`);
        } else {
          console.error(`❌ Invalid price data for ${symbol}:`, data);
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ HTTP Error ${response.status} for ${symbol}:`, errorText);
      }
    } catch (error) {
      console.error(`❌ Network error fetching ${symbol}:`, error);
    }
  }

  console.log('📊 Final prices object:', prices);
  return prices;
};

const Portfolio: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { positions = [], loading, error } = useAppSelector((state: any) => state.portfolio || {});
  const portfolioStats = useAppSelector(selectPortfolioStats);
  const positionsNearTakeProfit = useAppSelector(selectPositionsNearTakeProfit);
  const positionsNearStopLoss = useAppSelector(selectPositionsNearStopLoss);
  const notifications = useAppSelector(selectPortfolioNotifications);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [newPosition, setNewPosition] = useState({
    symbol: '',
    type: 'BUY' as 'BUY' | 'SELL',
    quantity: '',
    entryPrice: '',
    market: 'crypto',
  });
  const [demoAccount, setDemoAccount] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [accountActionLoading, setAccountActionLoading] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [realizedPnLPeriod, setRealizedPnLPeriod] = useState('30d');
  const [showNotifications, setShowNotifications] = useState(true);

  // WebSocket connection for real-time updates
  const { isConnected: wsConnected } = useWebSocket({
    onPortfolioUpdate: (data) => {
      console.log('💰 Portfolio update received:', data);
      // Portfolio updates are handled automatically via Redux
    },
  });

  // User ID from auth state
  const userId = useAppSelector((state: any) => state.auth.user?._id || state.auth.user?.id);

  // Fetch account on mount
  useEffect(() => {
    if (userId) {
      dispatch(fetchPortfolio(userId))
        .unwrap()
        .then((data) => {
          setDemoAccount(data);
          setShowPrompt(false);
        })
        .catch(() => {
          setShowPrompt(true);
        });
    }
  }, [userId, dispatch]);

  // Enhanced price update effect with better error handling
  useEffect(() => {
    const updatePrices = async () => {
      if (!demoAccount?.openPositions?.length) return;
      
      const latestPrices = await fetchMultiMarketPrices(demoAccount.openPositions);
      
      setDemoAccount((prev: any) => {
        const updatedPositions = prev.openPositions.map((pos: any) => ({
          ...pos,
          currentPrice: latestPrices[pos.symbol] ?? pos.currentPrice,
        }));
        
        return {
          ...prev,
          openPositions: updatedPositions,
        };
      });
    };
    
    updatePrices();
    const interval = setInterval(updatePrices, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [demoAccount?.openPositions?.length]);

  // Auto-hide notifications after 5 seconds
  useEffect(() => {
    if (notifications.positionClosed || notifications.takeProfitHit || notifications.stopLossHit) {
      const timer = setTimeout(() => {
        dispatch(clearNotifications());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications, dispatch]);

  // Prepare open positions with P&L
  const validOpenPositions = (demoAccount?.openPositions || []).filter(
    (pos: any) => pos && typeof pos === 'object' && (pos._id || pos.id)
  );
  
  const gridOpenPositionsWithPnL = validOpenPositions.map((pos: any) => {
    const entry = Number(pos.entryPrice) || 0;
    const current = Number(pos.currentPrice ?? pos.entryPrice) || 0;
    const qty = Number(pos.quantity) || 0;
    const type = pos.type || pos.direction || 'BUY';
    
    let pnl = 0;
    if (type === 'BUY') {
      pnl = (current - entry) * qty;
    } else if (type === 'SELL') {
      pnl = (entry - current) * qty;
    }
    
    const invested = entry * qty;
    const pnlPercentage = invested !== 0 ? (pnl / invested) * 100 : 0;
    
    // Check if position is near take profit or stop loss
    const nearTakeProfit = pos.targetPrice && Math.abs(current - pos.targetPrice) / entry <= 0.02;
    const nearStopLoss = pos.stopLoss && Math.abs(current - pos.stopLoss) / entry <= 0.02;
    
    console.log(`Calculating P&L for ${pos.symbol}:`, {
      entry,
      current,
      qty,
      type,
      pnl,
      pnlPercentage,
      invested,
      nearTakeProfit,
      nearStopLoss
    });
    
    return {
      ...pos,
      id: pos.id || pos._id,
      type,
      market: pos.market || 'crypto',
      currentPrice: current,
      pnl: Number(pnl.toFixed(2)),
      pnlPercentage: Number(pnlPercentage.toFixed(2)),
      nearTakeProfit,
      nearStopLoss,
    };
  });

  // Prepare closed positions for history
  const closedPositions = demoAccount?.tradeHistory || [];
  const validClosedPositions = closedPositions.filter(
    (pos: any) => pos && typeof pos === 'object' && (pos._id || pos.id)
  );
  const gridClosedPositions = validClosedPositions.map((row: any) => ({
    ...row,
    id: row.id || row._id,
  }));

  // Handlers
  const handleAddPosition = () => {
    setSelectedPosition(null);
    setNewPosition({
      symbol: '',
      type: 'BUY',
      quantity: '',
      entryPrice: '',
      market: 'crypto',
    });
    setOpenDialog(true);
  };

  const handleEditPosition = (position: any) => {
    setSelectedPosition(position);
    setNewPosition({
      symbol: position.symbol,
      type: position.type,
      quantity: position.quantity.toString(),
      entryPrice: position.entryPrice.toString(),
      market: position.market,
    });
    setOpenDialog(true);
  };

  const handleSavePosition = async () => {
    if (!userId) return;
    
    setAccountActionLoading(true);
    setAccountError('');
    
    try {
      if (selectedPosition) {
        // Edit existing position logic here
        console.log('Editing position:', selectedPosition);
      } else {
        // Add new position
        const positionData = {
          symbol: newPosition.symbol,
          direction: newPosition.type,
          quantity: Number(newPosition.quantity),
          entryPrice: Number(newPosition.entryPrice),
          market: newPosition.market,
        };
        
        await axios.post(`/api/demo-account/${userId}/positions`, positionData);
        setAccountSuccess('Position added successfully!');
      }
      
      setOpenDialog(false);
      dispatch(fetchPortfolio(userId));
    } catch (err: any) {
      setAccountError(err.response?.data?.message || 'Failed to save position');
    }
    
    setAccountActionLoading(false);
  };

  const handleClosePosition = async (positionId: string) => {
    if (!userId) return;
    
    try {
      await dispatch(closeDemoPosition({ userId, positionId })).unwrap();
      setAccountSuccess('Position closed successfully!');
    } catch (err: any) {
      setAccountError(err.message || 'Failed to close position');
    }
  };

  const handleCloseAllPositions = async () => {
    if (!userId) return;
    
    try {
      await dispatch(closeAllDemoPositions(userId)).unwrap();
      setAccountSuccess('All positions closed successfully!');
    } catch (err: any) {
      setAccountError(err.message || 'Failed to close all positions');
    }
  };

  const handleCreateAccount = async () => {
    if (!userId) return;
    
    setAccountActionLoading(true);
    setAccountError('');
    
    try {
      await dispatch(createDemoAccount(userId)).unwrap();
      setAccountSuccess('Demo account created successfully!');
      setShowPrompt(false);
      dispatch(fetchPortfolio(userId));
    } catch (err: any) {
      setAccountError(err.message || 'Failed to create demo account');
    }
    
    setAccountActionLoading(false);
  };

  const handleResetAccount = async () => {
    if (!userId) return;
    
    setAccountActionLoading(true);
    setAccountError('');
    
    try {
      await dispatch(resetDemoAccount({ userId, balance: ORIGINAL_BALANCE })).unwrap();
      setAccountSuccess('Account reset successfully!');
      dispatch(fetchPortfolio(userId));
    } catch (err: any) {
      setAccountError(err.message || 'Failed to reset account');
    }
    
    setAccountActionLoading(false);
  };

  // Position monitoring alerts
  const getPositionAlert = () => {
    if (positionsNearTakeProfit.length > 0) {
      return {
        type: 'warning' as const,
        message: `${positionsNearTakeProfit.length} position(s) near take profit`,
        icon: <CheckCircle />,
      };
    }
    
    if (positionsNearStopLoss.length > 0) {
      return {
        type: 'error' as const,
        message: `${positionsNearStopLoss.length} position(s) near stop loss`,
        icon: <Warning />,
      };
    }
    
    return null;
  };

  const positionAlert = getPositionAlert();

  // Data Grid columns for open positions
  const openPositionColumns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight="bold">
            {params.value}
          </Typography>
          {params.row.source === 'enterprise_ml' && (
            <Tooltip title="Enterprise ML Signal">
              <AutoAwesome fontSize="small" color="primary" />
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'BUY' ? 'success' : 'error'}
          icon={params.value === 'BUY' ? <TrendingUp /> : <TrendingDown />}
        />
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 100,
      type: 'number',
    },
    {
      field: 'entryPrice',
      headerName: 'Entry Price',
      width: 120,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
    },
    {
      field: 'currentPrice',
      headerName: 'Current Price',
      width: 130,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">
            {safeCurrency(params.value)}
          </Typography>
          {params.row.nearTakeProfit && (
            <Tooltip title="Near Take Profit">
              <CheckCircle fontSize="small" color="success" />
            </Tooltip>
          )}
          {params.row.nearStopLoss && (
            <Tooltip title="Near Stop Loss">
              <Warning fontSize="small" color="error" />
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'targetPrice',
      headerName: 'Target',
      width: 100,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
    },
    {
      field: 'stopLoss',
      headerName: 'Stop Loss',
      width: 110,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
    },
    {
      field: 'pnl',
      headerName: 'P&L',
      width: 120,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value >= 0 ? 'success.main' : 'error.main'}
          fontWeight="bold"
        >
          {safeCurrency(params.value)}
        </Typography>
      ),
    },
    {
      field: 'pnlPercentage',
      headerName: 'P&L %',
      width: 100,
      type: 'number',
      valueFormatter: (params: any) => safePercentage(params.value),
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value >= 0 ? 'success.main' : 'error.main'}
        >
          {safePercentage(params.value)}
        </Typography>
      ),
    },
    {
      field: 'market',
      headerName: 'Market',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit Position">
            <IconButton
              size="small"
              onClick={() => handleEditPosition(params.row)}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close Position">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleClosePosition(params.row.id)}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  // Data Grid columns for closed positions
  const closedPositionColumns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      width: 120,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'BUY' ? 'success' : 'error'}
        />
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 100,
      type: 'number',
    },
    {
      field: 'entryPrice',
      headerName: 'Entry Price',
      width: 120,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
    },
    {
      field: 'currentPrice',
      headerName: 'Exit Price',
      width: 120,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
    },
    {
      field: 'pnl',
      headerName: 'P&L',
      width: 120,
      type: 'number',
      valueFormatter: (params: any) => safeCurrency(params.value),
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value >= 0 ? 'success.main' : 'error.main'}
          fontWeight="bold"
        >
          {safeCurrency(params.value)}
        </Typography>
      ),
    },
    {
      field: 'closureType',
      headerName: 'Closure',
      width: 120,
      renderCell: (params) => {
        if (!params.value) return <Chip label="Manual" size="small" />;
        
        const isTakeProfit = params.value === 'take_profit_hit';
        return (
          <Chip
            label={isTakeProfit ? 'Take Profit' : 'Stop Loss'}
            size="small"
            color={isTakeProfit ? 'success' : 'error'}
            icon={isTakeProfit ? <CheckCircle /> : <Warning />}
          />
        );
      },
    },
    {
      field: 'openedAt',
      headerName: 'Opened',
      width: 150,
      valueFormatter: (params: { value: string | number | Date }) => new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'closedAt',
      headerName: 'Closed',
      width: 150,
      valueFormatter: (params: { value: string | number | Date }) => new Date(params.value).toLocaleDateString(),
    },
  ];

  // Stat Card Component
  const StatCard: React.FC<{
    title: string;
    value: string;
    change?: string;
    changeType?: 'positive' | 'negative';
    icon: React.ReactNode;
    color?: string;
  }> = ({ title, value, change, changeType, icon, color = 'primary' }) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: `${color}.main` }}>
              {value}
            </Typography>
            {change && (
              <Typography
                variant="body2"
                color={changeType === 'positive' ? 'success.main' : 'error.main'}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
              >
                {changeType === 'positive' ? '↗' : '↘'} {change}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: `${color}.main`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Trading Recommendations Component
  const TradingRecommendations: React.FC<{ data: {
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    totalTrades: number;
    totalPnL: number;
    takeProfitHits: number;
    stopLossHits: number;
    avgHoldingTime: number;
  } }> = ({ data }) => {
    const getRecommendations = () => {
      const recommendations = [];
      
      if (data.winRate < 50) {
        recommendations.push({
          type: 'warning',
          message: 'Win rate below 50%. Consider reviewing your entry/exit strategies.',
          icon: <Warning />,
        });
      }
      
      if (data.profitFactor < 1.5) {
        recommendations.push({
          type: 'warning',
          message: 'Profit factor below 1.5. Focus on improving risk-reward ratios.',
          icon: <Assessment />,
        });
      }
      
      if (data.takeProfitHits > data.stopLossHits * 2) {
        recommendations.push({
          type: 'info',
          message: 'Good take profit execution. Consider tightening stop losses.',
          icon: <CheckCircle />,
        });
      }
      
      if (data.avgHoldingTime < 2) {
        recommendations.push({
          type: 'info',
          message: 'Short average holding time. Consider longer-term positions.',
          icon: <Timeline />,
        });
      }
      
      if (data.totalPnL > 0 && data.winRate > 60) {
        recommendations.push({
          type: 'success',
          message: 'Excellent performance! Keep up the good work.',
          icon: <CheckCircle />,
        });
      }
      
      return recommendations;
    };

    const recommendations = getRecommendations();

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Psychology />
            Trading Recommendations
          </Typography>
          {recommendations.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recommendations.map((rec, index) => (
                <Alert
                  key={index}
                  severity={rec.type as any}
                  icon={rec.icon}
                  sx={{ '& .MuiAlert-message': { fontSize: '0.875rem' } }}
                >
                  {rec.message}
                </Alert>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No specific recommendations at this time.
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  if (showPrompt) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Welcome to Your Demo Trading Account
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Start your trading journey with a $100,000 demo account. Practice with real market data and test your strategies risk-free.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleCreateAccount}
            disabled={accountActionLoading}
            sx={{ mr: 2 }}
          >
            {accountActionLoading ? 'Creating...' : 'Create Demo Account'}
          </Button>
          {accountError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {accountError}
            </Alert>
          )}
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Portfolio Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Chip 
            label={`WebSocket: ${wsConnected ? 'Connected' : 'Disconnected'}`} 
            color={wsConnected ? 'success' : 'error'} 
            variant="outlined" 
          />
          <Chip 
            label={`${portfolioStats.openPositions} Open Positions`} 
            color="primary" 
            variant="outlined" 
          />
          <Chip 
            label={`${portfolioStats.closedPositions} Closed Trades`} 
            color="info" 
            variant="outlined" 
          />
        </Box>
      </Box>

      {/* Notifications */}
      <Snackbar
        open={showNotifications && (notifications.positionClosed || notifications.takeProfitHit || notifications.stopLossHit)}
        autoHideDuration={5000}
        onClose={() => setShowNotifications(false)}
      >
        <Alert
          severity={notifications.takeProfitHit ? 'success' : notifications.stopLossHit ? 'error' : 'info'}
          onClose={() => dispatch(clearNotifications())}
        >
          {notifications.takeProfitHit && 'Take profit target reached!'}
          {notifications.stopLossHit && 'Stop loss triggered!'}
          {notifications.positionClosed && 'Position closed successfully!'}
        </Alert>
      </Snackbar>

      {/* Position Alerts */}
      {positionAlert && (
        <Alert
          severity={positionAlert.type}
          icon={positionAlert.icon}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setShowNotifications(false)}>
              Dismiss
            </Button>
          }
        >
          {positionAlert.message}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Account Balance"
            value={safeCurrency(portfolioStats.balance)}
            change={safeCurrency(portfolioStats.totalPnL)}
            changeType={portfolioStats.totalPnL >= 0 ? 'positive' : 'negative'}
            icon={<AccountBalance />}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total P&L"
            value={safeCurrency(portfolioStats.totalPnL)}
            change={safePercentage(portfolioStats.totalReturnPercentage)}
            changeType={portfolioStats.totalReturnPercentage >= 0 ? 'positive' : 'negative'}
            icon={<ShowChart />}
            color={portfolioStats.totalPnL >= 0 ? 'success' : 'error'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Win Rate"
            value={`${portfolioStats.successRate.toFixed(1)}%`}
            icon={<Assessment />}
            color="info"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Profit Factor"
            value={portfolioStats.profitFactor.toFixed(2)}
            icon={<Timeline />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddPosition}
        >
          Add Position
        </Button>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleCloseAllPositions}
          disabled={!demoAccount?.openPositions?.length}
        >
          Close All Positions
        </Button>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleResetAccount}
        >
          Reset Account
        </Button>
      </Box>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Open Positions */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Open Positions ({gridOpenPositionsWithPnL.length})
            </Typography>
            {gridOpenPositionsWithPnL.length > 0 ? (
              <DataGrid
                rows={gridOpenPositionsWithPnL}
                columns={openPositionColumns}
                paginationModel={{ pageSize: 10, page: 0 }}
                pageSizeOptions={[5, 10, 25]}
                disableRowSelectionOnClick
                autoHeight
                slots={{
                  toolbar: GridToolbar,
                }}
                sx={{
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No open positions
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddPosition}
                  sx={{ mt: 1 }}
                >
                  Add Your First Position
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Trading Recommendations */}
        <Grid size={{ xs: 12, lg: 4 }}>
        <TradingRecommendations
         data={{
          winRate: portfolioStats.successRate,
          profitFactor: portfolioStats.profitFactor,
          avgWin: 0,
          avgLoss: 0,
          totalTrades: 0,
          totalPnL: portfolioStats.totalPnL,
          takeProfitHits: portfolioStats.takeProfitHits,
          stopLossHits: portfolioStats.stopLossHits,
          avgHoldingTime: portfolioStats.avgHoldingTime,
  }}
/>
        </Grid>

        {/* Trade History */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Trade History ({gridClosedPositions.length})
            </Typography>
            {gridClosedPositions.length > 0 ? (
              <DataGrid
                rows={gridClosedPositions}
                columns={closedPositionColumns}
                paginationModel={{ pageSize: 10, page: 0 }}
                pageSizeOptions={[5, 10, 25]}
                disableRowSelectionOnClick
                autoHeight
                slots={{
                  toolbar: GridToolbar,
                }}
                sx={{
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No trade history yet
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Add/Edit Position Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedPosition ? 'Edit Position' : 'Add New Position'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Symbol"
                value={newPosition.symbol}
                onChange={(e) => setNewPosition({ ...newPosition, symbol: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newPosition.type}
                  onChange={(e) => setNewPosition({ ...newPosition, type: e.target.value as 'BUY' | 'SELL' })}
                  label="Type"
                >
                  <MenuItem value="BUY">BUY</MenuItem>
                  <MenuItem value="SELL">SELL</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={newPosition.quantity}
                onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Entry Price"
                type="number"
                value={newPosition.entryPrice}
                onChange={(e) => setNewPosition({ ...newPosition, entryPrice: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Market</InputLabel>
                <Select
                  value={newPosition.market}
                  onChange={(e) => setNewPosition({ ...newPosition, market: e.target.value })}
                  label="Market"
                >
                  <MenuItem value="crypto">Crypto</MenuItem>
                  <MenuItem value="forex">Forex</MenuItem>
                  <MenuItem value="stocks">Stocks</MenuItem>
                  <MenuItem value="commodities">Commodities</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          {accountError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {accountError}
            </Alert>
          )}
          
          {accountSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {accountSuccess}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSavePosition}
            variant="contained"
            disabled={accountActionLoading}
          >
            {accountActionLoading ? 'Saving...' : 'Save Position'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Debug Panel */}
      <DebugPanel positions={demoAccount?.openPositions || []} />
    </Container>
  );
};

export default Portfolio;