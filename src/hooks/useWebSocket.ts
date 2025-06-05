import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import { addSignal, updateSignal } from '../store/slices/signalSlice';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: number;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  market: string;
  description: string;
  timestamp: number;
}

interface UseWebSocketOptions {
  url?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  sendMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    url = process.env.REACT_APP_WS_URL || 'wss://api.apterra.com/ws',
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onOpen,
    onClose,
    onError,
    onMessage,
  } = options;

  const dispatch = useAppDispatch();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);
  
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  const startHeartbeat = useCallback((ws: WebSocket) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000); // Send ping every 30 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle different message types
      switch (message.type) {
        case 'pong':
          // Heartbeat response - no action needed
          break;
          
        case 'market_data':
          // Update market data in Redux store
          dispatch({ type: 'market/updateData', payload: message.data });
          break;
          
        case 'trading_signal':
          // Add new trading signal
          dispatch({ type: 'signals/addSignal', payload: message.data });
          break;
          
        case 'portfolio_update':
          // Update portfolio data
          dispatch({ type: 'portfolio/updatePosition', payload: message.data });
          break;
          
        case 'notification':
          // Show notification
          dispatch({ type: 'notifications/add', payload: message.data });
          break;
          
        case 'error':
          console.error('WebSocket error:', message.data);
          setError(message.data.message || 'Unknown error');
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
      
      // Call custom message handler if provided
      if (onMessage) {
        onMessage(message);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
      setError('Failed to parse message');
    }
  }, [dispatch, onMessage]);

  const connect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wsUrl = token ? `${url}?token=${token}` : url;
      const newSocket = new WebSocket(wsUrl);

      newSocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        // Start heartbeat
        startHeartbeat(newSocket);
        
        // Resubscribe to channels
        subscriptionsRef.current.forEach(channel => {
          newSocket.send(JSON.stringify({
            type: 'subscribe',
            channel,
            timestamp: Date.now()
          }));
        });
        
        if (onOpen) {
          onOpen();
        }
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        stopHeartbeat();
        
        if (onClose) {
          onClose();
        }

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect... (${reconnectAttemptsRef.current}/${reconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= reconnectAttempts) {
          setError('Failed to reconnect after maximum attempts');
        }
      };

      newSocket.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
        setIsConnecting(false);
        
        if (onError) {
          onError(event);
        }
      };

      newSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_signal') {
          dispatch(addSignal(data.signal));
        } else if (data.type === 'update_signal') {
          dispatch(updateSignal(data.signal));
        }
      };

      setSocket(newSocket);
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to create connection');
      setIsConnecting(false);
    }
  }, [url, token, socket, isConnecting, reconnectAttempts, reconnectInterval, startHeartbeat, stopHeartbeat, handleMessage, onOpen, onClose, onError, dispatch]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    if (socket) {
      socket.close(1000, 'Manual disconnect');
      setSocket(null);
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttemptsRef.current = reconnectAttempts; // Prevent auto-reconnect
  }, [socket, reconnectAttempts, stopHeartbeat]);

  const sendMessage = useCallback((message: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: Date.now()
        };
        socket.send(JSON.stringify(messageWithTimestamp));
      } catch (err) {
        console.error('Failed to send message:', err);
        setError('Failed to send message');
      }
    } else {
      console.warn('WebSocket is not connected');
      setError('Not connected');
    }
  }, [socket]);

  const subscribe = useCallback((channel: string) => {
    subscriptionsRef.current.add(channel);
    
    if (socket?.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'subscribe',
        channel
      });
    }
  }, [socket, sendMessage]);

  const unsubscribe = useCallback((channel: string) => {
    subscriptionsRef.current.delete(channel);
    
    if (socket?.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'unsubscribe',
        channel
      });
    }
  }, [socket, sendMessage]);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && !socket && !isConnecting) {
      connect();
    } else if (!isAuthenticated && socket) {
      disconnect();
    }
  }, [isAuthenticated, socket, isConnecting, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    sendMessage,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
};

export default useWebSocket;

// Custom hooks for specific data types
export const useMarketData = (symbols: string[] = []) => {
  const webSocket = useWebSocket();
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});

  useEffect(() => {
    if (webSocket.isConnected && symbols.length > 0) {
      symbols.forEach(symbol => {
        webSocket.subscribe(`market_data:${symbol}`);
      });

      return () => {
        symbols.forEach(symbol => {
          webSocket.unsubscribe(`market_data:${symbol}`);
        });
      };
    }
  }, [webSocket.isConnected, symbols, webSocket]);

  return {
    ...webSocket,
    marketData,
  };
};

export const useTradingSignals = () => {
  const webSocket = useWebSocket();
  const [signals, setSignals] = useState<TradingSignal[]>([]);

  useEffect(() => {
    if (webSocket.isConnected) {
      webSocket.subscribe('trading_signals');

      return () => {
        webSocket.unsubscribe('trading_signals');
      };
    }
  }, [webSocket.isConnected, webSocket]);

  return {
    ...webSocket,
    signals,
  };
};

export const usePortfolioUpdates = () => {
  const webSocket = useWebSocket();

  useEffect(() => {
    if (webSocket.isConnected) {
      webSocket.subscribe('portfolio_updates');

      return () => {
        webSocket.unsubscribe('portfolio_updates');
      };
    }
  }, [webSocket.isConnected, webSocket]);

  return webSocket;
};
export {};