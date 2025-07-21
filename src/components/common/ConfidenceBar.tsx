import React from 'react';
import { Box, LinearProgress, Typography, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface ConfidenceBarProps {
  confidence: number;
  showPercentage?: boolean;
  height?: number;
  width?: string | number;
  variant?: 'determinate' | 'indeterminate';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  size?: 'small' | 'medium' | 'large';
}

const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  confidence,
  showPercentage = true,
  height = 8,
  width = '100%',
  variant = 'determinate',
  color = 'primary',
  size = 'medium'
}) => {
  const theme = useTheme();

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return theme.palette.success.main;
    if (confidence >= 65) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return 'Excellent';
    if (confidence >= 80) return 'Very High';
    if (confidence >= 70) return 'High';
    if (confidence >= 60) return 'Medium';
    if (confidence >= 50) return 'Low';
    return 'Very Low';
  };

  const getSizeStyles = (size: string) => {
    switch (size) {
      case 'small':
        return { height: 4, fontSize: '0.75rem' };
      case 'large':
        return { height: 12, fontSize: '1rem' };
      default:
        return { height: 8, fontSize: '0.875rem' };
    }
  };

  const sizeStyles = getSizeStyles(size);
  const confidenceColor = getConfidenceColor(confidence);
  const confidenceLabel = getConfidenceLabel(confidence);

  return (
    <Box sx={{ width, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <LinearProgress
          variant={variant}
          value={confidence}
          sx={{
            height: sizeStyles.height,
            borderRadius: sizeStyles.height / 2,
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255,255,255,0.1)' 
              : 'rgba(0,0,0,0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: confidenceColor,
              borderRadius: sizeStyles.height / 2,
              transition: 'all 0.3s ease',
            },
          }}
        />
        {variant === 'determinate' && (
          <Tooltip 
            title={`${confidenceLabel} confidence (${confidence}%)`}
            arrow
            placement="top"
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: sizeStyles.fontSize,
                  fontWeight: 600,
                  color: confidence >= 70 ? '#fff' : theme.palette.text.primary,
                  textShadow: confidence >= 70 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                  zIndex: 1,
                }}
              >
                {confidence}%
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Box>
      {showPercentage && (
        <Typography
          variant="body2"
          sx={{
            fontSize: sizeStyles.fontSize,
            fontWeight: 500,
            color: confidenceColor,
            minWidth: 'fit-content',
          }}
        >
          {confidence}%
        </Typography>
      )}
    </Box>
  );
};

export default ConfidenceBar; 