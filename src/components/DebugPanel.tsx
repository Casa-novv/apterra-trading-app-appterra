import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

interface DebugPanelProps {
  positions: any[];
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ positions }) => {
  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
      <Typography variant="h6">Debug Info</Typography>
      {positions.map((pos, index) => (
        <Box key={index} sx={{ mt: 1, p: 1, border: '1px solid grey' }}>
          <Typography variant="body2">
            Symbol: {pos.symbol} | 
            Entry: {pos.entryPrice} | 
            Current: {pos.currentPrice} | 
            Quantity: {pos.quantity} | 
            Type: {pos.type} | 
            P&L: {pos.pnl?.toFixed(2) || 'N/A'}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};