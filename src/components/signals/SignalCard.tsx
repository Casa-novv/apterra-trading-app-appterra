import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  LinearProgress,
  Tooltip,
  IconButton,
  Collapse,
  Divider,
  Grid,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Psychology,
  Speed,
  Analytics,
  ExpandMore,
  ExpandLess,
  Star,
  StarBorder,
} from '@mui/icons-material';
import { TradingSignal } from '../../types';

interface SignalCardProps {
  signal: TradingSignal;
  compact?: boolean;
  onExecute?: (signal: TradingSignal) => void;
  onFavorite?: (signalId: string) => void;
  isFavorite?: boolean;
  showDetails?: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  compact = false,
  onExecute,
  onFavorite,
  isFavorite = false,
  showDetails = false,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = React.useState(showDetails);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return theme.palette.success.main;
    if (confidence >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getSignalTypeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'BUY':
        return theme.palette.success.main;
      case 'SELL':
        return theme.palette.error.main;
      case 'HOLD':
        return theme.palette.info.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
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

  const isEnterpriseML = signal.source === 'enterprise_ml';

  return (
    <Card
      sx={{
        minWidth: compact ? 200 : 320,
        maxWidth: compact ? 250 : 400,
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: theme.shadows[8],
          transform: 'translateY(-2px)',
        },
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {/* Enterprise ML Badge */}
      {isEnterpriseML && (
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            right: 16,
            bgcolor: theme.palette.primary.main,
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 'bold',
            zIndex: 1,
          }}
        >
          🤖 Enterprise ML
        </Box>
      )}

      <CardContent sx={{ p: compact ? 1.5 : 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {signal.symbol}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {signal.market.toUpperCase()} • {signal.timeframe}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onFavorite && (
              <IconButton
                size="small"
                onClick={() => onFavorite(signal.id)}
                sx={{ p: 0.5 }}
              >
                {isFavorite ? <Star color="warning" /> : <StarBorder />}
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ p: 0.5 }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Signal Type and Confidence */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Chip
            label={signal.type}
            size="small"
            sx={{
              bgcolor: getSignalTypeColor(signal.type),
              color: 'white',
              fontWeight: 'bold',
            }}
            icon={signal.type === 'BUY' ? <TrendingUp /> : <TrendingDown />}
          />
          <Chip
            label={`${signal.confidence}%`}
            size="small"
            sx={{
              bgcolor: getConfidenceColor(signal.confidence),
              color: 'white',
              fontWeight: 'bold',
            }}
          />
          <Chip
            label={signal.risk}
            size="small"
            variant="outlined"
            sx={{
              borderColor: getRiskColor(signal.risk),
              color: getRiskColor(signal.risk),
            }}
          />
        </Box>

        {/* Confidence Bar */}
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Confidence
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {signal.confidence}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={signal.confidence}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: theme.palette.grey[200],
              '& .MuiLinearProgress-bar': {
                bgcolor: getConfidenceColor(signal.confidence),
              },
            }}
          />
        </Box>

        {/* Price Information */}
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" display="block">
              Entry
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              ${signal.entryPrice?.toFixed(2)}
            </Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" display="block">
              Target
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="success.main">
              ${signal.targetPrice?.toFixed(2)}
            </Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary" display="block">
              Stop Loss
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="error.main">
              ${signal.stopLoss?.toFixed(2)}
            </Typography>
          </Grid>
        </Grid>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {signal.description}
        </Typography>

        {/* Timestamp */}
        <Typography variant="caption" color="text.secondary">
          {getTimeAgo(signal.createdAt)}
        </Typography>

        {/* Expandable Details */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 1.5 }} />
          
          {/* Reasoning */}
          {signal.reasoning && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Psychology fontSize="small" />
                Reasoning
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {signal.reasoning}
              </Typography>
            </Box>
          )}

          {/* Enterprise ML Features */}
          {isEnterpriseML && signal.featureImportance && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Analytics fontSize="small" />
                Top Features
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(signal.featureImportance)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 3)
                  .map(([feature, importance]) => (
                    <Chip
                      key={feature}
                      label={`${feature}: ${importance.toFixed(3)}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
              </Box>
            </Box>
          )}

          {/* Performance Metrics */}
          {signal.metadata && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Speed fontSize="small" />
                Performance
              </Typography>
              <Grid container spacing={1}>
                {signal.metadata.processingTime && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Processing: {signal.metadata.processingTime}ms
                    </Typography>
                  </Grid>
                )}
                {signal.metadata.latency && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Latency: {signal.metadata.latency}ms
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {/* Execute Button */}
          {onExecute && signal.status === 'active' && (
            <Box sx={{ mt: 2 }}>
              <Tooltip title="Execute this signal">
                <Chip
                  label="Execute Signal"
                  color="primary"
                  variant="filled"
                  onClick={() => onExecute(signal)}
                  sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                />
              </Tooltip>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SignalCard;
