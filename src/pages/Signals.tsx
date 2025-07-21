import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  FilterList,
  Refresh,
  Info,
  Star,
  StarBorder,
  ViewList,
  ViewModule,
  Psychology,
  Speed,
  Analytics,
  AutoAwesome,
} from '@mui/icons-material';
import { Grid } from '@mui/system';
import { useTheme as useMuiTheme, alpha } from '@mui/material/styles';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchSignals, executeSignal } from '../store/slices/signalSlice';
import { openDemoPosition } from '../store/slices/portfolioSlice';
import useWebSocket from '../hooks/useWebSocket';
import SignalCard from '../components/signals/SignalCard';
import { TradingSignal } from '../types';
import axios from 'axios';

const Signals: React.FC = () => {
  const theme = useMuiTheme();
  const dispatch = useAppDispatch();
  const { signals, loading, error } = useAppSelector((state: any) => state.signals);
  const { user } = useAppSelector((state: any) => state.auth);
  const { isConnected: wsConnected } = useWebSocket();

  const userId = useAppSelector((state: any) => state.auth.user?._id || state.auth.user?.id);

  const [filters, setFilters] = useState({
    market: 'all',
    type: 'all',
    confidence: 'all',
    timeframe: 'all',
    source: 'all',
    risk: 'all',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [favoriteSignals, setFavoriteSignals] = useState<string[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<TradingSignal | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [positionLoading, setPositionLoading] = useState(false);
  const [positionSuccess, setPositionSuccess] = useState(false);
  const [positionError, setPositionError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'confidence' | 'time' | 'symbol' | 'source'>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [signalStats, setSignalStats] = useState({
    totalSignals: 0,
    highConfidence: 0,
    buySignals: 0,
    sellSignals: 0,
    avgConfidence: 0,
    enterpriseMLSignals: 0,
  });

  // WebSocket connection for real-time signals
  const { isConnected } = useWebSocket();

  useEffect(() => {
    // Initial fetch
    dispatch(fetchSignals());
    setLastRefresh(new Date());

    // Auto-refresh every 5 minutes if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        console.log('🔄 Auto-refreshing signals...');
        dispatch(fetchSignals());
        setLastRefresh(new Date());
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [dispatch, autoRefresh]);

  useEffect(() => {
    const recentSignals = signals.filter(isSignalRecent);
    const stats = {
      totalSignals: recentSignals.length,
      highConfidence: recentSignals.filter((s: TradingSignal) => s.confidence >= 80).length,
      buySignals: recentSignals.filter((s: TradingSignal) => s.type.toLowerCase() === 'buy').length,
      sellSignals: recentSignals.filter((s: TradingSignal) => s.type.toLowerCase() === 'sell').length,
      avgConfidence: recentSignals.length > 0 
        ? Math.round(recentSignals.reduce((sum: number, s: TradingSignal) => sum + s.confidence, 0) / recentSignals.length)
        : 0,
      enterpriseMLSignals: recentSignals.filter((s: TradingSignal) => s.source === 'enterprise_ml').length,
    };
    setSignalStats(stats);
  }, [signals]);

  const isSignalRecent = (signal: TradingSignal) => {
    const signalDate = new Date(signal.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60);
    
    // Only show signals from last 24 hours
    return hoursDiff <= 24;
  };

  // Filtered signals based on search and filter criteria
  const filteredSignals = signals
    .filter(isSignalRecent)
    .filter((signal: TradingSignal) => {
      const matchesSearch = signal.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           signal.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMarket = filters.market === 'all' || signal.market === filters.market;
      const matchesType = filters.type === 'all' || signal.type.toLowerCase() === filters.type;
      const matchesConfidence =
        filters.confidence === 'all' ||
        (filters.confidence === 'high' && signal.confidence >= 80) ||
        (filters.confidence === 'medium' && signal.confidence >= 60 && signal.confidence < 80) ||
        (filters.confidence === 'low' && signal.confidence < 60);
      const matchesTimeframe = filters.timeframe === 'all' || signal.timeframe === filters.timeframe;
      const matchesSource = filters.source === 'all' || signal.source === filters.source;
      const matchesRisk = filters.risk === 'all' || signal.risk === filters.risk;
      
      return matchesSearch && matchesMarket && matchesType && matchesConfidence && 
             matchesTimeframe && matchesSource && matchesRisk;
    });

  const sortedAndFilteredSignals = filteredSignals
    .filter((signal: TradingSignal) => showFavoritesOnly ? favoriteSignals.includes(signal.id) : true)
    .sort((a: TradingSignal, b: TradingSignal) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        case 'time':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'source':
          aValue = a.source;
          bValue = b.source;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const toggleFavorite = (signalId: string) => {
    setFavoriteSignals(prev =>
      prev.includes(signalId)
        ? prev.filter(id => id !== signalId)
        : [...prev, signalId]
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return theme.palette.success.main;
    if (confidence >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Enhanced signal execution with enterprise ML support
  const handleSignalClick = (signal: TradingSignal) => {
    setSelectedSignal(signal);
    setOpenDialog(true);
    setPositionSuccess(false);
    setPositionError('');
    setQuantity(signal.positionSize || 1);
  };

  const handleOpenDemoPosition = async () => {
    if (!user || !selectedSignal) return;
    if (!quantity || quantity <= 0) {
      setPositionError('Quantity must be at least 1');
      return;
    }
    if (!userId) {
      setPositionError('User not found. Please log in again.');
      return;
    }
    
    setPositionLoading(true);
    setPositionError('');
    
    try {
      // Use the new openDemoPosition action
      await dispatch(openDemoPosition({ 
        userId, 
        signal: { ...selectedSignal, positionSize: quantity } 
      })).unwrap();
      
      setPositionSuccess(true);
      setTimeout(() => {
        setOpenDialog(false);
        setPositionSuccess(false);
      }, 1500);
    } catch (err: any) {
      setPositionError(err.message || 'Failed to open demo position. Please try again.');
    }
    
    setPositionLoading(false);
  };

  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered...');
    dispatch(fetchSignals());
    setLastRefresh(new Date());
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'enterprise_ml':
        return <AutoAwesome fontSize="small" />;
      case 'ai':
        return <Psychology fontSize="small" />;
      case 'manual':
        return <Info fontSize="small" />;
      default:
        return <Info fontSize="small" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'enterprise_ml':
        return theme.palette.primary.main;
      case 'ai':
        return theme.palette.secondary.main;
      case 'manual':
        return theme.palette.info.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Trading Signals
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Chip 
            label={`${signalStats.totalSignals} Signals`} 
            color="primary" 
            variant="outlined" 
          />
          <Chip 
            label={`${signalStats.highConfidence} High Confidence`} 
            color="success" 
            variant="outlined" 
          />
          <Chip 
            label={`${signalStats.enterpriseMLSignals} Enterprise ML`} 
            color="primary" 
            variant="outlined" 
            icon={<AutoAwesome />}
          />
          <Chip 
            label={`WebSocket: ${isConnected ? 'Connected' : 'Disconnected'}`} 
            color={isConnected ? 'success' : 'error'} 
            variant="outlined" 
          />
        </Box>
      </Box>

      {/* Filters and Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Search signals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Market</InputLabel>
              <Select
                value={filters.market}
                onChange={(e) => handleFilterChange('market', e.target.value)}
                label="Market"
              >
                <MenuItem value="all">All Markets</MenuItem>
                <MenuItem value="crypto">Crypto</MenuItem>
                <MenuItem value="forex">Forex</MenuItem>
                <MenuItem value="stocks">Stocks</MenuItem>
                <MenuItem value="commodities">Commodities</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="buy">Buy</MenuItem>
                <MenuItem value="sell">Sell</MenuItem>
                <MenuItem value="hold">Hold</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Confidence</InputLabel>
              <Select
                value={filters.confidence}
                onChange={(e) => handleFilterChange('confidence', e.target.value)}
                label="Confidence"
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="high">High (80%+)</MenuItem>
                <MenuItem value="medium">Medium (60-79%)</MenuItem>
                <MenuItem value="low">Low ({'<'}60%)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Source</InputLabel>
              <Select
                value={filters.source}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                label="Source"
              >
                <MenuItem value="all">All Sources</MenuItem>
                <MenuItem value="enterprise_ml">Enterprise ML</MenuItem>
                <MenuItem value="ai">AI</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Risk</InputLabel>
              <Select
                value={filters.risk}
                onChange={(e) => handleFilterChange('risk', e.target.value)}
                label="Risk"
              >
                <MenuItem value="all">All Risks</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Timeframe</InputLabel>
              <Select
                value={filters.timeframe}
                onChange={(e) => handleFilterChange('timeframe', e.target.value)}
                label="Timeframe"
              >
                <MenuItem value="all">All Timeframes</MenuItem>
                <MenuItem value="1M">1 Minute</MenuItem>
                <MenuItem value="5M">5 Minutes</MenuItem>
                <MenuItem value="15M">15 Minutes</MenuItem>
                <MenuItem value="1H">1 Hour</MenuItem>
                <MenuItem value="4H">4 Hours</MenuItem>
                <MenuItem value="1D">1 Day</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* View Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="cards">
              <ViewModule />
            </ToggleButton>
            <ToggleButton value="table">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              label="Sort By"
            >
              <MenuItem value="confidence">Confidence</MenuItem>
              <MenuItem value="time">Time</MenuItem>
              <MenuItem value="symbol">Symbol</MenuItem>
              <MenuItem value="source">Source</MenuItem>
            </Select>
          </FormControl>
          
          <IconButton onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
            {sortOrder === 'asc' ? '↑' : '↓'}
          </IconButton>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<StarBorder />}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            color={showFavoritesOnly ? 'primary' : 'inherit'}
          >
            Favorites
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleManualRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Loading State */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Signals Display */}
      {viewMode === 'cards' ? (
        <Grid container spacing={2}>
          {sortedAndFilteredSignals.map((signal: TradingSignal) => (
            <Grid
  display="grid"
  gridTemplateColumns={{
    xs: 'repeat(1, 1fr)',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(3, 1fr)',
    lg: 'repeat(4, 1fr)',
  }}
  gap={2}
>
  {sortedAndFilteredSignals.map((signal: TradingSignal) => (
    <Grid key={signal.id}>
      <SignalCard
        signal={signal}
        onExecute={handleSignalClick}
        onFavorite={toggleFavorite}
        isFavorite={favoriteSignals.includes(signal.id)}
        showDetails={false}
      />
    </Grid>
  ))}
</Grid>

          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Market</TableCell>
                <TableCell>Entry Price</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>Stop Loss</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAndFilteredSignals.map((signal: TradingSignal) => (
                <TableRow key={signal.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {signal.symbol}
                      </Typography>
                      {signal.source === 'enterprise_ml' && (
                        <Chip
                          label="ML"
                          size="small"
                          color="primary"
                          icon={<AutoAwesome />}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={signal.type}
                      size="small"
                      color={signal.type === 'BUY' ? 'success' : 'error'}
                      icon={signal.type === 'BUY' ? <TrendingUp /> : <TrendingDown />}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {signal.confidence}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={signal.confidence}
                        sx={{ width: 40, height: 4 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={signal.source.replace('_', ' ')}
                      size="small"
                      icon={getSourceIcon(signal.source)}
                      sx={{ bgcolor: getSourceColor(signal.source), color: 'white' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={signal.market} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>${signal.entryPrice?.toFixed(2)}</TableCell>
                  <TableCell>${signal.targetPrice?.toFixed(2)}</TableCell>
                  <TableCell>${signal.stopLoss?.toFixed(2)}</TableCell>
                  <TableCell>{getTimeAgo(signal.createdAt)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => toggleFavorite(signal.id)}
                      >
                        {favoriteSignals.includes(signal.id) ? <Star color="warning" /> : <StarBorder />}
                      </IconButton>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSignalClick(signal)}
                        disabled={signal.status !== 'active'}
                      >
                        Execute
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* No Signals Message */}
      {sortedAndFilteredSignals.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No signals found matching your criteria
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your filters or check back later for new signals
          </Typography>
        </Box>
      )}

      {/* Execute Signal Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Execute Signal: {selectedSignal?.symbol}
          {selectedSignal?.source === 'enterprise_ml' && (
            <Chip
              label="Enterprise ML"
              size="small"
              color="primary"
              icon={<AutoAwesome />}
              sx={{ ml: 1 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {selectedSignal && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Type</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {selectedSignal.type}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Confidence</Typography>
                  <Typography variant="body1" fontWeight="bold" color={getConfidenceColor(selectedSignal.confidence)}>
                    {selectedSignal.confidence}%
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Entry Price</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    ${selectedSignal.entryPrice?.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Target Price</Typography>
                  <Typography variant="body1" fontWeight="bold" color="success.main">
                    ${selectedSignal.targetPrice?.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Stop Loss</Typography>
                  <Typography variant="body1" fontWeight="bold" color="error.main">
                    ${selectedSignal.stopLoss?.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Risk Level</Typography>
                  <Chip
                    label={selectedSignal.risk}
                    size="small"
                    color={selectedSignal.risk === 'high' ? 'error' : selectedSignal.risk === 'medium' ? 'warning' : 'success'}
                  />
                </Grid>
              </Grid>
              
              <TextField
                fullWidth
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                sx={{ mt: 2 }}
                inputProps={{ min: 1 }}
              />
              
              {selectedSignal.description && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Description</Typography>
                  <Typography variant="body2">{selectedSignal.description}</Typography>
                </Box>
              )}
              
              {selectedSignal.reasoning && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Reasoning</Typography>
                  <Typography variant="body2">{selectedSignal.reasoning}</Typography>
                </Box>
              )}
              
              {positionError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {positionError}
                </Alert>
              )}
              
              {positionSuccess && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Demo position opened successfully!
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleOpenDemoPosition}
            variant="contained"
            disabled={positionLoading || !selectedSignal || selectedSignal.status !== 'active'}
          >
            {positionLoading ? 'Opening...' : 'Open Demo Position'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Signals;