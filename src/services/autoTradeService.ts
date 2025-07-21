import { TradingSignal } from '../types';
import { store } from '../store';
import { openDemoPosition } from '../store/slices/portfolioSlice';
import { add } from '../store/slices/notificationsSlice';

export interface AutoTradeCriteria {
  enabled: boolean;
  minConfidence: number;
  maxRisk: 'low' | 'medium' | 'high';
  maxPositions: number;
  maxDailyTrades: number;
  allowedMarkets: string[];
  allowedSymbols: string[];
  positionSize: number; // Percentage of balance
  stopLossPercentage: number;
  takeProfitPercentage: number;
  tradingHours: {
    start: string; // HH:mm format
    end: string; // HH:mm format
    timezone: string;
  };
  excludeWeekends: boolean;
  maxDrawdown: number; // Maximum daily loss percentage
}

export interface AutoTradeStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalPnL: number;
  dailyPnL: number;
  tradesToday: number;
  currentDrawdown: number;
  lastTradeTime: string | null;
}

class AutoTradeService {
  private criteria: AutoTradeCriteria;
  private stats: AutoTradeStats;
  private isActive: boolean = false;
  private dailyTrades: number = 0;
  private dailyPnL: number = 0;
  private lastResetDate: string;

  constructor() {
    this.criteria = this.getDefaultCriteria();
    this.stats = this.getDefaultStats();
    this.lastResetDate = new Date().toDateString();
    this.loadSettings();
  }

  public isEnabled(): boolean {
    return this.criteria.enabled;
  }
  

  private getDefaultCriteria(): AutoTradeCriteria {
    return {
      enabled: false,
      minConfidence: 75,
      maxRisk: 'medium',
      maxPositions: 5,
      maxDailyTrades: 10,
      allowedMarkets: ['crypto', 'forex', 'stocks'],
      allowedSymbols: [],
      positionSize: 5, // 5% of balance
      stopLossPercentage: 5,
      takeProfitPercentage: 10,
      tradingHours: {
        start: '09:00',
        end: '17:00',
        timezone: 'UTC'
      },
      excludeWeekends: true,
      maxDrawdown: 10, // 10% max daily loss
    };
  }

  private getDefaultStats(): AutoTradeStats {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalPnL: 0,
      dailyPnL: 0,
      tradesToday: 0,
      currentDrawdown: 0,
      lastTradeTime: null,
    };
  }

  private loadSettings() {
    try {
      const savedCriteria = localStorage.getItem('autoTradeCriteria');
      if (savedCriteria) {
        this.criteria = { ...this.criteria, ...JSON.parse(savedCriteria) };
      }

      const savedStats = localStorage.getItem('autoTradeStats');
      if (savedStats) {
        this.stats = { ...this.stats, ...JSON.parse(savedStats) };
      }
    } catch (error) {
      console.error('Failed to load auto-trade settings:', error);
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem('autoTradeCriteria', JSON.stringify(this.criteria));
      localStorage.setItem('autoTradeStats', JSON.stringify(this.stats));
    } catch (error) {
      console.error('Failed to save auto-trade settings:', error);
    }
  }

  public updateCriteria(newCriteria: Partial<AutoTradeCriteria>) {
    this.criteria = { ...this.criteria, ...newCriteria };
    this.saveSettings();
    
    // Notify user of changes
    store.dispatch(add({
      type: 'info',
      title: 'Auto-Trade Settings Updated',
      message: 'Your auto-trade criteria have been updated successfully.',
    }));
  }

  public getCriteria(): AutoTradeCriteria {
    return { ...this.criteria };
  }

  public getStats(): AutoTradeStats {
    return { ...this.stats };
  }

  public start() {
    if (!this.criteria.enabled) {
      console.log('Auto-trade is disabled');
      return;
    }

    this.isActive = true;
    this.resetDailyStats();
    
    store.dispatch(add({
      type: 'success',
      title: 'Auto-Trade Started',
      message: 'Auto-trade system is now active and monitoring signals.',
      persistent: false,
    }));

    console.log('🤖 Auto-trade service started');
  }

  public stop() {
    this.isActive = false;
    
    store.dispatch(add({
      type: 'warning',
      title: 'Auto-Trade Stopped',
      message: 'Auto-trade system has been stopped.',
      persistent: false,
    }));

    console.log('🛑 Auto-trade service stopped');
  }

  public isRunning(): boolean {
    return this.isActive && this.criteria.enabled;
  }

  private resetDailyStats() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyTrades = 0;
      this.dailyPnL = 0;
      this.lastResetDate = today;
      this.saveSettings();
    }
  }

  private isWithinTradingHours(): boolean {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: this.criteria.tradingHours.timezone 
    });

    // Check if within trading hours
    if (currentTime < this.criteria.tradingHours.start || 
        currentTime > this.criteria.tradingHours.end) {
      return false;
    }

    // Check if weekend trading is allowed
    if (this.criteria.excludeWeekends && (now.getDay() === 0 || now.getDay() === 6)) {
      return false;
    }

    return true;
  }

  private checkDrawdownLimit(): boolean {
    const currentDrawdown = Math.abs(this.dailyPnL);
    const maxDrawdown = this.criteria.maxDrawdown;
    
    if (currentDrawdown >= maxDrawdown) {
      store.dispatch(add({
        type: 'error',
        title: 'Daily Loss Limit Reached',
        message: `Auto-trade stopped: Daily loss limit of ${maxDrawdown}% reached.`,
        persistent: true,
      }));
      return false;
    }
    
    return true;
  }

  private validateSignal(signal: TradingSignal): boolean {
    // Check confidence threshold
    if (signal.confidence < this.criteria.minConfidence) {
      return false;
    }

    // Check risk level
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const signalRiskLevel = riskLevels[signal.risk] || 1;
    const maxRiskLevel = riskLevels[this.criteria.maxRisk];
    
    if (signalRiskLevel > maxRiskLevel) {
      return false;
    }

    // Check allowed markets
    if (!this.criteria.allowedMarkets.includes(signal.market)) {
      return false;
    }

    // Check allowed symbols (if specified)
    if (this.criteria.allowedSymbols.length > 0 && 
        !this.criteria.allowedSymbols.includes(signal.symbol)) {
      return false;
    }

    // Check if we already have max positions
    const state = store.getState();
    const openPositions = state.portfolio.openPositions.length;
    
    if (openPositions >= this.criteria.maxPositions) {
      return false;
    }

    // Check daily trade limit
    if (this.dailyTrades >= this.criteria.maxDailyTrades) {
      return false;
    }

    return true;
  }

  public async processSignal(signal: TradingSignal): Promise<boolean> {
    if (!this.isRunning()) {
      return false;
    }

    this.resetDailyStats();

    // Check trading hours
    if (!this.isWithinTradingHours()) {
      console.log('⏰ Outside trading hours, skipping signal');
      return false;
    }

    // Check drawdown limit
    if (!this.checkDrawdownLimit()) {
      this.stop();
      return false;
    }

    // Validate signal against criteria
    if (!this.validateSignal(signal)) {
      console.log('❌ Signal does not meet auto-trade criteria');
      return false;
    }

    try {
      // Calculate position size based on balance
      const state = store.getState();
      const balance = state.portfolio.balance;
      const positionSize = (balance * this.criteria.positionSize) / 100;

      // Open position
      if (!state.auth.user?.id) throw new Error('User ID is required');
      const result = await store.dispatch(openDemoPosition({
        userId: state.auth.user.id,
        signal: {
          symbol: signal.symbol,
          type: signal.type,
          quantity: positionSize / signal.entryPrice,
          entryPrice: signal.entryPrice,
          targetPrice: signal.targetPrice,
          stopLoss: signal.stopLoss,
          signalId: signal.id,
          market: signal.market,
          timeframe: signal.timeframe
        }
      }));

      if (result.meta.requestStatus === 'fulfilled') {
        // Update stats
        this.dailyTrades++;
        this.stats.totalTrades++;
        this.stats.tradesToday = this.dailyTrades;
        this.stats.lastTradeTime = new Date().toISOString();
        this.saveSettings();

        // Notify user
        store.dispatch(add({
          type: 'success',
          title: 'Auto-Trade Position Opened',
          message: `${signal.symbol} ${signal.type} position opened automatically (${signal.confidence}% confidence)`,
          persistent: false,
        }));

        console.log(`🤖 Auto-trade opened ${signal.symbol} ${signal.type} position`);
        return true;
      } else {
        throw new Error('Failed to open position');
      }
    } catch (error: unknown) {
      console.error('❌ Auto-trade error:', error);
      
      store.dispatch(add({
        type: 'error',
        title: 'Auto-Trade Error',
        message: `Failed to open position for ${signal.symbol}: ${error instanceof Error ? error.message : String(error)}`,
        persistent: false,
      }));
      
      return false;
    }
  }

  public updatePnL(pnl: number) {
    this.dailyPnL += pnl;
    this.stats.dailyPnL = this.dailyPnL;
    this.stats.totalPnL += pnl;
    
    if (pnl > 0) {
      this.stats.successfulTrades++;
    } else {
      this.stats.failedTrades++;
    }
    
    this.saveSettings();
  }

  public resetStats() {
    this.stats = this.getDefaultStats();
    this.dailyTrades = 0;
    this.dailyPnL = 0;
    this.saveSettings();
    
    store.dispatch(add({
      type: 'info',
      title: 'Auto-Trade Stats Reset',
      message: 'Auto-trade statistics have been reset.',
      persistent: false,
    }));
  }

  public getWinRate(): number {
    if (this.stats.totalTrades === 0) return 0;
    return (this.stats.successfulTrades / this.stats.totalTrades) * 100;
  }

  public getAveragePnL(): number {
    if (this.stats.totalTrades === 0) return 0;
    return this.stats.totalPnL / this.stats.totalTrades;
  }
}

// Export singleton instance
export const autoTradeService = new AutoTradeService();
export default autoTradeService; 