import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';
import { ArrowDropUp, ArrowDropDown, Remove } from '@mui/icons-material';

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
}

interface MarketOverviewProps {
  data: MarketData[];
  compact?: boolean;
}

const formatPrice = (price: number) =>
  price >= 1
    ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toPrecision(6);

const formatChange = (change: number) =>
  `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;

const MarketOverview: React.FC<MarketOverviewProps> = ({ data, compact }) => {
  return (
    <Box sx={{ p: compact ? 1 : 3, bgcolor: 'background.paper', borderRadius: 2 }}>
      {!compact && (
        <Typography variant="h6" gutterBottom>
          Market Overview
        </Typography>
      )}
      <TableContainer component={Paper} sx={{ boxShadow: 'none', bgcolor: 'transparent' }}>
        <Table size={compact ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>Asset</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Change</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map(({ symbol, price, change }) => {
              const isUp = change > 0;
              const isDown = change < 0;
              return (
                <TableRow key={symbol} hover>
                  <TableCell>
                    <Tooltip title={`View ${symbol} details`}>
                      <span style={{ cursor: 'pointer', fontWeight: 500 }}>{symbol}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">{formatPrice(price)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: isUp
                        ? 'success.main'
                        : isDown
                        ? 'error.main'
                        : 'text.secondary',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {isUp ? (
                      <ArrowDropUp fontSize="small" />
                    ) : isDown ? (
                      <ArrowDropDown fontSize="small" />
                    ) : (
                      <Remove fontSize="small" />
                    )}
                    {formatChange(change)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MarketOverview;