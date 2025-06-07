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
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Add,
  Edit,
  AccountBalance,
  ShowChart,
  Assessment,
} from '@mui/icons-material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';

const ORIGINAL_BALANCE = 100000;

// --- Recommendation: Move price fetchers to a utility file for production ---
const fetchMultiMarketPrices = async (positions: any[]) => {
  const prices: Record<string, number> = {};

  // Group symbols by market
  const cryptoSymbols = positions.filter(p => p.market === 'crypto').map(p => p.symbol);
  const forexSymbols = positions.filter(p => p.market === 'forex').map(p => p.symbol);
  const stockSymbols = positions.filter(p => p.market === 'stocks').map(p => p.symbol);
  const commoditySymbols = positions.filter(p => p.market === 'commodities').map(p => p.symbol);

  // --- Crypto (Binance) ---
  for (const symbol of cryptoSymbols) {
    try {
      const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      prices[symbol] = Number(res.data.price);
    } catch {
      prices[symbol] = NaN;
    }
  }

  // --- Forex (exchangerate.host) ---
  for (const symbol of forexSymbols) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    try {
      const res = await axios.get(`https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`);
      prices[symbol] = res.data.rates[quote];
    } catch {
      prices[symbol] = NaN;
    }
  }

  // --- Stocks (Yahoo Finance unofficial) ---
  for (const symbol of stockSymbols) {
    try {
      const res = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`);
      prices[symbol] = res.data.quoteResponse.result[0]?.regularMarketPrice;
    } catch {
      prices[symbol] = NaN;
    }
  }

  // --- Commodities (exchangerate.host) ---
  for (const symbol of commoditySymbols) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    try {
      const res = await axios.get(`https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`);
      prices[symbol] = res.data.rates[quote];
    } catch {
      prices[symbol] = NaN;
    }
  }

  return prices;
};

const Portfolio: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { positions = [], loading, error } = useAppSelector((state: any) => state.portfolio || {});
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

  // --- Recommendation: Use your actual user ID logic here ---
  const userId = useAppSelector((state: any) => state.auth.user?._id || state.auth.user?.id);

  // Fetch account on mount
  useEffect(() => {
    if (userId) {
      axios.get(`/api/demo-account/${userId}`)
        .then(res => setDemoAccount(res.data))
        .catch(() => setShowPrompt(true));
    }
  }, [userId]);

  // Update currentPrice every 30s
  useEffect(() => {
    const updatePrices = async () => {
      if (!demoAccount?.openPositions?.length) return;
      const latestPrices = await fetchMultiMarketPrices(demoAccount.openPositions);
      setDemoAccount((prev: any) => ({
        ...prev,
        openPositions: prev.openPositions.map((pos: any) => ({
          ...pos,
          currentPrice: latestPrices[pos.symbol] ?? pos.currentPrice,
        })),
      }));
    };
    updatePrices();
    const interval = setInterval(updatePrices, 30000);
    return () => clearInterval(interval);
  }, [demoAccount?.openPositions?.length]);

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
    if (type === 'BUY') pnl = (current - entry) * qty;
    else if (type === 'SELL') pnl = (entry - current) * qty;
    const invested = entry * qty;
    const pnlPercentage = invested !== 0 ? (pnl / invested) * 100 : 0;
    return {
      ...pos,
      id: pos.id || pos._id,
      type,
      market: pos.market || 'crypto',
      currentPrice: current,
      pnl,
      pnlPercentage,
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
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPosition(null);
  };
  const handleSavePosition = async () => {
    try {
      const payload = {
        ...newPosition,
        quantity: Number(newPosition.quantity),
        entryPrice: Number(newPosition.entryPrice),
        currentPrice: Number(newPosition.entryPrice),
        type: newPosition.type,
        market: newPosition.market,
        symbol: newPosition.symbol,
      };
      if (!selectedPosition) {
        const res = await axios.post(`/api/demo-account/${userId}/positions`, payload);
        setDemoAccount(res.data);
        setAccountSuccess('Position added successfully!');
      } else {
        // Optionally handle edit/update here
      }
      handleCloseDialog();
    } catch {
      setAccountError('Failed to save position.');
    }
  };
  const handleClosePosition = async (positionId: string) => {
    try {
      await axios.patch(`/api/demo-account/${userId}/positions/${positionId}/close`);
      const res = await axios.get(`/api/demo-account/${userId}`);
      setDemoAccount(res.data);
      setAccountSuccess('Position closed successfully!');
    } catch {
      setAccountError('Failed to close position.');
    }
  };
  const handleCloseAllPositions = async () => {
    try {
      await axios.patch(`/api/demo-account/${userId}/positions/close-all`);
      const res = await axios.get(`/api/demo-account/${userId}`);
      setDemoAccount(res.data);
      setAccountSuccess('All positions closed successfully!');
    } catch {
      setAccountError('Failed to close all positions.');
    }
  };

  // Stats
  const openPositions = gridOpenPositionsWithPnL;
  interface Position {
    id?: string;
    _id?: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    currentPrice?: number;
    market: 'crypto' | 'forex' | 'stocks' | 'commodities';
    pnl?: number;
    pnlPercentage?: number;
    direction?: 'BUY' | 'SELL';
    [key: string]: any;
  }

  interface DemoAccount {
    balance: number;
    openPositions: Position[];
    tradeHistory: Position[];
    [key: string]: any;
  }

  const totalValue = openPositions.reduce(
    (sum: number, pos: Position) => sum + (pos.quantity * (pos.currentPrice || pos.entryPrice)),
    0
  );
  const totalInvested = openPositions.reduce((sum: number, pos: Position) => sum + (pos.quantity * pos.entryPrice), 0);
  const totalPnL = openPositions.reduce((sum: number, pos: Position) => sum + (pos.pnl ?? 0), 0);
  const totalReturn = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const totalClosed = closedPositions.length;
  const totalWins = closedPositions.filter((pos: any) => (pos.pnl ?? pos.profit ?? 0) > 0).length;
  const successRate = totalClosed > 0 ? (totalWins / totalClosed) * 100 : 0;

  // Stats Card Component
  const StatCard: React.FC<{
    title: string;
    value: string;
    change?: string;
    changeType?: 'positive' | 'negative';
    icon: React.ReactNode;
  }> = ({ title, value, change, changeType, icon }) => (
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
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              {value}
            </Typography>
            {change && (
              <Box display="flex" alignItems="center" mt={1}>
                {changeType === 'positive' ? (
                  <TrendingUp sx={{ color: theme.palette.success.main, fontSize: 16, mr: 0.5 }} />
                ) : (
                  <TrendingDown sx={{ color: theme.palette.error.main, fontSize: 16, mr: 0.5 }} />
                )}
                <Typography variant="caption" sx={{ color: changeType === 'positive' ? theme.palette.success.main : theme.palette.error.main }}>
                  {change}
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: theme.palette.primary.main, opacity: 0.7 }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Open Positions DataGrid columns
  const openColumns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      flex: 1,
      minWidth: 120,
      renderCell: (params: any) => (
        <Box display="flex" alignItems="center">
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            {params.value ?? ''}
          </Typography>
          <Chip
            label={params.row?.market ? params.row.market.toUpperCase() : 'N/A'}
            size="small"
            variant="outlined"
            sx={{ ml: 1, fontSize: '0.7rem' }}
          />
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      flex: 0.8,
      minWidth: 100,
      renderCell: (params: any) => (
        <Chip label={params.value} color={params.value === 'BUY' ? 'success' : 'error'} size="small" />
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      flex: 1,
      minWidth: 100,
      type: 'number' as const,
      valueFormatter: (params: any) => params.value?.toLocaleString(),
    },
    {
      field: 'entryPrice',
      headerName: 'Entry Price',
      flex: 1,
      minWidth: 120,
      renderCell: (params: any) => (
        <span>
          {params.value !== undefined && params.value !== null && !isNaN(Number(params.value))
            ? Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
            : ''}
        </span>
      ),
    },
    {
      field: 'currentPrice',
      headerName: 'Current Price',
      flex: 1,
      minWidth: 120,
      renderCell: (params: any) => (
        <span>
          {params.value !== undefined && params.value !== null && !isNaN(Number(params.value))
            ? Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
            : ''}
        </span>
      ),
    },
    {
      field: 'pnl',
      headerName: 'P&L',
      flex: 1,
      minWidth: 120,
      type: 'number' as const,
      valueFormatter: (params: any) =>
        params?.value !== undefined && params?.value !== null
          ? `$${Number(params.value).toFixed(2)}`
          : '$0.00',
      cellClassName: (params: any) => (params.value >= 0 ? 'positiveCell' : 'negativeCell'),
    },
    {
      field: 'pnlPercentage',
      headerName: 'P&L %',
      flex: 1,
      minWidth: 150,
      renderCell: (params: any) => (
        <Box display="flex" alignItems="center" gap={1}>
          <LinearProgress
            variant="determinate"
            value={Math.min(Math.abs(params.value ?? 0), 100)}
            sx={{
              width: 60,
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: params.value >= 0 ? theme.palette.success.main : theme.palette.error.main,
                borderRadius: 3,
              },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              color: params.value >= 0 ? theme.palette.success.main : theme.palette.error.main,
              fontWeight: 'bold',
              minWidth: '50px',
            }}
          >
            {params.value !== undefined && params.value !== null
              ? Number(params.value).toFixed(2)
              : '0.00'}%
          </Typography>
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 0.8,
      minWidth: 140,
      sortable: false,
      filterable: false,
      renderCell: (params: any) => (
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => handleEditPosition(params.row)} sx={{ color: theme.palette.primary.main }}>
            <Edit fontSize="small" />
          </IconButton>
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={() => handleClosePosition(params.row.id)}
          >
            Close
          </Button>
        </Box>
      ),
    },
  ];

  // Closed Positions DataGrid columns
  const closedColumns: GridColDef[] = [
    {
      field: 'symbol',
      headerName: 'Symbol',
      flex: 1,
      minWidth: 120,
      renderCell: (params: any) => (
        <Box display="flex" alignItems="center">
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            {params.value}
          </Typography>
          <Chip label={params.row.market?.toUpperCase() || ''} size="small" variant="outlined" sx={{ ml: 1, fontSize: '0.7rem' }} />
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      flex: 0.8,
      minWidth: 100,
      renderCell: (params: any) => (
        <Chip label={params.value} color={params.value === 'BUY' ? 'success' : 'error'} size="small" />
      ),
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      flex: 1,
      minWidth: 100,
      type: 'number' as const,
      valueFormatter: (params: any) => params.value?.toLocaleString(),
    },
    {
      field: 'entryPrice',
      headerName: 'Entry Price',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params: any) =>
        params.row.market === 'forex' ? Number(params.value).toFixed(4) : Number(params.value).toFixed(2),
    },
    {
      field: 'currentPrice',
      headerName: 'Exit Price',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params: any) =>
        params.row.market === 'forex' ? Number(params.value).toFixed(4) : Number(params.value).toFixed(2),
    },
    {
      field: 'pnl',
      headerName: 'P&L',
      flex: 1,
      minWidth: 140,
      type: 'number' as const,
      valueFormatter: (params: any) => `$${Number(params.value).toFixed(2)} (${Number(params.row.pnlPercentage).toFixed(2)}%)`,
      cellClassName: (params: any) => (params.value >= 0 ? 'positiveCell' : 'negativeCell'),
    },
    {
      field: 'openDate',
      headerName: 'Date',
      flex: 1,
      minWidth: 140,
      valueFormatter: (params: any) => new Date(params.value).toLocaleDateString(),
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Portfolio
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Track and manage your trading positions
        </Typography>
      </Box>

      {/* Demo Balance & Create/Reset Button */}
      <Box mb={2} display="flex" alignItems="center" gap={2}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
          Demo Balance: ${demoAccount ? Number(demoAccount.balance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '...'}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={demoAccount ? <RestartAltIcon /> : <Add />}
          onClick={async () => {
            setAccountActionLoading(true);
            try {
              if (!demoAccount) {
                const res = await axios.post(`/api/demo-account/${userId}`);
                setDemoAccount(res.data);
                setAccountSuccess('Demo account created successfully!');
              } else {
                const res = await axios.patch(`/api/demo-account/${userId}/reset`, { balance: ORIGINAL_BALANCE });
                setDemoAccount(res.data);
                setAccountSuccess('Demo account reset successfully!');
              }
            } catch {
              setAccountError('Failed to create/reset demo account.');
            }
            setAccountActionLoading(false);
          }}
          disabled={accountActionLoading}
          sx={{
            background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
            '&:hover': {
              background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.primary.dark || theme.palette.primary.main} 90%)`,
            },
            minWidth: 180,
          }}
        >
          {accountActionLoading
            ? 'Processing...'
            : demoAccount
              ? 'Reset Demo Account'
              : 'Create Demo Account'}
        </Button>
      </Box>

      {/* Portfolio Statistics */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Value"
            value={`$${Number(totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            icon={<AccountBalance sx={{ fontSize: 40 }} />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total P&L"
            value={`$${Number(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            change={`${totalReturn.toFixed(2)}%`}
            changeType={totalPnL >= 0 ? 'positive' : 'negative'}
            icon={<ShowChart sx={{ fontSize: 40 }} />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Open Positions"
            value={openPositions.length.toString()}
            icon={<Assessment sx={{ fontSize: 40 }} />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Success Rate"
            value={`${successRate.toFixed(2)}%`}
            icon={<TrendingUp sx={{ fontSize: 40 }} />}
          />
        </Grid>
      </Grid>

      {/* Open Positions DataGrid */}
      <Paper
        sx={{
          mb: 4,
          background: theme.palette.background.paper,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${theme.palette.divider}`,
          height: 400,
        }}
      >
        <Box p={3} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
            Open Positions
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddPosition}
              sx={{
                background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                '&:hover': {
                  background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.primary.dark || theme.palette.primary.main} 90%)`,
                },
              }}
            >
              Add Position
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleCloseAllPositions}
              disabled={openPositions.length === 0}
            >
              Close All Positions
            </Button>
          </Box>
        </Box>
        <Box sx={{ height: 'calc(100% - 84px)' }}>
          <DataGrid
            rows={gridOpenPositionsWithPnL}
            columns={openColumns}
            getRowId={(row: any) => row.id}
            loading={loading}
            slots={{
              toolbar: GridToolbar,
            }}
            sx={{
              '& .positiveCell': { color: theme.palette.success.main, fontWeight: 'bold' },
              '& .negativeCell': { color: theme.palette.error.main, fontWeight: 'bold' },
            }}
            pagination
            initialState={{
              pagination: {
                paginationModel: { pageSize: 5 },
              }
            }}
            pageSizeOptions={[5, 10, 20]}
          />
        </Box>
      </Paper>

      {/* Trading History DataGrid */}
      {closedPositions.length > 0 && (
        <Paper
          sx={{
            mb: 4,
            background: theme.palette.background.paper,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${theme.palette.divider}`,
            height: 400,
          }}
        >
          <Box p={3}>
            <Typography variant="h5" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
              Trading History
            </Typography>
          </Box>
          <Box sx={{ height: 'calc(100% - 72px)' }}>
            <DataGrid
              rows={gridClosedPositions}
              columns={closedColumns}
              getRowId={(row: any) => row.id}
              loading={loading}
              slots={{
                toolbar: GridToolbar,
              }}
              sx={{
                '& .positiveCell': { color: theme.palette.success.main, fontWeight: 'bold' },
                '& .negativeCell': { color: theme.palette.error.main, fontWeight: 'bold' },
              }}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 5 },
                }
              }}
              pageSizeOptions={[5, 10, 20]}
            />
          </Box>
        </Paper>
      )}

      {/* Position Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: theme.palette.background.paper,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.primary.main }}>
          {selectedPosition ? 'Edit Position' : 'Add New Position'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Symbol"
                value={newPosition.symbol}
                onChange={(e) => setNewPosition((prev) => ({ ...prev, symbol: e.target.value }))}
                placeholder="e.g., BTCUSDT, EURUSD, AAPL"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Market</InputLabel>
                <Select
                  value={newPosition.market}
                  label="Market"
                  onChange={(e) => setNewPosition((prev) => ({ ...prev, market: e.target.value }))}
                >
                  <MenuItem value="crypto">Crypto</MenuItem>
                  <MenuItem value="forex">Forex</MenuItem>
                  <MenuItem value="stocks">Stocks</MenuItem>
                  <MenuItem value="commodities">Commodities</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newPosition.type}
                  label="Type"
                  onChange={(e) =>
                    setNewPosition((prev) => ({
                      ...prev,
                      type: e.target.value as 'BUY' | 'SELL',
                    }))
                  }
                >
                  <MenuItem value="BUY">Buy</MenuItem>
                  <MenuItem value="SELL">Sell</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={newPosition.quantity}
                onChange={(e) => setNewPosition((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Entry Price"
                type="number"
                value={newPosition.entryPrice}
                onChange={(e) => setNewPosition((prev) => ({ ...prev, entryPrice: e.target.value }))}
                inputProps={{ step: '0.0001' }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} sx={{ color: theme.palette.text.secondary }}>
            Cancel
          </Button>
          <Button
            onClick={handleSavePosition}
            variant="contained"
            sx={{
              background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
              '&:hover': {
                background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.primary.dark || theme.palette.primary.main} 90%)`,
              },
            }}
          >
            {selectedPosition ? 'Update' : 'Add'} Position
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!accountSuccess}
        autoHideDuration={3000}
        onClose={() => setAccountSuccess('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setAccountSuccess('')}>
          {accountSuccess}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!accountError}
        autoHideDuration={4000}
        onClose={() => setAccountError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setAccountError('')}>
          {accountError}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Portfolio;