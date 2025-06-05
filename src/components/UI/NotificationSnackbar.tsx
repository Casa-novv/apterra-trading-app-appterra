import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, AlertColor, Slide, Button, Typography, Box } from '@mui/material';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';

// Dummy action, replace with your actual mark-as-read action
const markNotificationRead = (id: string) => ({ type: 'notifications/markRead', payload: id });

const NotificationSnackbar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { notifications } = useAppSelector((state) => state.notifications);
  const [open, setOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<any>(null);

  useEffect(() => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length > 0 && !open) {
      setCurrentNotification(unreadNotifications[0]);
      setOpen(true);
    }
  }, [notifications, open]);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
    if (currentNotification) {
      dispatch(markNotificationRead(currentNotification.id));
    }
    setTimeout(() => setCurrentNotification(null), 300);
  };

  if (!currentNotification) return null;

  // Map notification type to icon/color/message
  const type = (currentNotification.type as AlertColor) || 'info';
  const action = currentNotification.link ? (
    <Button
      color="inherit"
      size="small"
      onClick={() => {
        window.open(currentNotification.link, '_blank', 'noopener');
        handleClose();
      }}
      sx={{ ml: 2, textTransform: 'none', fontWeight: 500 }}
    >
      View
    </Button>
  ) : null;

  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      TransitionComponent={Slide}
      sx={{
        '.MuiSnackbarContent-root': {
          borderRadius: 2,
          boxShadow: '0 4px 24px 0 rgba(0,212,170,0.15)',
        },
      }}
    >
      <Alert
        onClose={handleClose}
        severity={type}
        variant="filled"
        sx={{
          width: '100%',
          alignItems: 'center',
          background:
            type === 'success'
              ? 'linear-gradient(90deg, #00d4aa 60%, #00a085 100%)'
              : type === 'error'
              ? 'linear-gradient(90deg, #f44336 60%, #b71c1c 100%)'
              : type === 'warning'
              ? 'linear-gradient(90deg, #ff9800 60%, #f57c00 100%)'
              : 'linear-gradient(90deg, #2196f3 60%, #1565c0 100%)',
          color: '#fff',
        }}
        iconMapping={{
          success: <span role="img" aria-label="Success">✅</span>,
          error: <span role="img" aria-label="Error">❌</span>,
          warning: <span role="img" aria-label="Warning">⚠️</span>,
          info: <span role="img" aria-label="Info">ℹ️</span>,
        }}
        action={action}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {currentNotification.title || 'Notification'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {currentNotification.message}
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
};

export default NotificationSnackbar;
export {};