import React, { useState, useRef, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  Alert,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { TrendingUp } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { loginUser, clearError } from '../store/slices/authSlice';

const Login: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error, isAuthenticated } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (error && emailRef.current) {
      emailRef.current.focus();
    }
  }, [error]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(loginUser(formData));
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: theme.palette.background.default,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderRadius: 3,
          boxShadow: theme.shadows[8],
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 400,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <TrendingUp sx={{ mr: 1, color: '#00d4aa', fontSize: 32 }} />
          <Typography component="h1" variant="h4" sx={{ color: '#00d4aa', fontWeight: 'bold' }}>
            APTERRA
          </Typography>
        </Box>
        
        <Typography component="h2" variant="h5" sx={{ mb: 3 }}>
          Welcome Back
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            inputRef={emailRef}
            value={formData.email}
            onChange={handleChange}
            aria-label="Email Address"
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: '#00d4aa',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00d4aa',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: '#00d4aa',
                },
              },
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            aria-label="Password"
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: '#00d4aa',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00d4aa',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: '#00d4aa',
                },
              },
            }}
            InputProps={{
              endAdornment: (
                <Button
                  onClick={() => setShowPassword((show) => !show)}
                  tabIndex={-1}
                  sx={{ minWidth: 0, color: '#00d4aa' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              ),
            }}
          />
          <Box textAlign="right" sx={{ mb: 2 }}>
            <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ color: '#00d4aa' }}>
              Forgot password?
            </Link>
          </Box>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              mt: 3,
              mb: 2,
              background: 'linear-gradient(45deg, #00d4aa 30%, #00a085 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #00a085 30%, #008066 90%)',
              },
              '&:disabled': {
                background: 'rgba(0, 212, 170, 0.3)',
              },
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign In'}
          </Button>
          <Box textAlign="center">
            <Link component={RouterLink} to="/register" variant="body2" sx={{ color: '#00d4aa' }}>
              {"Don't have an account? Sign Up"}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;
export {};