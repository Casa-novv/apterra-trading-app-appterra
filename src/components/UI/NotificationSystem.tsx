import React, { useState, useEffect } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close,
  CheckCircle,
  Error,
  Warning,
  Info,
  ClearAll,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { selectNotifications, selectUnreadCount, markAsRead, markAllAsRead, remove, clear } from '../../store/slices/notificationsSlice';
import { alpha } from '@mui/material/styles';

const NotificationSystem: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);
  const unreadCount = useAppSelector(selectUnreadCount);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [currentNotification, setCurrentNotification] = useState<any>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);

  const open = Boolean(anchorEl);

  // Show latest notification as snackbar
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      if (!latest.read) {
        setCurrentNotification(latest);
        setShowSnackbar(true);
      }
    }
  }, [notifications]);

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSnackbarClose = () => {
    setShowSnackbar(false);
    if (currentNotification) {
      dispatch(markAsRead(currentNotification.id));
    }
  };

  const handleMarkAsRead = (notificationId: string) => {
    dispatch(markAsRead(notificationId));
  };

  const handleRemoveNotification = (notificationId: string) => {
    dispatch(remove(notificationId));
  };

  const handleClearAll = () => {
    dispatch(clear());
    handleClose();
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead());
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'info':
        return theme.palette.info.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      {/* Notification Bell */}
      <IconButton
        color="inherit"
        onClick={handleNotificationClick}
        sx={{ position: 'relative' }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      {/* Notification Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
            overflow: 'auto',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Notifications</Typography>
            <Box>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={handleMarkAllAsRead}
                  sx={{ mr: 1 }}
                >
                  Mark all read
                </Button>
              )}
              <IconButton size="small" onClick={handleClearAll}>
                <ClearAll />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.slice(0, 10).map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    backgroundColor: notification.read ? 'transparent' : alpha(getNotificationColor(notification.type), 0.1),
                    '&:hover': {
                      backgroundColor: alpha(getNotificationColor(notification.type), 0.05),
                    },
                  }}
                >
                  <ListItemIcon>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: notification.read ? 'normal' : 'bold',
                          color: notification.read ? 'text.primary' : 'text.primary',
                        }}
                      >
                        {notification.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(notification.timestamp)}
                        </Typography>
                      </Box>
                    }
                  />
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveNotification(notification.id)}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Menu>

      {/* Snackbar for latest notification */}
      <Snackbar
        open={showSnackbar && currentNotification && !currentNotification.persistent}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={currentNotification?.type || 'info'}
          sx={{ width: '100%' }}
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={handleSnackbarClose}
            >
              <Close fontSize="inherit" />
            </IconButton>
          }
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {currentNotification?.title}
            </Typography>
            <Typography variant="body2">
              {currentNotification?.message}
            </Typography>
          </Box>
        </Alert>
      </Snackbar>
    </>
  );
};

export default NotificationSystem; 