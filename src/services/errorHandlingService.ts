import { store } from '../store';
import { add } from '../store/slices/notificationsSlice';

export interface ErrorInfo {
  id: string;
  timestamp: number;
  type: 'signal' | 'websocket' | 'api' | 'autoTrade' | 'portfolio' | 'general';
  message: string;
  details?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface FallbackConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  notifyUser: boolean;
  logToConsole: boolean;
}

class ErrorHandlingService {
  private errors: Map<string, ErrorInfo> = new Map();
  private fallbackMode: boolean = false;
  private config: FallbackConfig = {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    notifyUser: true,
    logToConsole: true,
  };

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const savedConfig = localStorage.getItem('errorHandlingConfig');
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
      }
    } catch (error) {
      console.error('Failed to load error handling config:', error);
    }
  }

  private saveConfig() {
    try {
      localStorage.setItem('errorHandlingConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save error handling config:', error);
    }
  }

  public updateConfig(newConfig: Partial<FallbackConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  public getConfig(): FallbackConfig {
    return { ...this.config };
  }

  public handleError(
    type: ErrorInfo['type'],
    message: string,
    details?: any,
    severity: ErrorInfo['severity'] = 'medium'
  ): string {
    const errorId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorInfo: ErrorInfo = {
      id: errorId,
      timestamp: Date.now(),
      type,
      message,
      details,
      severity,
      resolved: false,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    this.errors.set(errorId, errorInfo);

    // Log to console if enabled
    if (this.config.logToConsole) {
      console.error(`[${type.toUpperCase()}] ${message}`, details);
    }

    // Notify user if enabled
    if (this.config.notifyUser) {
      this.notifyUser(errorInfo);
    }

    // Check if we should enter fallback mode
    if (severity === 'critical' || this.shouldEnterFallbackMode()) {
      this.enterFallbackMode();
    }

    return errorId;
  }

  private notifyUser(errorInfo: ErrorInfo) {
    const { type, message, severity } = errorInfo;
    
    let notificationType: 'error' | 'warning' | 'info' = 'info';
    let title = 'System Error';
    
    switch (severity) {
      case 'critical':
        notificationType = 'error';
        title = '🚨 Critical Error';
        break;
      case 'high':
        notificationType = 'error';
        title = '❌ System Error';
        break;
      case 'medium':
        notificationType = 'warning';
        title = '⚠️ Warning';
        break;
      case 'low':
        notificationType = 'info';
        title = 'ℹ️ Information';
        break;
    }

    store.dispatch(add({
      type: notificationType,
      title,
      message: `${type}: ${message}`,
      persistent: severity === 'critical',
    }));
  }

  private shouldEnterFallbackMode(): boolean {
    const recentErrors = Array.from(this.errors.values()).filter(
      error => Date.now() - error.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );

    const criticalErrors = recentErrors.filter(error => error.severity === 'critical').length;
    const highErrors = recentErrors.filter(error => error.severity === 'high').length;

    return criticalErrors > 0 || highErrors >= 3;
  }

  public enterFallbackMode() {
    if (this.fallbackMode) return;

    this.fallbackMode = true;
    
    store.dispatch(add({
      type: 'warning',
      title: '🔄 Fallback Mode Activated',
      message: 'System is running in fallback mode. Some features may be limited.',
      persistent: true,
    }));

    console.log('🔄 Entering fallback mode');
  }

  public exitFallbackMode() {
    if (!this.fallbackMode) return;

    this.fallbackMode = false;
    
    store.dispatch(add({
      type: 'success',
      title: '✅ Normal Mode Restored',
      message: 'System has returned to normal operation.',
      persistent: false,
    }));

    console.log('✅ Exiting fallback mode');
  }

  public isInFallbackMode(): boolean {
    return this.fallbackMode;
  }

  public retryOperation(errorId: string, operation: () => Promise<any>): Promise<any> {
    const error = this.errors.get(errorId);
    if (!error) {
      throw new Error('Error not found');
    }

    if (error.retryCount >= error.maxRetries) {
      this.markErrorResolved(errorId);
      throw new Error(`Max retries exceeded for: ${error.message}`);
    }

    error.retryCount++;
    
    const delay = this.config.exponentialBackoff 
      ? this.config.retryDelay * Math.pow(2, error.retryCount - 1)
      : this.config.retryDelay;

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await operation();
          this.markErrorResolved(errorId);
          resolve(result);
        } catch (retryError) {
          if (error.retryCount >= error.maxRetries) {
            this.markErrorResolved(errorId);
            reject(retryError);
          } else {
            reject(retryError);
          }
        }
      }, delay);
    });
  }

  public markErrorResolved(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  public getErrors(filter?: Partial<ErrorInfo>): ErrorInfo[] {
    let errors = Array.from(this.errors.values());

    if (filter) {
      errors = errors.filter(error => {
        return Object.entries(filter).every(([key, value]) => 
          error[key as keyof ErrorInfo] === value
        );
      });
    }

    return errors.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getActiveErrors(): ErrorInfo[] {
    return this.getErrors({ resolved: false });
  }

  public getErrorStats() {
    const allErrors = Array.from(this.errors.values());
    const activeErrors = allErrors.filter(error => !error.resolved);
    
    const byType = allErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = allErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: allErrors.length,
      active: activeErrors.length,
      resolved: allErrors.length - activeErrors.length,
      byType,
      bySeverity,
      inFallbackMode: this.fallbackMode,
    };
  }

  public clearResolvedErrors(): number {
    const resolvedErrors = Array.from(this.errors.entries()).filter(
      ([, error]) => error.resolved
    );
    
    resolvedErrors.forEach(([id]) => this.errors.delete(id));
    
    return resolvedErrors.length;
  }

  public clearAllErrors(): void {
    this.errors.clear();
  }

  public getErrorById(errorId: string): ErrorInfo | null {
    return this.errors.get(errorId) || null;
  }

  public destroy(): void {
    this.clearAllErrors();
    this.exitFallbackMode();
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();
export default errorHandlingService; 