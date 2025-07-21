import React, { useState } from 'react';
import {
  Box,
  FormControlLabel,
  Switch,
  Slider,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Divider,
  useTheme,
} from '@mui/material';
import {
  FilterList,
  ExpandMore,
  Clear,
  Save,
  TrendingUp,
  Security,
  Speed,
} from '@mui/icons-material';

interface FilterState {
  enterpriseMLOnly: boolean;
  highConfidenceOnly: boolean;
  activeSignalsOnly: boolean;
  confidenceRange: [number, number];
  riskLevels: string[];
  markets: string[];
  symbols: string[];
  timeframes: string[];
  sources: string[];
  minPositionSize: number;
  maxPositionSize: number;
}

interface EnterpriseMLFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onReset: () => void;
  onSave: () => void;
}

const EnterpriseMLFilters: React.FC<EnterpriseMLFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset,
  onSave,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleConfidenceChange = (event: Event, newValue: number | number[]) => {
    handleFilterChange('confidenceRange', newValue as [number, number]);
  };

  const handleRiskToggle = (risk: string) => {
    const newRisks = filters.riskLevels.includes(risk)
      ? filters.riskLevels.filter(r => r !== risk)
      : [...filters.riskLevels, risk];
    handleFilterChange('riskLevels', newRisks);
  };

  const handleMarketToggle = (market: string) => {
    const newMarkets = filters.markets.includes(market)
      ? filters.markets.filter(m => m !== market)
      : [...filters.markets, market];
    handleFilterChange('markets', newMarkets);
  };

  const availableMarkets = ['crypto', 'forex', 'stocks', 'commodities'];
  const availableRiskLevels = ['low', 'medium', 'high'];
  const availableTimeframes = ['1M', '5M', '15M', '30M', '1H', '4H', '1D'];
  const availableSources = ['enterprise_ml', 'ai', 'manual', 'copy_trading'];

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.enterpriseMLOnly) count++;
    if (filters.highConfidenceOnly) count++;
    if (filters.activeSignalsOnly) count++;
    if (filters.confidenceRange[0] > 0 || filters.confidenceRange[1] < 100) count++;
    if (filters.riskLevels.length > 0) count++;
    if (filters.markets.length > 0) count++;
    if (filters.symbols.length > 0) count++;
    if (filters.timeframes.length > 0) count++;
    if (filters.sources.length > 0) count++;
    return count;
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Accordion 
        expanded={expanded} 
        onChange={() => setExpanded(!expanded)}
        sx={{ 
          background: theme.palette.mode === 'dark' 
            ? 'rgba(255,255,255,0.05)' 
            : 'rgba(0,0,0,0.02)',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterList />
            <Typography variant="h6">Advanced Filters</Typography>
            {getActiveFiltersCount() > 0 && (
              <Chip 
                label={getActiveFiltersCount()} 
                size="small" 
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Quick Filters */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Quick Filters
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.enterpriseMLOnly}
                      onChange={(e) => handleFilterChange('enterpriseMLOnly', e.target.checked)}
                    />
                  }
                  label="Enterprise ML Only"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.highConfidenceOnly}
                      onChange={(e) => handleFilterChange('highConfidenceOnly', e.target.checked)}
                    />
                  }
                  label="High Confidence (>80%)"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.activeSignalsOnly}
                      onChange={(e) => handleFilterChange('activeSignalsOnly', e.target.checked)}
                    />
                  }
                  label="Active Signals Only"
                />
              </Box>
            </Box>

            <Divider />

            {/* Confidence Range */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Confidence Range
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={filters.confidenceRange}
                  onChange={handleConfidenceChange}
                  valueLabelDisplay="auto"
                  min={0}
                  max={100}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 50, label: '50%' },
                    { value: 80, label: '80%' },
                    { value: 100, label: '100%' },
                  ]}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2">
                    {filters.confidenceRange[0]}% - {filters.confidenceRange[1]}%
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider />

            {/* Risk Levels */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Risk Levels
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {availableRiskLevels.map((risk) => (
                  <Chip
                    key={risk}
                    label={risk.toUpperCase()}
                    onClick={() => handleRiskToggle(risk)}
                    color={filters.riskLevels.includes(risk) ? 'primary' : 'default'}
                    variant={filters.riskLevels.includes(risk) ? 'filled' : 'outlined'}
                    icon={<Security />}
                  />
                ))}
              </Box>
            </Box>

            <Divider />

            {/* Markets */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Markets
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {availableMarkets.map((market) => (
                  <Chip
                    key={market}
                    label={market.toUpperCase()}
                    onClick={() => handleMarketToggle(market)}
                    color={filters.markets.includes(market) ? 'primary' : 'default'}
                    variant={filters.markets.includes(market) ? 'filled' : 'outlined'}
                    icon={<TrendingUp />}
                  />
                ))}
              </Box>
            </Box>

            <Divider />

            {/* Advanced Settings */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Advanced Settings
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Timeframes</InputLabel>
                  <Select
                    multiple
                    value={filters.timeframes}
                    onChange={(e) => handleFilterChange('timeframes', e.target.value)}
                    label="Timeframes"
                  >
                    {availableTimeframes.map((tf) => (
                      <MenuItem key={tf} value={tf}>{tf}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>Sources</InputLabel>
                  <Select
                    multiple
                    value={filters.sources}
                    onChange={(e) => handleFilterChange('sources', e.target.value)}
                    label="Sources"
                  >
                    {availableSources.map((source) => (
                      <MenuItem key={source} value={source}>
                        {source.replace('_', ' ').toUpperCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Min Position Size"
                  type="number"
                  value={filters.minPositionSize}
                  onChange={(e) => handleFilterChange('minPositionSize', parseFloat(e.target.value) || 0)}
                  size="small"
                  InputProps={{ endAdornment: '%' }}
                />

                <TextField
                  label="Max Position Size"
                  type="number"
                  value={filters.maxPositionSize}
                  onChange={(e) => handleFilterChange('maxPositionSize', parseFloat(e.target.value) || 100)}
                  size="small"
                  InputProps={{ endAdornment: '%' }}
                />
              </Box>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                startIcon={<Clear />}
                onClick={onReset}
                variant="outlined"
                size="small"
              >
                Reset
              </Button>
              <Button
                startIcon={<Save />}
                onClick={onSave}
                variant="contained"
                size="small"
              >
                Save Filters
              </Button>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default EnterpriseMLFilters; 