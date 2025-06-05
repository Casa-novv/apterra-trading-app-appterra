import React from 'react';
import { Card, CardContent, Typography, Chip } from '@mui/material';

interface SignalCardProps {
  signal: any; // Replace 'any' with the correct type if available
  compact?: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, compact }) => {
  const { symbol, type, confidence } = signal;

  return (
    <Card sx={{ minWidth: 250, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6">{symbol}</Typography>
        <Chip label={type.toUpperCase()} color={type === 'buy' ? 'success' : 'error'} sx={{ mt: 1 }} />
        <Typography variant="body2" sx={{ mt: 1 }}>Confidence: {confidence}%</Typography>
      </CardContent>
    </Card>
  );
};

export default SignalCard;
