import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

const Footer: React.FC = () => {
  const theme = useTheme();
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: theme.palette.background.paper,
        color: theme.palette.text.secondary,
        py: 2,
        textAlign: 'center',
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="body2">
        &copy; {new Date().getFullYear()} Apterra Trading. All rights reserved.
      </Typography>
    </Box>
  );
};

export default Footer;