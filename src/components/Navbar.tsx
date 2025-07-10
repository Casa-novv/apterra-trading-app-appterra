import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Dashboard,
  TrendingUp,
  Assessment,
  Settings,
  Logout,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';

const Navbar: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  // Get user from Redux store
  const { user, isAuthenticated } = useAppSelector((state: any) => state.auth || {});
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMobileMenuAnchor(null);
  };

  const handleLogout = () => {
    // Dispatch logout action if you have one
    // dispatch(logout());
    localStorage.removeItem('token');
    navigate('/login');
    handleMenuClose();
  };

  const navigationItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
    { label: 'Signals', path: '/signals', icon: <TrendingUp /> },
    { label: 'Portfolio', path: '/portfolio', icon: <Assessment /> },
  ];

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <AppBar
      position="sticky"
      sx={{
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.secondary.main, 0.9)} 100%)`,
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      <Toolbar>
        {/* Logo/Brand */}
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: { xs: 1, md: 0 },
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #fff 30%, #f0f0f0 90%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            cursor: 'pointer',
            mr: 4,
          }}
          onClick={() => navigate('/dashboard')}
        >
          Apterra Trading
        </Typography>

        {/* Desktop Navigation */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexGrow: 1, gap: 1 }}>
          {navigationItems.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              startIcon={item.icon}
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1,
                px: 2,
                py: 1,
                borderRadius: 2,
                backgroundColor: isActivePath(item.path) 
                  ? alpha(theme.palette.common.white, 0.2)
                  : 'transparent',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.common.white, 0.1),
                },
                transition: 'all 0.3s ease',
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        {/* User Menu */}
        {isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* User Balance (if available) */}
            {user?.demoBalance && (
              <Typography
                variant="body2"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  px: 2,
                  py: 0.5,
                  backgroundColor: alpha(theme.palette.common.white, 0.2),
                  borderRadius: 1,
                  fontWeight: 'bold',
                }}
              >
                ${user.demoBalance.toLocaleString()}
              </Typography>
            )}

            {/* Profile Menu */}
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
              sx={{
                '&:hover': {
                  backgroundColor: alpha(theme.palette.common.white, 0.1),
                },
              }}
            >
              {user?.avatar ? (
                <Avatar
                  src={user.avatar}
                  alt={user.name || user.email}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.secondary.main }}>
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </Avatar>
              )}
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              color="inherit"
              onClick={() => navigate('/login')}
              sx={{
                '&:hover': {
                  backgroundColor: alpha(theme.palette.common.white, 0.1),
                },
              }}
            >
              Login
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => navigate('/register')}
              sx={{
                borderColor: alpha(theme.palette.common.white, 0.5),
                '&:hover': {
                  borderColor: theme.palette.common.white,
                  backgroundColor: alpha(theme.palette.common.white, 0.1),
                },
              }}
            >
              Sign Up
            </Button>
          </Box>
        )}

        {/* Mobile Menu Button */}
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          aria-label="open drawer"
          onClick={handleMobileMenuOpen}
          sx={{ display: { xs: 'block', md: 'none' }, ml: 1 }}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>

      {/* Profile Dropdown Menu */}
      <Menu
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
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
            background: theme.palette.background.paper,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          },
        }}
      >
        {user && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {user.name || 'User'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        )}
        <Divider />
        <MenuItem onClick={() => { navigate('/profile'); handleMenuClose(); }}>
          <AccountCircle sx={{ mr: 2 }} />
          Profile
        </MenuItem>
        <MenuItem onClick={() => { navigate('/settings'); handleMenuClose(); }}>
          <Settings sx={{ mr: 2 }} />
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: theme.palette.error.main }}>
          <Logout sx={{ mr: 2 }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Mobile Navigation Menu */}
      <Menu
        anchorEl={mobileMenuAnchor}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
            background: theme.palette.background.paper,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          },
        }}
        sx={{ display: { xs: 'block', md: 'none' } }}
      >
        {navigationItems.map((item) => (
          <MenuItem
            key={item.path}
            onClick={() => {
              navigate(item.path);
              handleMenuClose();
            }}
            sx={{
              backgroundColor: isActivePath(item.path) 
                ? alpha(theme.palette.primary.main, 0.1)
                : 'transparent',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {item.icon}
              {item.label}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </AppBar>
  );
};

export default Navbar;