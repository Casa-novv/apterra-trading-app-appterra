// Core types for the trading app

export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type SubscriptionTier = 'FREE' | 'PREMIUM';
export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export type TradeType = 'buy' | 'sell';
export type PositionStatus = 'open' | 'closed';
export type SignalSource = 'ai' | 'manual' | 'copy_trading' | 'enterprise_ml';
export type SignalStatus = 'active' | 'executed' | 'expired' | 'cancelled';

export interface TradingSignal {
  id: string;
  symbol: string;
  type: SignalType;
  confidence: number;
  entryPrice: number;
  targetPrice: number; // Renamed from takeProfit for consistency
  stopLoss: number;
  timeframe: string;
  market: 'forex' | 'crypto' | 'stocks' | 'commodities';
  description: string;
  reasoning: string;
  technicalIndicators?: {
    rsi?: number;
    macd?: number;
    sma?: number;
    ema?: number;
    bollinger?: {
      upper: number;
      middle: number;
      lower: number;
    };
    // Enterprise ML specific indicators
    mlPredictions?: any;
    source?: string;
    modelUsed?: string;
  };
  status: SignalStatus;
  createdAt: string;
  expiresAt: string;
  executedAt?: string;
  executedPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  tags: string[];
  source: SignalSource;
  accuracy?: number;
  risk: 'low' | 'medium' | 'high';
  
  // Enterprise ML specific fields
  positionSize?: number;
  counterfactuals?: Record<string, any>;
  featureImportance?: Record<string, number>;
  metadata?: {
    processingTime?: number;
    modelsUsed?: string[];
    latency?: number;
  };
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string; // For profile images
  subscriptionTier: SubscriptionTier;
  preferences: UserPreferences;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserPreferences {
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  preferredAssets: string[];
  notificationSettings: {
    signals: boolean;
    news: boolean;
    portfolio: boolean;
  };
}

export interface Portfolio {
  totalValue: number;
  positions: Position[];
  performance: PerformanceMetrics;
  dailyPnL: number;
  dailyPnLPercentage: number;
  totalPnL: number;
  totalPnLPercentage: number;
  activePositions: Position[];
  currency?: string; // e.g. 'USD'
  news?: NewsItem[]; // Relevant news for portfolio
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  timestamp: Date;
  status?: PositionStatus; // 'open' | 'closed'
  closedAt?: Date;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: Date;
  source: string;
  sentiment: Sentiment;
  relevantSymbols: string[];
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  type: TradeType;
  timestamp: string;
  executedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TradeExecution {
  id: string;
  tradeId: string;
  executedPrice: number;
  executedQuantity: number;
  timestamp: Date;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  createdAt: Date;
  link?: string; // Optional link for action
}

export interface PerformanceChartProps {
  data: any;
  timeframe: '1D' | '1W' | '1M' | '3M' | '1Y';
  height: number;
}