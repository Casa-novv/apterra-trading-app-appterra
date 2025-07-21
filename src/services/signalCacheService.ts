import { TradingSignal } from '../types';

interface CachedSignal {
  signal: TradingSignal;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

class SignalCacheService {
  private cache: Map<string, CachedSignal> = new Map();
  private maxSize: number = 1000;
  private ttl: number = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private cleanup() {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.ttl) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    expiredKeys.forEach(key => this.cache.delete(key));

    // If still over max size, remove least recently used
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  public getCachedSignal(signalId: string): TradingSignal | null {
    const cached = this.cache.get(signalId);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(signalId);
      return null;
    }

    // Update access stats
    cached.accessCount++;
    cached.lastAccessed = Date.now();

    return cached.signal;
  }

  public cacheSignal(signal: TradingSignal): void {
    const cached: CachedSignal = {
      signal,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(signal.id, cached);
  }

  public cacheSignals(signals: TradingSignal[]): void {
    signals.forEach(signal => this.cacheSignal(signal));
  }

  public updateCachedSignal(signal: TradingSignal): void {
    const existing = this.cache.get(signal.id);
    if (existing) {
      existing.signal = signal;
      existing.timestamp = Date.now();
      existing.lastAccessed = Date.now();
    } else {
      this.cacheSignal(signal);
    }
  }

  public removeCachedSignal(signalId: string): boolean {
    return this.cache.delete(signalId);
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats() {
    const now = Date.now();
    const totalEntries = this.cache.size;
    let expiredEntries = 0;
    let totalAccessCount = 0;
    let avgAccessCount = 0;

    for (const cached of this.cache.values()) {
      if (now - cached.timestamp > this.ttl) {
        expiredEntries++;
      }
      totalAccessCount += cached.accessCount;
    }

    if (totalEntries > 0) {
      avgAccessCount = totalAccessCount / totalEntries;
    }

    return {
      totalEntries,
      expiredEntries,
      totalAccessCount,
      avgAccessCount,
      maxSize: this.maxSize,
      ttl: this.ttl,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  private getMemoryUsage(): number {
    // Rough estimation of memory usage
    let size = 0;
    for (const [key, cached] of this.cache.entries()) {
      size += key.length;
      size += JSON.stringify(cached.signal).length;
      size += 24; // Timestamp, accessCount, lastAccessed
    }
    return size;
  }

  public setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
    this.cleanup(); // Clean up if needed
  }

  public setTTL(ttl: number): void {
    this.ttl = ttl;
    this.cleanup(); // Clean up if needed
  }

  public getPopularSignals(limit: number = 10): TradingSignal[] {
    const entries = Array.from(this.cache.values());
    entries.sort((a, b) => b.accessCount - a.accessCount);
    return entries.slice(0, limit).map(cached => cached.signal);
  }

  public getRecentSignals(limit: number = 10): TradingSignal[] {
    const entries = Array.from(this.cache.values());
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit).map(cached => cached.signal);
  }

  public searchSignals(query: string): TradingSignal[] {
    const results: TradingSignal[] = [];
    const lowerQuery = query.toLowerCase();

    for (const cached of this.cache.values()) {
      const signal = cached.signal;
      if (
        signal.symbol.toLowerCase().includes(lowerQuery) ||
        signal.description.toLowerCase().includes(lowerQuery) ||
        signal.market.toLowerCase().includes(lowerQuery) ||
        signal.type.toLowerCase().includes(lowerQuery)
      ) {
        results.push(signal);
      }
    }

    return results;
  }

  public getSignalsByMarket(market: string): TradingSignal[] {
    const results: TradingSignal[] = [];
    
    for (const cached of this.cache.values()) {
      if (cached.signal.market === market) {
        results.push(cached.signal);
      }
    }

    return results;
  }

  public getSignalsByConfidence(minConfidence: number): TradingSignal[] {
    const results: TradingSignal[] = [];
    
    for (const cached of this.cache.values()) {
      if (cached.signal.confidence >= minConfidence) {
        results.push(cached.signal);
      }
    }

    return results;
  }

  public destroy(): void {
    this.stopCleanup();
    this.clearCache();
  }
}

// Export singleton instance
export const signalCacheService = new SignalCacheService();
export default signalCacheService; 