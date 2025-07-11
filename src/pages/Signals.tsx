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
  Grid,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  FilterList,
  Refresh,
  Info,
  Star,
  StarBorder,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchSignals } from '../store/slices/signalSlice';
import axios from 'axios';

const Signals: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { signals, loading, error } = useAppSelector((state: any) => state.signals);
  const { user } = useAppSelector((state: any) => state.auth);

  const userId = useAppSelector((state: any) => state.auth.user?._id || state.auth.user?.id);

  const [filters, setFilters] = useState({
    market: 'all',
    type: 'all',
    confidence: 'all',
    timeframe: 'all',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [favoriteSignals, setFavoriteSignals] = useState<string[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<any | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [positionLoading, setPositionLoading] = useState(false);
  const [positionSuccess, setPositionSuccess] = useState(false);
  const [positionError, setPositionError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'confidence' | 'time' | 'symbol'>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [signalStats, setSignalStats] = useState({
    totalSignals: 0,
    highConfidence: 0,
    buySignals: 0,
    sellSignals: 0,
    avgConfidence: 0,
  });

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
      highConfidence: recentSignals.filter((s: any) => s.confidence >= 80).length,
      buySignals: recentSignals.filter((s: any) => s.type.toLowerCase() === 'buy').length,
      sellSignals: recentSignals.filter((s: any) => s.type.toLowerCase() === 'sell').length,
      avgConfidence: recentSignals.length > 0 
        ? Math.round(recentSignals.reduce((sum: number, s: any) => sum + s.confidence, 0) / recentSignals.length)
        : 0,
    };
    setSignalStats(stats);
  }, [signals]);

  const isSignalRecent = (signal: any) => {
    const signalDate = new Date(signal.timestamp || signal.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60);
    
    // Only show signals from last 24 hours
    return hoursDiff <= 24;
  };

  // Filtered signals based on search and filter criteria.
  const filteredSignals = signals
    .filter(isSignalRecent)
    .filter((signal: any) => {
      const matchesSearch = signal.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMarket = filters.market === 'all' || signal.market === filters.market;
      const matchesType = filters.type === 'all' || signal.type.toLowerCase() === filters.type;
      const matchesConfidence =
        filters.confidence === 'all' ||
        (filters.confidence === 'high' && signal.confidence >= 80) ||
        (filters.confidence === 'medium' && signal.confidence >= 60 && signal.confidence < 80) ||
        (filters.confidence === 'low' && signal.confidence < 60);
      const matchesTimeframe = filters.timeframe === 'all' || signal.timeframe === filters.timeframe;
      return matchesSearch && matchesMarket && matchesType && matchesConfidence && matchesTimeframe;
    });

  const sortedAndFilteredSignals = filteredSignals
    .filter((signal: any) => showFavoritesOnly ? favoriteSignals.includes(signal.id) : true)
    .sort((a: any, b: any) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        case 'time':
          aValue = new Date(a.timestamp || a.createdAt).getTime();
          bValue = new Date(b.timestamp || b.createdAt).getTime();
          break;
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
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

  // --- Demo Position Dialog Logic ---
  const handleSignalClick = (signal: any) => {
    setSelectedSignal(signal);
    setOpenDialog(true);
    setPositionSuccess(false);
    setPositionError('');
    setQuantity(1);
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
      await axios.post(`/api/demo-account/${userId}/positions`, {
        symbol: selectedSignal.symbol,
        direction: selectedSignal.type.toUpperCase(), // 'BUY' or 'SELL'
        quantity,
        entryPrice: selectedSignal.entryPrice,
        targetPrice: selectedSignal.targetPrice,
        stopLoss: selectedSignal.stopLoss,
        signalId: selectedSignal.id,
        market: selectedSignal.market,
        timeframe: selectedSignal.timeframe,
      });
      setPositionSuccess(true);
      setTimeout(() => {
        setOpenDialog(false);
        setPositionSuccess(false);
      }, 1500);
      // Optionally: trigger a refresh in Portfolio via context or event
    } catch (err: any) {
      setPositionError('Failed to open demo position. Please try again.');
    }
    setPositionLoading(false);
  };

  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered...');
    dispatch(fetchSignals());
    setLastRefresh(new Date());
  };

  // --- Theme-aware colors ---
  const accent = theme.palette.primary.main;
  const paperBg = theme.palette.background.paper;
  const cardBg = theme.palette.mode === 'dark'
    ? 'rgba(255,255,255,0.05)'
    : theme.palette.background.default;
  const dividerColor = theme.palette.divider;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Enhanced Header with Statistics */}
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Trading Signals
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          AI-powered trading signals across multiple markets
        </Typography>
        
        {/* Signal Statistics Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.primary.main}10)`,
              border: `1px solid ${theme.palette.primary.main}30`,
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                  {signalStats.totalSignals}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Signals
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${theme.palette.success.main}20, ${theme.palette.success.main}10)`,
              border: `1px solid ${theme.palette.success.main}30`,
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                  {signalStats.highConfidence}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  High Confidence
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${theme.palette.info.main}20, ${theme.palette.info.main}10)`,
              border: `1px solid ${theme.palette.info.main}30`,
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                  {signalStats.buySignals}/{signalStats.sellSignals}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Buy/Sell Ratio
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${theme.palette.warning.main}20, ${theme.palette.warning.main}10)`,
              border: `1px solid ${theme.palette.warning.main}30`,
            }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                  {signalStats.avgConfidence}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Confidence
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box display="flex" alignItems="center" gap={2} mt={2}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Showing signals from last 24 hours
          </Typography>
          <Typography variant="body2" color={autoRefresh ? 'success.main' : 'text.secondary'}>
            • Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Typography>
        </Box>
      </Box>

      {/* Enhanced Filters with View Controls */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: paperBg,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${dividerColor}`,
        }}
      >
        <Box display="flex" alignItems="center" mb={2}>
          <FilterList sx={{ mr: 1, color: accent }} />
          <Typography variant="h6" sx={{ color: accent }}>
            Filters & Controls
          </Typography>

          <Box ml="auto" display="flex" gap={1}>
            {/* View Mode Toggle */}
            <Button
              variant={viewMode === 'cards' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('cards')}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Cards
            </Button>
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('table')}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Table
            </Button>
            
            {/* Favorites Toggle */}
            <Button
              variant={showFavoritesOnly ? 'contained' : 'outlined'}
              size="small"
              startIcon={<Star />}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              sx={{ 
                color: showFavoritesOnly ? 'white' : theme.palette.warning.main,
                borderColor: theme.palette.warning.main,
                backgroundColor: showFavoritesOnly ? theme.palette.warning.main : 'transparent'
              }}
            >
              Favorites {favoriteSignals.length > 0 && `(${favoriteSignals.length})`}
            </Button>
            
            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setAutoRefresh(!autoRefresh)}
              sx={{ 
                color: autoRefresh ? 'white' : accent,
                backgroundColor: autoRefresh ? accent : 'transparent'
              }}
            >
              Auto-Refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button
              startIcon={<Refresh />}
              onClick={handleManualRefresh}
              sx={{ color: accent }}
            >
              Refresh Now
            </Button>
          </Box>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              label="Search Symbol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Grid>
          
          {/* Sort Controls */}
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <MenuItem value="confidence">Confidence</MenuItem>
                <MenuItem value="time">Time</MenuItem>
                <MenuItem value="symbol">Symbol</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, md: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              sx={{ height: '40px' }}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Market</InputLabel>
              <Select
                value={filters.market}
                label="Market"
                onChange={(e) => handleFilterChange('market', e.target.value)}
              >
                <MenuItem value="all">All Markets</MenuItem>
                <MenuItem value="forex">Forex</MenuItem>
                <MenuItem value="stocks">Stocks</MenuItem>
                <MenuItem value="crypto">Crypto</MenuItem>
                <MenuItem value="commodities">Commodities</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Signal Type</InputLabel>
              <Select
                value={filters.type}
                label="Signal Type"
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="buy">Buy</MenuItem>
                <MenuItem value="sell">Sell</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Confidence</InputLabel>
              <Select
                value={filters.confidence}
                label="Confidence"
                onChange={(e) => handleFilterChange('confidence', e.target.value)}
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="high">High (80%+)</MenuItem>
                <MenuItem value="medium">Medium (60-79%)</MenuItem>
                <MenuItem value="low">Low ({'<'}60%)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Timeframe</InputLabel>
              <Select
                value={filters.timeframe}
                label="Timeframe"
                onChange={(e) => handleFilterChange('timeframe', e.target.value)}
              >
                <MenuItem value="all">All Timeframes</MenuItem>
                <MenuItem value="15M">15 Minutes</MenuItem>
                <MenuItem value="1H">1 Hour</MenuItem>
                <MenuItem value="4H">4 Hours</MenuItem>
                <MenuItem value="1D">1 Day</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body1" color="text.secondary">
          Showing {sortedAndFilteredSignals.length} signals 
          {showFavoritesOnly && ' (favorites only)'}
          {signals.length > sortedAndFilteredSignals.length && (
            <span> (filtered from {signals.length} total)</span>
          )}
        </Typography>
        
        {sortedAndFilteredSignals.length > 0 && (
          <Chip 
            label={`Sorted by ${sortBy} (${sortOrder === 'desc' ? 'high to low' : 'low to high'})`}
            size="small"
            variant="outlined"
            sx={{ color: accent, borderColor: accent }}
          />
        )}
      </Box>

      {/* Desktop Table View */}
      <Paper
        sx={{
          display: { xs: 'none', md: viewMode === 'table' ? 'block' : 'none' },
          background: paperBg,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${dividerColor}`,
          mb: 4,
        }}
      >
        <Box p={3}>
          <Typography variant="h5" sx={{ color: accent, fontWeight: 'bold' }}>
            Signals List
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Symbol</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Confidence</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Entry Price</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Target</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Stop Loss</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Timeframe</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Time</TableCell>
                <TableCell sx={{ color: accent, fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAndFilteredSignals.map((signal: any) => (
                <TableRow
                  key={signal.id}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: theme.palette.action.hover },
                  }}
                  onClick={() => handleSignalClick(signal)}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {signal.symbol}
                      </Typography>
                      <Chip label={signal.market?.toUpperCase()} size="small" variant="outlined" sx={{ ml: 1, fontSize: '0.7rem' }} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {signal.type.toUpperCase() === 'BUY' ? (
                        <TrendingUp sx={{ color: theme.palette.success.main, mr: 1 }} />
                      ) : (
                        <TrendingDown sx={{ color: theme.palette.error.main, mr: 1 }} />
                      )}
                      <Chip label={signal.type} color={signal.type.toUpperCase() === 'BUY' ? 'success' : 'error'} size="small" />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={signal.confidence}
                        sx={{
                          width: 60,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.palette.action.disabledBackground,
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getConfidenceColor(signal.confidence),
                            borderRadius: 3,
                          }
                        }}
                      />
                      <Typography variant="body2" sx={{ color: getConfidenceColor(signal.confidence), fontWeight: 'bold', minWidth: '35px' }}>
                        {signal.confidence}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{signal.entryPrice}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>{signal.targetPrice}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>{signal.stopLoss}</TableCell>
                  <TableCell>
                    <Chip label={signal.timeframe} variant="outlined" size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {getTimeAgo(signal.timestamp || signal.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="Add to favorites">
                        <IconButton
                          size="small"
                          onClick={e => {
                            e.stopPropagation();
                            toggleFavorite(signal.id);
                          }}
                          sx={{ color: favoriteSignals.includes(signal.id) ? theme.palette.warning.main : 'inherit' }}
                        >
                          {favoriteSignals.includes(signal.id) ? <Star /> : <StarBorder />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Signal details">
                        <IconButton size="small" sx={{ color: accent }}>
                          <Info />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Enhanced Desktop Cards View */}
      <Box sx={{ display: { xs: 'none', md: viewMode === 'cards' ? 'block' : 'none' } }}>
        <Grid container spacing={3}>
          {sortedAndFilteredSignals.map((signal: any) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={signal.id}>
              <Card
                sx={{
                  background: cardBg,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${dividerColor}`,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'visible',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: theme.shadows[12],
                    border: `1px solid ${accent}50`,
                  },
                }}
                onClick={() => handleSignalClick(signal)}
              >
                {/* Confidence Badge */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: -10,
                    right: 15,
                    background: `linear-gradient(45deg, ${getConfidenceColor(signal.confidence)}, ${getConfidenceColor(signal.confidence)}80)`,
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    boxShadow: theme.shadows[4],
                  }}
                >
                  {signal.confidence}%
                </Box>

                <CardContent sx={{ pb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {signal.symbol}
                      </Typography>
                      <Chip 
                        label={signal.market?.toUpperCase()} 
                        size="small" 
                        variant="outlined" 
                        sx={{ fontSize: '0.7rem' }} 
                      />
                    </Box>
                    <IconButton
                      size="small"
                      onClick={e => {
                        e.stopPropagation();
                        toggleFavorite(signal.id);
                      }}
                      sx={{ 
                        color: favoriteSignals.includes(signal.id) ? theme.palette.warning.main : 'inherit',
                        '&:hover': {
                          background: alpha(theme.palette.warning.main, 0.1),
                        }
                      }}
                    >
                      {favoriteSignals.includes(signal.id) ? <Star /> : <StarBorder />}
                    </IconButton>
                  </Box>

                  {/* Signal Type with Icon */}
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    {signal.type.toUpperCase() === 'BUY' ? (
                      <TrendingUp sx={{ color: theme.palette.success.main }} />
                    ) : (
                      <TrendingDown sx={{ color: theme.palette.error.main }} />
                    )}
                    <Chip
                      label={signal.type.toUpperCase()}
                      color={signal.type.toLowerCase() === 'buy' ? 'success' : 'error'}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                    <Chip 
                      label={signal.timeframe} 
                      variant="outlined" 
                      size="small" 
                      sx={{ ml: 'auto' }}
                    />
                  </Box>

                  {/* Enhanced Confidence Bar */}
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Confidence Level
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: getConfidenceColor(signal.confidence),
                        fontWeight: 'bold'
                      }}>
                        {signal.confidence >= 80 ? 'HIGH' : signal.confidence >= 60 ? 'MEDIUM' : 'LOW'}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={signal.confidence}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: theme.palette.action.disabledBackground,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getConfidenceColor(signal.confidence),
                          borderRadius: 4,
                          background: `linear-gradient(90deg, ${getConfidenceColor(signal.confidence)}, ${getConfidenceColor(signal.confidence)}80)`,
                        }
                      }}
                    />
                  </Box>

                  {/* Price Information Grid */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, background: alpha(theme.palette.primary.main, 0.1) }}>
                        <Typography variant="caption" color="text.secondary">Entry Price</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                          {signal.entryPrice}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper sx={{ p: 1.5, background: alpha(theme.palette.success.main, 0.1) }}>
                        <Typography variant="caption" color="text.secondary">Target</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                          {signal.targetPrice}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Paper sx={{ p: 1.5, background: alpha(theme.palette.error.main, 0.1) }}>
                        <Typography variant="caption" color="text.secondary">Stop Loss</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
                          {signal.stopLoss}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Description */}
                  <Typography variant="body2" color="text.secondary" sx={{ 
                    mb: 2,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {signal.description}
                  </Typography>

                  {/* Footer with Time and Action */}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}>
                      🕒 {getTimeAgo(signal.timestamp || signal.createdAt)}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      color={signal.type.toLowerCase() === 'buy' ? 'success' : 'error'}
                      sx={{
                        minWidth: 'auto',
                        px: 2,
                        fontWeight: 'bold',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSignalClick(signal);
                      }}
                    >
                      Trade
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Enhanced Fallback when no signals match */}
      {sortedAndFilteredSignals.length === 0 && (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            background: paperBg,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${dividerColor}`,
            borderRadius: 3,
          }}
        >
          <Box sx={{ mb: 3 }}>
            {showFavoritesOnly ? (
              <Star sx={{ fontSize: 60, color: theme.palette.warning.main, mb: 2 }} />
            ) : (
              <FilterList sx={{ fontSize: 60, color: theme.palette.text.secondary, mb: 2 }} />
            )}
          </Box>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            {showFavoritesOnly 
              ? 'No favorite signals found' 
              : 'No signals found matching your criteria'
            }
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {showFavoritesOnly 
              ? 'Add some signals to your favorites to see them here.'
              : 'Try adjusting your filters or check back later for new signals.'
            }
          </Typography>
          {showFavoritesOnly && (
            <Button
              variant="outlined"
              onClick={() => setShowFavoritesOnly(false)}
              sx={{ color: accent, borderColor: accent }}
            >
              Show All Signals
            </Button>
          )}
        </Paper>
      )}

      {/* Dialog for opening demo position */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {selectedSignal?.type?.toUpperCase() === 'BUY' ? 'Open Buy Position' : 'Open Sell Position'}
        </DialogTitle>
        <DialogContent>
          {positionSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Demo position opened successfully!
            </Alert>
          )}
          {positionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {positionError}
            </Alert>
          )}
          {selectedSignal && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                <strong>Symbol:</strong> {selectedSignal.symbol}
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {selectedSignal.type.toUpperCase()}
              </Typography>
              <Typography variant="body2">
                <strong>Entry Price:</strong> {selectedSignal.entryPrice}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.success.main }}>
                <strong>Take Profit:</strong> {selectedSignal.targetPrice}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                <strong>Stop Loss:</strong> {selectedSignal.stopLoss}
              </Typography>
              <Typography variant="body2">
                <strong>Timeframe:</strong> {selectedSignal.timeframe}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Confidence:</strong> {selectedSignal.confidence}%
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {selectedSignal.description}
              </Typography>
              <TextField
                label="Quantity"
                type="number"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                fullWidth
                sx={{ mt: 2 }}
                inputProps={{ min: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color={selectedSignal?.type?.toUpperCase() === 'BUY' ? 'success' : 'error'}
            onClick={handleOpenDemoPosition}
            disabled={positionLoading || positionSuccess}
          >
            {positionLoading
              ? 'Opening...'
              : selectedSignal?.type?.toUpperCase() === 'BUY'
                ? 'Open Buy Position'
                : 'Open Sell Position'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Signals;
<style>
  {`
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    @keyframes slideIn {
      from { transform: translateX(-20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    .signal-card-enter {
      animation: slideIn 0.3s ease-out;
    }
  `}
</style>