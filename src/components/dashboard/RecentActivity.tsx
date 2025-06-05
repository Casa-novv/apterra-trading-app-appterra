import React from 'react';
import { List, ListItem, ListItemText, Typography, Box } from '@mui/material';

export interface RecentActivityProps {
  trades?: any[];
  signals?: any[];
  notifications?: any[];
  activities?: any[]; // <-- Add this
}

const RecentActivity: React.FC<RecentActivityProps> = ({
  trades = [],
  signals = [],
  notifications = [],
  activities = [],
}) => {
  // If activities prop is provided, use it
  const displayList = activities.length
    ? activities
    : [
        ...trades.map((t) => ({ ...t, type: 'Trade', date: t.executedAt || t.timestamp })),
        ...signals.map((s) => ({ ...s, type: 'Signal', date: s.createdAt })),
        ...notifications.map((n) => ({ ...n, type: 'Notification', date: n.timestamp })),
      ]
        .filter((a) => a.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

  if (!displayList.length) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body2" color="text.secondary">
          No recent activity yet. Your trades, signals, and notifications will appear here.
        </Typography>
      </Box>
    );
  }

  return (
    <List>
      {displayList.map((activity, idx) => (
        <ListItem key={activity.id || idx}>
          <ListItemText
            primary={
              activity.text ||
              activity.description ||
              activity.title ||
              activity.message ||
              activity.symbol ||
              'Activity'
            }
            secondary={activity.type}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default RecentActivity;
