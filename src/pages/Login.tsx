import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Divider,
  Alert,
  InputAdornment,
  IconButton,
  Fade,
  Slide,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Person,
  TrendingUp,
  ShowChart,
  AccountBalance,
  Login as LoginIcon,
  PersonAdd,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';

const Login: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error, user } = useAppSelector((state: any) => state.auth);

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: '',
  });
  const [currentQuote, setCurrentQuote] = useState(0);

  // Trading quotes for motivation
  const tradingQuotes = [
    "The stock market is filled with individuals who know the price of everything, but the value of nothing.",
    "Risk comes from not knowing what you're doing.",
    "It's not how much money you make, but how much money you keep.",
    "The four most dangerous words in investing are: 'this time it's different.'",
    "Opportunities come infrequently. When it rains gold, put out the bucket, not the thimble.",
    "The best investment you can make is in yourself.",
  ];

  // Rotate quotes every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % tradingQuotes.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin) {
      // Registration validation
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match!');
        return;
      }
      if (!formData.username.trim()) {
        alert('Username is required!');
        return;
      }
    }

    try {
      if (isLogin) {
        // Login logic - replace with your actual login action
        // dispatch(loginUser({ email: formData.email, password: formData.password }));
        console.log('Login:', { email: formData.email, password: formData.password });
      } else {
        // Registration logic - replace with your actual registration action
        // dispatch(registerUser({ 
        //   email: formData.email, 
        //   password: formData.password, 
        //   username: formData.username 
        // }));
        console.log('Register:', { 
          email: formData.email, 
          password: formData.password, 
          username: formData.username 
        });
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', username: '', confirmPassword: '' });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 50%, ${theme.palette.primary.main}10 100%)`,
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: `linear-gradient(45deg, ${theme.palette.primary.main}30, ${theme.palette.secondary.main}30)`,
          animation: 'float 6s ease-in-out infinite',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '60%',
          right: '15%',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: `linear-gradient(45deg, ${theme.palette.secondary.main}20, ${theme.palette.primary.main}20)`,
          animation: 'float 8s ease-in-out infinite reverse',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          left: '20%',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `linear-gradient(45deg, ${theme.palette.primary.main}25, ${theme.palette.secondary.main}25)`,
          animation: 'float 7s ease-in-out infinite',
        }}
      />

      <Container maxWidth="lg">
        <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
          <Box display="flex" width="100%" maxWidth="1200px" gap={4}>
            
            {/* Left Side - Welcome & Quotes */}
            <Slide direction="right" in={true} timeout={800}>
              <Box
                flex={1}
                display={{ xs: 'none', md: 'flex' }}
                flexDirection="column"
                justifyContent="center"
                sx={{ pr: 4 }}
              >
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 'bold',
                    background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2,
                  }}
                >
                  APTERRA
                </Typography>
                <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
                  Your AI-Powered Trading Companion
                </Typography>

                {/* Feature Cards */}
                <Box display="flex" flexDirection="column" gap={2} mb={4}>
                  <Card sx={{ background: alpha(theme.palette.primary.main, 0.1), border: 'none' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                      <ShowChart sx={{ color: theme.palette.primary.main, mr: 2, fontSize: 30 }} />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          Smart Signals
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          AI-powered trading signals across multiple markets
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  <Card sx={{ background: alpha(theme.palette.secondary.main, 0.1), border: 'none' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                      <AccountBalance sx={{ color: theme.palette.secondary.main, mr: 2, fontSize: 30 }} />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          Portfolio Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Track and manage your trades with precision
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  <Card sx={{ background: alpha(theme.palette.success.main, 0.1), border: 'none' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                      <TrendingUp sx={{ color: theme.palette.success.main, mr: 2, fontSize: 30 }} />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          Real-time Analytics
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Advanced analytics to optimize your trading strategy
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                {/* Rotating Quotes */}
                <Paper
                  sx={{
                    p: 3,
                    background: alpha(theme.palette.background.paper, 0.8),
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  }}
                >
                  <Fade in={true} key={currentQuote} timeout={1000}>
                    <Typography
                      variant="body1"
                      sx={{
                        fontStyle: 'italic',
                        color: theme.palette.text.secondary,
                        textAlign: 'center',
                        minHeight: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      "{tradingQuotes[currentQuote]}"
                    </Typography>
                  </Fade>
                </Paper>
              </Box>
            </Slide>

            {/* Right Side - Login Form */}
            <Slide direction="left" in={true} timeout={800}>
              <Box flex={1} display="flex" justifyContent="center" alignItems="center">
                <Paper
                  elevation={24}
                  sx={{
                    p: 4,
                    width: '100%',
                    maxWidth: '450px',
                    background: alpha(theme.palette.background.paper, 0.95),
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    borderRadius: 3,
                  }}
                >
                  <Box textAlign="center" mb={4}>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 'bold',
                        background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 1,
                      }}
                    >
                      {isLogin ? 'Welcome Back!' : 'Join APTERRA'}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {isLogin 
                        ? 'Sign in to continue your trading journey' 
                        : 'Create your account and start trading smarter'
                      }
                    </Typography>
                  </Box>

                  {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {error}
                    </Alert>
                  )}

                  <form onSubmit={handleSubmit}>
                    <Box display="flex" flexDirection="column" gap={3}>
                      
                      {/* Username Field (Registration Only) */}
                      {!isLogin && (
                        <TextField
                          fullWidth
                          label="Username"
                          value={formData.username}
                          onChange={handleInputChange('username')}
                          required={!isLogin}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Person sx={{ color: theme.palette.primary.main }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&:hover fieldset': {
                                borderColor: theme.palette.primary.main,
                              },
                            },
                          }}
                        />
                      )}

                      {/* Email Field */}
                      <TextField
                        fullWidth
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange('email')}
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Email sx={{ color: theme.palette.primary.main }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: theme.palette.primary.main,
                            },
                          },
                        }}
                      />

                      {/* Password Field */}
                      <TextField
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange('password')}
                        required
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock sx={{ color: theme.palette.primary.main }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': {
                              borderColor: theme.palette.primary.main,
                            },
                          },
                        }}
                      />

                      {/* Confirm Password Field (Registration Only) */}
                      {!isLogin && (
                        <TextField
                          fullWidth
                          label="Confirm Password"
                          type="password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange('confirmPassword')}
                          required={!isLogin}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Lock sx={{ color: theme.palette.primary.main }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&:hover fieldset': {
                                borderColor: theme.palette.primary.main,
                              },
                            },
                          }}
                        />
                      )}

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
                        startIcon={isLogin ? <LoginIcon /> : <PersonAdd />}
                        sx={{
                          py: 1.5,
                          background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                          '&:hover': {
                            background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.primary.main} 90%)`,
                            transform: 'translateY(-2px)',
                            boxShadow: theme.shadows[8],
                          },
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {loading 
                          ? 'Processing...' 
                          : isLogin 
                            ? 'Sign In' 
                            : 'Create Account'
                        }
                      </Button>
                    </Box>
                  </form>

                  <Divider sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      OR
                    </Typography>
                  </Divider>

                  {/* Toggle Login/Register */}
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {isLogin 
                        ? "Don't have an account?" 
                        : "Already have an account?"
                      }
                    </Typography>
                    <Button
                      variant="text"
                      onClick={toggleMode}
                      sx={{
                        color: theme.palette.primary.main,
                        fontWeight: 'bold',
                        '&:hover': {
                          background: alpha(theme.palette.primary.main, 0.1),
                        },
                      }}
                    >
                      {isLogin ? 'Create Account' : 'Sign In'}
                    </Button>
                  </Box>

                  {/* Demo Account Notice */}
                  <Paper
                    sx={{
                      mt: 3,
                      p: 2,
                      background: alpha(theme.palette.info.main, 0.1),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                    }}
                  >
                    <Typography variant="body2" color="info.main" textAlign="center">
                      🎯 Start with $100,000 demo balance to practice risk-free trading!
                    </Typography>
                  </Paper>
                </Paper>
              </Box>
            </Slide>
          </Box>
        </Box>
      </Container>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
        `}
      </style>
    </Box>
  );
};

export default Login;