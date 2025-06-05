import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { logout } from '../../store/slices/authSlice';
import { AccountCircle } from '@mui/icons-material';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string; // Ensure avatar is defined as optional
  // other properties
}

const Navbar = () => {
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const user = useAppSelector(state => state.auth.user) as User | null;
  const dispatch = useAppDispatch();
  const location = useLocation();
  const theme = useTheme();

  // For user menu
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  // Helper for active link styling
  const isActive = (path: string) => location.pathname === path;

  return (
    <AppBar
      position="fixed"
      sx={{
        bgcolor: theme.palette.background.paper, // Use theme background
        color: theme.palette.text.primary,
        boxShadow: theme.shadows[4],
      }}
      elevation={0}
    >
      <Toolbar>
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1,
            cursor: 'pointer',
            fontWeight: 'bold',
            letterSpacing: 1,
            color: '#00d4aa',
            textShadow: '0 1px 8px rgba(0,212,170,0.12)',
            textDecoration: 'none',
          }}
          component={Link}
          to="/dashboard"
        >
          Apterra Trading
        </Typography>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          <Button
            component={Link}
            to="/dashboard"
            color="inherit"
            sx={{
              fontWeight: isActive('/dashboard') ? 'bold' : 'normal',
              borderBottom: isActive('/dashboard') ? '2px solid #00d4aa' : 'none',
              color: isActive('/dashboard') ? '#00d4aa' : 'inherit',
              borderRadius: 0,
            }}
          >
            Dashboard
          </Button>
          <Button
            component={Link}
            to="/signals"
            color="inherit"
            sx={{
              fontWeight: isActive('/signals') ? 'bold' : 'normal',
              borderBottom: isActive('/signals') ? '2px solid #00d4aa' : 'none',
              color: isActive('/signals') ? '#00d4aa' : 'inherit',
              borderRadius: 0,
            }}
          >
            Signals
          </Button>
          <Button
            component={Link}
            to="/portfolio"
            color="inherit"
            sx={{
              fontWeight: isActive('/portfolio') ? 'bold' : 'normal',
              borderBottom: isActive('/portfolio') ? '2px solid #00d4aa' : 'none',
              color: isActive('/portfolio') ? '#00d4aa' : 'inherit',
              borderRadius: 0,
            }}
          >
            Portfolio
          </Button>
          <Button
            component={Link}
            to="/settings"
            color="inherit"
            sx={{
              fontWeight: isActive('/settings') ? 'bold' : 'normal',
              borderBottom: isActive('/settings') ? '2px solid #00d4aa' : 'none',
              color: isActive('/settings') ? '#00d4aa' : 'inherit',
              borderRadius: 0,
            }}
          >
            Settings
          </Button>
        </Box>
        {isAuthenticated ? (
          <Box sx={{ ml: 2 }}>
            <Tooltip title="Account">
              <IconButton
                onClick={handleMenu}
                size="small"
                sx={{ ml: 1, color: '#00d4aa' }}
                aria-label="Open user menu"
              >
                {typeof user?.avatar === 'string' && user.avatar.trim() !== '' ? (
                  <Avatar src={user.avatar} alt={user.name || 'User'} />
                ) : (
                  <Avatar sx={{ bgcolor: '#00d4aa', color: '#fff' }}>
                    {user?.name ? user.name[0].toUpperCase() : <AccountCircle />}
                  </Avatar>
                )}
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              onClick={handleClose}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 160,
                  background: 'rgba(26, 26, 46, 0.98)',
                  color: '#fff',
                  border: '1px solid #00d4aa',
                },
              }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem component={Link} to="/profile">
                Profile
              </MenuItem>
              <MenuItem component={Link} to="/settings">
                Settings
              </MenuItem>
              <MenuItem onClick={() => dispatch(logout())} sx={{ color: '#f44336' }}>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Box sx={{ ml: 2 }}>
            <Button
              color="inherit"
              component={Link}
              to="/login"
              sx={{
                fontWeight: isActive('/login') ? 'bold' : 'normal',
                borderBottom: isActive('/login') ? '2px solid #00d4aa' : 'none',
                color: isActive('/login') ? '#00d4aa' : 'inherit',
                borderRadius: 0,
              }}
            >
              Login
            </Button>
            <Button
              color="inherit"
              component={Link}
              to="/register"
              sx={{
                fontWeight: isActive('/register') ? 'bold' : 'normal',
                borderBottom: isActive('/register') ? '2px solid #00d4aa' : 'none',
                color: isActive('/register') ? '#00d4aa' : 'inherit',
                borderRadius: 0,
              }}
            >
              Register
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;