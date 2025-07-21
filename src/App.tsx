import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box, Button } from '@mui/material';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import useWebSocket from './hooks/useWebSocket';
import useSignalNotifications from './hooks/useSignalNotifications';
import autoTradeService from './services/autoTradeService';
import signalCacheService from './services/signalCacheService';
import errorHandlingService from './services/errorHandlingService';
import './chartConfig';

// Components
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import LoadingSpinner from './components/UI/LoadingSpinner';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Signals from './pages/Signals';
import Portfolio from './pages/Portfolio';
import Settings from './pages/Settings';

// Auth actions
import { checkAuthStatus } from './store/slices/authSlice';
import { ThemeSwitcherProvider } from './theme/ThemeContext'; // <-- NEW

// 🔹 Authentication Wrapper Components
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? (
    <>{children}</>
  ) : (
    <Box sx={{ textAlign: 'center', mt: 4 }}>
      <p>You need to log in to access this page.</p>
      <Button variant="contained" color="primary" href="/login">
        Go to Login
      </Button>
    </Box>
  );
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  if (loading) {
    return <LoadingSpinner />;
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

// 🔹 Main Content Component
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { loading, isAuthenticated } = useAppSelector((state) => state.auth);

  // WebSocket connection for real-time updates
  const { isConnected, error: wsError } = useWebSocket({
    onSignalReceived: (signal) => {
      console.log('🎯 Signal received in App:', signal);
      // Cache the signal for performance
      signalCacheService.cacheSignal(signal);
    },
    onPortfolioUpdate: (data) => {
      console.log('💰 Portfolio update received in App:', data);
    },
    onMessage: (message) => {
      console.log('📨 WebSocket message in App:', message.type);
    },
    onError: (error) => {
      console.error('❌ WebSocket error in App:', error);
      errorHandlingService.handleError('websocket', 'WebSocket connection error', error, 'medium');
    }
  });

  // Signal notifications and auto-trade integration
  useSignalNotifications();

  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

  // Log WebSocket connection status
  useEffect(() => {
    if (isAuthenticated) {
      console.log(`🔌 WebSocket connection: ${isConnected ? 'Connected' : 'Disconnected'}`);
      if (wsError) {
        console.error('❌ WebSocket error:', wsError);
      }
    }
  }, [isConnected, wsError, isAuthenticated]);

  return loading ? (
    <LoadingSpinner />
  ) : (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1, pt: { xs: 7, sm: 8 } }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/signals" element={<ProtectedRoute><Signals /></ProtectedRoute>} />
          <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
      <Footer />
    </Box>
  );
};

// 🔹 App Root Wrapper
const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeSwitcherProvider> {/* <-- Use this instead of ThemeProvider */}
        <CssBaseline />
        <Router>
          <AppContent />
        </Router>
      </ThemeSwitcherProvider>
    </Provider>
  );
};

export default App;

