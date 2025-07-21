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
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  market: string;
  description: string;
  reasoning: string;
  technicalIndicators: {
    rsi?: number;
    macd?: number;
    sma?: number;
    ema?: number;
    bollinger?: {
      upper: number;
      middle: number;
      lower: number;
    };
    mlPredictions?: any;
    source?: string;
    modelUsed?: string;
  };
  status: 'active' | 'executed' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
  executedAt?: string;
  executedPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  tags: string[];
  source: 'ai' | 'manual' | 'copy_trading' | 'enterprise_ml';
  accuracy?: number;
  risk: 'low' | 'medium' | 'high';
  positionSize?: number;
  counterfactuals?: Record<string, any>;
  featureImportance?: Record<string, number>;
  metadata?: {
    processingTime?: number;
    modelsUsed?: string[];
    latency?: number;
  };
}

interface UseWebSocketOptions {
  url?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onSignalReceived?: (signal: TradingSignal) => void;
  onPortfolioUpdate?: (data: any) => void;
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
  lastMessage: WebSocketMessage | null;
  connectionStats: {
    messagesReceived: number;
    messagesSent: number;
    lastPing: number | null;
    lastPong: number | null;
  };
}

const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    url = process.env.REACT_APP_WS_URL || 'ws://localhost:5000',
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onOpen,
    onClose,
    onError,
    onMessage,
    onSignalReceived,
    onPortfolioUpdate,
  } = options;

  const dispatch = useAppDispatch();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);
  
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStats, setConnectionStats] = useState({
    messagesReceived: 0,
    messagesSent: 0,
    lastPing: null as number | null,
    lastPong: null as number | null,
  });
  
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
        const pingMessage = { type: 'ping', timestamp: Date.now() };
        ws.send(JSON.stringify(pingMessage));
        setConnectionStats(prev => ({ ...prev, lastPing: Date.now() }));
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
      setLastMessage(message);
      setConnectionStats(prev => ({ ...prev, messagesReceived: prev.messagesReceived + 1 }));
      
      // Handle different message types
      switch (message.type) {
        case 'pong':
          setConnectionStats(prev => ({ ...prev, lastPong: Date.now() }));
          break;
          
        case 'welcome':
          console.log('🤝 WebSocket welcome message:', message.data);
          break;
          
        case 'new_signal':
          // Handle enterprise ML signals
          const signal = (message as any).signal || message.data;
          if (signal) {
            console.log('🎯 New signal received:', signal);

            // Validate signal structure
            if (signal.symbol && signal.type && signal.confidence) {
              // Add enterprise ML specific validation
              if (signal.source === 'enterprise_ml') {
                console.log('🤖 Enterprise ML Signal:', {
                  symbol: signal.symbol,
                  type: signal.type,
                  confidence: signal.confidence,
                  source: signal.source,
                  metadata: signal.metadata,
                });
              }
              
              dispatch(addSignal(signal));
              
              // Call custom signal handler
              if (onSignalReceived) {
                onSignalReceived(signal);
              }
            } else {
              console.warn('⚠️ Invalid signal structure:', signal);
            }
          }
          break;
          
        case 'update_signal':
          const updatedSignal = (message as any).signal || message.data;
          if (updatedSignal) {
            dispatch(updateSignal(updatedSignal));
          }
          break;
          
        case 'market_data':
          // Update market data in Redux store
          dispatch({ type: 'market/updateData', payload: message.data });
          break;
          
        case 'portfolio_update':
          // Update portfolio data
          dispatch({ type: 'portfolio/updatePosition', payload: message.data });
          
          // Call custom portfolio handler
          if (onPortfolioUpdate) {
            onPortfolioUpdate(message.data);
          }
          break;
          
        case 'position_closed':
          // Handle position closure notifications
          console.log('💰 Position closed:', message.data);
          dispatch({ type: 'portfolio/positionClosed', payload: message.data });
          break;
          
        case 'take_profit_hit':
        case 'stop_loss_hit':
          // Handle automatic position closures
          console.log(`🎯 ${message.type}:`, message.data);
          dispatch({ type: 'portfolio/autoPositionClosed', payload: {
            ...message.data,
            closureType: message.type
          }});
          break;
          
        case 'notification':
          // Show notification
          dispatch({ type: 'notifications/add', payload: message.data });
          break;
          
        case 'error':
          console.error('❌ WebSocket error:', message.data);
          setError(message.data.message || 'Unknown error');
          break;
          
        default:
          console.log('📨 Unknown message type:', message.type, message.data);
      }
      
      // Call custom message handler if provided
      if (onMessage) {
        onMessage(message);
      }
    } catch (err) {
      console.error('❌ Failed to parse WebSocket message:', err);
      setError('Failed to parse message');
    }
  }, [dispatch, onMessage, onSignalReceived, onPortfolioUpdate]);

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
        console.log('🔌 WebSocket connected');
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
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        stopHeartbeat();
        
        if (onClose) {
          onClose();
        }

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Attempting to reconnect... (${reconnectAttemptsRef.current}/${reconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= reconnectAttempts) {
          setError('Failed to reconnect after maximum attempts');
        }
      };

      newSocket.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        setError('Connection error');
        setIsConnecting(false);
        
        if (onError) {
          onError(event);
        }
      };

      newSocket.onmessage = handleMessage;

      setSocket(newSocket);
    } catch (err) {
      console.error('❌ Failed to create WebSocket connection:', err);
      setError('Failed to create connection');
      setIsConnecting(false);
    }
  }, [url, token, socket, isConnecting, reconnectAttempts, reconnectInterval, startHeartbeat, stopHeartbeat, handleMessage, onOpen, onClose, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (socket) {
      socket.close(1000, 'Manual disconnect');
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, [socket]);

  const sendMessage = useCallback((message: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now()
      };
      socket.send(JSON.stringify(messageWithTimestamp));
      setConnectionStats(prev => ({ ...prev, messagesSent: prev.messagesSent + 1 }));
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message');
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
    if (isAuthenticated && !isConnected && !isConnecting) {
      connect();
    }
  }, [isAuthenticated, isConnected, isConnecting, connect]);

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
    lastMessage,
    connectionStats,
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