import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import { add } from '../store/slices/notificationsSlice';
import { TradingSignal } from '../types';
import autoTradeService from '../services/autoTradeService';

export const useSignalNotifications = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { signals } = useAppSelector((state) => state.signals);

  const handleNewSignal = useCallback(async (signal: TradingSignal) => {
    if (!isAuthenticated) return;

    // Show notification for new signals
    if (signal.source === 'enterprise_ml') {
      dispatch(add({
        type: 'info',
        title: '🤖 Enterprise ML Signal',
        message: `${signal.symbol} ${signal.type} signal (${signal.confidence}% confidence)`,
        persistent: false,
      }));

      // Process with auto-trade if enabled
      if (autoTradeService.isRunning()) {
        const processed = await autoTradeService.processSignal(signal);
        if (processed) {
                  dispatch(add({
          type: 'success',
          title: '🤖 Auto-Trade Executed',
          message: `Automatically opened ${signal.symbol} position`,
          persistent: false,
        }));
        }
      }
    } else {
      dispatch(add({
        type: 'info',
        title: '📊 New Trading Signal',
        message: `${signal.symbol} ${signal.type} signal received`,
        persistent: false,
      }));
    }
  }, [dispatch, isAuthenticated]);

  const handleSignalUpdate = useCallback((signal: TradingSignal) => {
    if (!isAuthenticated) return;

    dispatch(add({
      type: 'warning',
      title: '📈 Signal Updated',
      message: `${signal.symbol} signal has been updated`,
      persistent: false,
    }));
  }, [dispatch, isAuthenticated]);

  const handleSignalExpired = useCallback((signal: TradingSignal) => {
    if (!isAuthenticated) return;

    dispatch(add({
      type: 'warning',
      title: '⏰ Signal Expired',
      message: `${signal.symbol} signal has expired`,
      persistent: false,
    }));
  }, [dispatch, isAuthenticated]);

  const handleHighConfidenceSignal = useCallback((signal: TradingSignal) => {
    if (!isAuthenticated || signal.confidence < 85) return;

    dispatch(add({
      type: 'success',
      title: '🎯 High Confidence Signal',
      message: `${signal.symbol} signal with ${signal.confidence}% confidence`,
      persistent: true,
    }));
  }, [dispatch, isAuthenticated]);

  const handleRiskAlert = useCallback((signal: TradingSignal) => {
    if (!isAuthenticated || signal.risk !== 'high') return;

    dispatch(add({
      type: 'error',
      title: '⚠️ High Risk Signal',
      message: `${signal.symbol} signal marked as high risk`,
      persistent: true,
    }));
  }, [dispatch, isAuthenticated]);

  // Monitor signals for changes
  useEffect(() => {
    if (!isAuthenticated || signals.length === 0) return;

    const latestSignal = signals[0];
    
    // Check if this is a new signal (created in last 30 seconds)
    const signalAge = Date.now() - new Date(latestSignal.createdAt).getTime();
    if (signalAge < 30000) {
      handleNewSignal(latestSignal);
      handleHighConfidenceSignal(latestSignal);
      handleRiskAlert(latestSignal);
    }
  }, [signals, isAuthenticated, handleNewSignal, handleHighConfidenceSignal, handleRiskAlert]);

  return {
    handleNewSignal,
    handleSignalUpdate,
    handleSignalExpired,
    handleHighConfidenceSignal,
    handleRiskAlert,
  };
};

export default useSignalNotifications; 