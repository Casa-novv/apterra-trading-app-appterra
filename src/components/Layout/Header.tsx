import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogActions,
  useMediaQuery,
  Tooltip,
  Switch,
} from '@mui/material';
import {
  Notifications,
  AccountCircle,
  TrendingUp,
  Menu as MenuIcon,
  Dashboard,
  ShowChart,
  AccountBalance,
  Settings,
  ExitToApp,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { toggleSidebar } from '../../store/slices/uiSlice';

const Header: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const notifications = useSelector((state: RootState) => state.notifications.notifications || []);
  const sidebarOpen = useSelector((state: RootState) => state.ui?.sidebarOpen || false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');
  // Optional: Theme toggle state (if your app supports it)
  // const [darkMode, setDarkMode] = useState(false);

  const unreadNotifications = notifications.filter((n: { read: boolean }) => !n.read).length;

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationMenu = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setNotificationAnchor(null);
  };

  const handleLogout = () => {
    setLogoutDialog(true);
    handleClose();
  };

  const confirmLogout = () => {
    dispatch(logout());
    navigate('/');
    setLogoutDialog(false);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    dispatch(toggleSidebar());
  };

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Signals', icon: <ShowChart />, path: '/signals' },
    { text: 'Portfolio', icon: <AccountBalance />, path: '/portfolio' },
    { text: 'Settings', icon: <Settings />, path: '/settings' },
  ];

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'rgba(26, 26, 46, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,212,170,0.08)',
          boxShadow: '0 2px 16px 0 rgba(0,212,170,0.08)',
        }}
      >
        <Toolbar>
          {isAuthenticated && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="open navigation"
              onClick={() => dispatch(toggleSidebar())}
              sx={{ mr: 2 }}
              size="large"
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <TrendingUp sx={{ mr: 1, color: '#00d4aa', fontSize: 32 }} />
            <Typography
              variant="h5"
              component="div"
              sx={{
                fontWeight: 'bold',
                background: 'linear-gradient(45deg, #00d4aa 30%, #ffffff 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: 1,
              }}
            >
              APTERRA
            </Typography>
            {!isMobile && (
              <Typography
                variant="caption"
                sx={{
                  ml: 2,
                  color: '#00d4aa',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  opacity: 0.8,
                }}
              >
                Your Intelligent Trading Companion
              </Typography>
            )}
          </Box>

          {/* Optional: Theme toggle */}
          {/* <Tooltip title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            <IconButton color="inherit" onClick={() => setDarkMode((prev) => !prev)}>
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Tooltip> */}

          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Notifications">
                <IconButton color="inherit" onClick={handleNotificationMenu} aria-label="notifications">
                  <Badge badgeContent={unreadNotifications} color="error">
                    <Notifications />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Tooltip title="Account">
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: '#00d4aa',
                      fontWeight: 'bold',
                      border: '2px solid #fff',
                    }}
                    alt={user?.name}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>

              {/* Account Menu */}
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>
                  Profile
                </MenuItem>
                <MenuItem onClick={() => { navigate('/settings'); handleClose(); }}>
                  Settings
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ExitToApp sx={{ mr: 1 }} />
                  Logout
                </MenuItem>
              </Menu>

              {/* Notifications Menu */}
              <Menu
                anchorEl={notificationAnchor}
                open={Boolean(notificationAnchor)}
                onClose={handleClose}
                PaperProps={{
                  sx: { width: 300, maxHeight: 400 },
                }}
              >
                {notifications.length === 0 ? (
                  <MenuItem>No notifications</MenuItem>
                ) : (
                  notifications
                    .slice(0, 5)
                    .map((notification: { id: string; message: string; timestamp: string | number | Date }) => (
                      <MenuItem key={notification.id} onClick={handleClose}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))
                )}
              </Menu>

              {/* Logout Confirmation Dialog */}
              <Dialog
                open={logoutDialog}
                onClose={() => setLogoutDialog(false)}
                aria-labelledby="logout-dialog-title"
                aria-describedby="logout-dialog-description"
              >
                <DialogTitle id="logout-dialog-title">Confirm Logout</DialogTitle>
                <DialogActions>
                  <Button onClick={() => setLogoutDialog(false)} color="primary">
                    Cancel
                  </Button>
                  <Button onClick={confirmLogout} color="error">
                    Logout
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
          ) : (
            <Box>
              <Button
                color="inherit"
                onClick={() => navigate('/login')}
                sx={{ mr: 1 }}
              >
                Login
              </Button>
              <Button
                variant="outlined"
                sx={{
                  color: '#00d4aa',
                  borderColor: '#00d4aa',
                  '&:hover': {
                    backgroundColor: '#00d4aa',
                    color: '#1a1a2e',
                  },
                }}
                onClick={() => navigate('/register')}
              >
                Sign Up
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Drawer
        anchor="left"
        open={sidebarOpen}
        onClose={() => dispatch(toggleSidebar())}
        sx={{
          '& .MuiDrawer-paper': {
            width: 250,
            backgroundColor: '#1a1a2e',
            color: 'white',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ color: '#00d4aa' }}>
            Navigation
          </Typography>
        </Box>
        <Divider sx={{ borderColor: '#333' }} />
        <List>
          {menuItems.map((item) => (
            <ListItem disablePadding key={item.text}>
             <ListItemButton
               onClick={() => handleNavigation(item.path)}
               selected={location.pathname === item.path}
               sx={{
                 '&:hover': { backgroundColor: '#00d4aa20' },
                 backgroundColor: location.pathname === item.path ? '#00d4aa30' : 'inherit',
                 cursor: 'pointer',
               }}
             >
                <ListItemIcon sx={{ color: '#00d4aa' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
             </ListItemButton>
           </ListItem>

          ))}
        </List>
      </Drawer>
    </>
  );
};

export default Header;