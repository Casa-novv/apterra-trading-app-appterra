import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, LinearProgress, List, ListItem, ListItemText, Divider } from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import axios from 'axios';

interface EnterpriseSignal {
  id: string;
  symbol: string;
  type: string;
  confidence: number;
  createdAt: string;
  source: string;
}

interface AnalyticsData {
  timestamp: string;
  period: string;
  signals: {
    total: number;
    byType: { BUY: number; SELL: number; HOLD: number };
    byConfidence: { high: number; medium: number; low: number };
  };
  performance: {
    averageConfidence: number;
    averageLatency: string;
    errorRate: string;
  };
  models: Record<string, string>;
}

const EnterpriseMLInsights: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentSignals, setRecentSignals] = useState<EnterpriseSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/enterprise-ml/analytics');
        setAnalytics(res.data);
        setRecentSignals(res.data.signalsList || []);
        setError('');
      } catch (err: any) {
        setError('Failed to load Enterprise ML analytics');
      }
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PsychologyIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">Enterprise ML Insights</Typography>
        </Box>
        {loading ? (
          <LinearProgress />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : analytics ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Period: {analytics.period}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Signals: <b>{analytics.signals.total}</b>
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip label={`BUY: ${analytics.signals.byType.BUY}`} color="success" size="small" icon={<TrendingUpIcon />} />
                <Chip label={`SELL: ${analytics.signals.byType.SELL}`} color="error" size="small" icon={<TrendingDownIcon />} />
                <Chip label={`HOLD: ${analytics.signals.byType.HOLD}`} color="info" size="small" />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip label={`High Confidence: ${analytics.signals.byConfidence.high}`} color="success" size="small" />
                <Chip label={`Medium: ${analytics.signals.byConfidence.medium}`} color="warning" size="small" />
                <Chip label={`Low: ${analytics.signals.byConfidence.low}`} color="error" size="small" />
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Performance</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip label={`Avg Confidence: ${analytics.performance.averageConfidence}%`} color="primary" size="small" />
              <Chip label={`Latency: ${analytics.performance.averageLatency}`} color="info" size="small" />
              <Chip label={`Error Rate: ${analytics.performance.errorRate}`} color="error" size="small" />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Recent Signals</Typography>
            {recentSignals.length > 0 ? (
              <List dense>
                {recentSignals.slice(0, 5).map((signal) => (
                  <ListItem key={signal.id}>
                    <ListItemText
                      primary={<>
                        <b>{signal.symbol}</b> - {signal.type} ({signal.confidence}%)
                      </>}
                      secondary={new Date(signal.createdAt).toLocaleString()}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">No recent signals</Typography>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default EnterpriseMLInsights; 