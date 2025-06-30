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
import { useTheme } from '@mui/material/styles';
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
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Trading Signals
        </Typography>
        <Typography variant="h6" color="text.secondary">
          AI-powered trading signals across multiple markets
        </Typography>
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

      {/* Filters */}
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
            Filters
          </Typography>

          <Box ml="auto" display="flex" gap={1}>
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
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                console.log('🧪 === SIGNALS DEBUG ===');
                console.log('Total signals:', signals.length);
                console.log('Recent signals (24h):', signals.filter(isSignalRecent).length);
                console.log('Oldest signal:', signals.length > 0 ? new Date(Math.min(...signals.map((s: any) => new Date(s.timestamp || s.createdAt).getTime()))) : 'None');
                console.log('Newest signal:', signals.length > 0 ? new Date(Math.max(...signals.map((s: any) => new Date(s.timestamp || s.createdAt).getTime()))) : 'None');
                console.log('All signals:', signals);
              }}
            >
              🧪 Debug Signals
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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

      <Box mb={2}>
        <Typography variant="body1" color="text.secondary">
          Showing {filteredSignals.length} recent signals 
          {signals.length > filteredSignals.length && (
            <span> (filtered from {signals.length} total)</span>
          )}
        </Typography>
      </Box>

      {/* Mobile Cards View */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {filteredSignals.map((signal: any) => (
          <Card
            key={signal.id}
            sx={{
              mb: 2,
              background: cardBg,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${dividerColor}`,
              cursor: 'pointer',
            }}
            onClick={() => handleSignalClick(signal)}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {signal.symbol}
                </Typography>
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
              </Box>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Chip
                  label={signal.type.toUpperCase()}
                  color={signal.type.toLowerCase() === 'buy' ? 'success' : 'error'}
                  size="small"
                />
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: getConfidenceColor(signal.confidence) }}>
                  {signal.confidence}%
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Confidence Level
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <LinearProgress
                    variant="determinate"
                    value={signal.confidence}
                    sx={{
                      flexGrow: 1,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.palette.action.disabledBackground,
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getConfidenceColor(signal.confidence),
                        borderRadius: 4,
                      }
                    }}
                  />
                  <Typography variant="body2" sx={{ color: getConfidenceColor(signal.confidence) }}>
                    {signal.confidence}%
                  </Typography>
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Entry</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {signal.entryPrice}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Target</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                    {signal.targetPrice}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Stop Loss</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
                    {signal.stopLoss}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Timeframe</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {signal.timeframe}
                  </Typography>
                </Grid>
              </Grid>

              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  {signal.description}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {getTimeAgo(signal.timestamp || signal.createdAt)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Desktop Table View */}
      <Paper
        component={Paper}
        sx={{
          display: { xs: 'none', md: 'block' },
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
              {filteredSignals.map((signal: any) => (
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

      {/* Fallback when no signals match */}
      {filteredSignals.length === 0 && (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            background: paperBg,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${dividerColor}`,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No signals found matching your criteria
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your filters or check back later for new signals.
          </Typography>
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