import React, { useEffect, useState, useMemo } from 'react';
import {
  Container, Box, Typography, Paper, TextField, FormControl, InputLabel, Select, MenuItem,
  Button, Chip, ToggleButton, ToggleButtonGroup, LinearProgress, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Stack // Import Stack
} from '@mui/material';
// No need to import Grid if you're replacing it
import { Refresh, ViewModule, ViewList, Star, StarBorder, AutoAwesome, TrendingUp, TrendingDown } from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { fetchSignals } from '../store/slices/signalSlice';
import SignalCard from '../components/signals/SignalCard';
import { TradingSignal } from '../types';

const SignalsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const signals = useAppSelector((state: any) => state.signals.signals);
  const loading = useAppSelector((state: any) => state.signals.loading.signals);
  const error = useAppSelector((state: any) => state.signals.error.signals);
  const user = useAppSelector((state: any) => state.auth.user);

  // UI State
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    market: 'all',
    type: 'all',
    confidence: 'all',
    source: 'all',
    risk: 'all',
    timeframe: 'all',
  });
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<TradingSignal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch signals on mount and optionally on interval
  useEffect(() => {
    dispatch(fetchSignals());
    const interval = setInterval(() => dispatch(fetchSignals()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // Filtering logic
  const filteredSignals = useMemo(() => {
    return signals
      .filter((signal: TradingSignal) => {
        // Search
        if (
          search &&
          !signal.symbol.toLowerCase().includes(search.toLowerCase()) &&
          !signal.description?.toLowerCase().includes(search.toLowerCase())
        ) return false;
        // Filters
        if (filters.market !== 'all' && signal.market !== filters.market) return false;
        if (filters.type !== 'all' && signal.type.toLowerCase() !== filters.type) return false;
        if (filters.confidence === 'high' && signal.confidence < 80) return false;
        if (filters.confidence === 'medium' && (signal.confidence < 60 || signal.confidence >= 80)) return false;
        if (filters.confidence === 'low' && signal.confidence >= 60) return false;
        if (filters.source !== 'all' && signal.source !== filters.source) return false;
        if (filters.risk !== 'all' && signal.risk !== filters.risk) return false;
        if (filters.timeframe !== 'all' && signal.timeframe !== filters.timeframe) return false;
        // Only show signals from last 24h
        const hoursAgo = (Date.now() - new Date(signal.createdAt).getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 24) return false;
        return true;
      });
  }, [signals, search, filters]);

  // Handlers
  const handleFilter = (key: string, value: string) => setFilters(f => ({ ...f, [key]: value }));
  const handleFavorite = (id: string) =>
    setFavoriteIds(ids => ids.includes(id) ? ids.filter(fid => fid !== id) : [...ids, id]);
  const handleDialogOpen = (signal: TradingSignal) => { setSelectedSignal(signal); setDialogOpen(true); };
  const handleDialogClose = () => { setDialogOpen(false); setSelectedSignal(null); };

  // UI
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>Trading Signals</Typography>
        <Box display="flex" gap={2} mb={2}>
          <Chip label={`Total: ${filteredSignals.length}`} color="primary" />
          <Chip label={`Favorites: ${favoriteIds.length}`} color="warning" />
        </Box>
      </Box>

      {/* Filters - Replaced Grid with Stack for a cleaner linear layout */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }} // Stack items vertically on small screens, horizontally on medium+
          spacing={2} // Spacing between items
          useFlexGap // Enables gap property for better responsiveness
          flexWrap="wrap" // Allows items to wrap to the next line
        >
          <Box sx={{ flexGrow: 1, flexBasis: { xs: '100%', md: '25%' } }}> {/* Adjust flexBasis for TextField */}
            <TextField fullWidth label="Search" value={search} onChange={e => setSearch(e.target.value)} size="small" />
          </Box>
          <Box sx={{ flexGrow: 1, flexBasis: { xs: '48%', md: '12%' } }}> {/* Adjust flexBasis for select inputs */}
            <FormControl fullWidth size="small">
              <InputLabel>Market</InputLabel>
              <Select value={filters.market} onChange={e => handleFilter('market', e.target.value)} label="Market">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="crypto">Crypto</MenuItem>
                <MenuItem value="forex">Forex</MenuItem>
                <MenuItem value="stocks">Stocks</MenuItem>
                <MenuItem value="commodities">Commodities</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, flexBasis: { xs: '48%', md: '12%' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select value={filters.type} onChange={e => handleFilter('type', e.target.value)} label="Type">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="buy">Buy</MenuItem>
                <MenuItem value="sell">Sell</MenuItem>
                <MenuItem value="hold">Hold</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, flexBasis: { xs: '48%', md: '12%' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Confidence</InputLabel>
              <Select value={filters.confidence} onChange={e => handleFilter('confidence', e.target.value)} label="Confidence">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="high">High (80%+)</MenuItem>
                <MenuItem value="medium">Medium (60-79%)</MenuItem>
                <MenuItem value="low">Low (&lt;60%)</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, flexBasis: { xs: '48%', md: '12%' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Source</InputLabel>
              <Select value={filters.source} onChange={e => handleFilter('source', e.target.value)} label="Source">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="enterprise_ml">Enterprise ML</MenuItem>
                <MenuItem value="ai">AI</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, flexBasis: { xs: '48%', md: '12%' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Risk</InputLabel>
              <Select value={filters.risk} onChange={e => handleFilter('risk', e.target.value)} label="Risk">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flexGrow: 1, flexBasis: { xs: '48%', md: '12%' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Timeframe</InputLabel>
              <Select value={filters.timeframe} onChange={e => handleFilter('timeframe', e.target.value)} label="Timeframe">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="1M">1 Minute</MenuItem>
                <MenuItem value="5M">5 Minutes</MenuItem>
                <MenuItem value="15M">15 Minutes</MenuItem>
                <MenuItem value="1H">1 Hour</MenuItem>
                <MenuItem value="4H">4 Hours</MenuItem>
                <MenuItem value="1D">1 Day</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Stack>
      </Paper>

      {/* View Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
          <ToggleButton value="cards"><ViewModule /></ToggleButton>
          <ToggleButton value="table"><ViewList /></ToggleButton>
        </ToggleButtonGroup>
        <Button variant="outlined" startIcon={<Refresh />} onClick={() => dispatch(fetchSignals())} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {/* Loading/Error */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Signals Display */}
      {filteredSignals.length === 0 && !loading ? (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary">No signals found</Typography>
        </Box>
      ) : viewMode === 'cards' ? (
        <Box display="flex" flexWrap="wrap" gap={2}>
          {filteredSignals.map((signal: TradingSignal) => (
            <Box key={signal.id} sx={{ flexBasis: { xs: '100%', sm: '48%', md: '31%', lg: '23%' }, flexGrow: 1 }}>
              <SignalCard
                signal={signal}
                onExecute={handleDialogOpen}
                onFavorite={handleFavorite}
                isFavorite={favoriteIds.includes(signal.id)}
                showDetails={false}
              />
            </Box>
          ))}
        </Box>
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
                <TableCell>Entry</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>Stop</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSignals.map((signal: TradingSignal) => (
                <TableRow key={signal.id}>
                  <TableCell>{signal.symbol}</TableCell>
                  <TableCell>
                    <Chip
                      label={signal.type}
                      size="small"
                      color={signal.type === 'BUY' ? 'success' : 'error'}
                      icon={signal.type === 'BUY' ? <TrendingUp /> : <TrendingDown />}
                    />
                  </TableCell>
                  <TableCell>{signal.confidence}%</TableCell>
                  <TableCell>
                    <Chip
                      label={signal.source.replace('_', ' ')}
                      size="small"
                      icon={signal.source === 'enterprise_ml' ? <AutoAwesome /> : undefined}
                      color={signal.source === 'enterprise_ml' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{signal.market}</TableCell>
                  <TableCell>${signal.entryPrice?.toFixed(2)}</TableCell>
                  <TableCell>${signal.targetPrice?.toFixed(2)}</TableCell>
                  <TableCell>${signal.stopLoss?.toFixed(2)}</TableCell>
                  <TableCell>{new Date(signal.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleFavorite(signal.id)}>
                      {favoriteIds.includes(signal.id) ? <Star color="warning" /> : <StarBorder />}
                    </IconButton>
                    <Button size="small" variant="contained" onClick={() => handleDialogOpen(signal)}>
                      Execute
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Signal Dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Execute Signal: {selectedSignal?.symbol}</DialogTitle>
        <DialogContent>
          {selectedSignal && (
            <Box>
              <Typography variant="body2">Type: <b>{selectedSignal.type}</b></Typography>
              <Typography variant="body2">Confidence: <b>{selectedSignal.confidence}%</b></Typography>
              <Typography variant="body2">Entry: <b>${selectedSignal.entryPrice?.toFixed(2)}</b></Typography>
              <Typography variant="body2">Target: <b>${selectedSignal.targetPrice?.toFixed(2)}</b></Typography>
              <Typography variant="body2">Stop Loss: <b>${selectedSignal.stopLoss?.toFixed(2)}</b></Typography>
              <Typography variant="body2">Risk: <b>{selectedSignal.risk}</b></Typography>
              <Typography variant="body2" sx={{ mt: 2 }}>{selectedSignal.description}</Typography>
              {selectedSignal.reasoning && (
                <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                  <b>Reasoning:</b> {selectedSignal.reasoning}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" disabled>
            Open Demo Position
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SignalsPage;