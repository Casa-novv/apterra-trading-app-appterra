import React from 'react';
import Grid from '@mui/material/Grid';
import { Paper, Typography, Button, Tooltip } from '@mui/material';
import { Add, TrendingUp, Assessment, Settings } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const QuickActions: React.FC = () => {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Quick Actions
      </Typography>
      <Grid container spacing={1}>
        <Grid size={{ xs: 6 }}>
          <Tooltip title="Create a new trading signal">
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Add />}
              size="small"
              component={RouterLink}
              to="/signals/create"
            >
              New Signal
            </Button>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Tooltip title="View your portfolio">
            <Button
              fullWidth
              variant="outlined"
              startIcon={<TrendingUp />}
              size="small"
              component={RouterLink}
              to="/portfolio"
            >
              Portfolio
            </Button>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Tooltip title="See analytics and reports">
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Assessment />}
              size="small"
              component={RouterLink}
              to="/analytics" // Change this route if you don't have analytics
            >
              Analytics
            </Button>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Tooltip title="Go to settings">
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Settings />}
              size="small"
              component={RouterLink}
              to="/settings"
            >
              Settings
            </Button>
          </Tooltip>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default QuickActions;