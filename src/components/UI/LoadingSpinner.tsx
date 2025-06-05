import React from 'react';
import { Box, styled } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string; // Kept for backwards compatibility but not used
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({}) => {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{ backgroundColor: 'background.default' }}
      aria-live="polite"
      aria-busy="true"
    >
      {/* Trading-Inspired Candlestick Animation */}
      <Box sx={{ width: 160, height: 50 }}>
        <svg width="160" height="50" viewBox="0 0 160 50" fill="none">
          {/* Candlestick Path with Smooth Curves */}
          <path
            d="M0 40 Q 20 5, 40 35 Q 60 45, 80 15 Q 100 5, 120 38 Q 140 48, 160 22"
            stroke="#00d4aa"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          >
            {/* Animation that mimics candlestick chart movement */}
            <animate
              attributeName="stroke-dasharray"
              values="160;0;0"
              keyTimes="0;0.5;1"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-dashoffset"
              values="0;0;160"
              keyTimes="0;0.5;1"
              dur="2s"
              repeatCount="indefinite"
            />
            {/* Bullish/Bearish Color Transition */}
            <animate
              attributeName="stroke"
              values="#00d4aa;#f44336;#00d4aa"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </Box>
    </Box>
  );
};

export default LoadingSpinner;
export {}