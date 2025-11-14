/**
 * Fallback Monitoring Service
 * Tracks fallback events when platform data is unavailable and mock data is used
 * Provides debugging capabilities and statistics for production troubleshooting
 */

export type FallbackType = 'pipeline_health' | 'crm_integrity';

export type FallbackReason =
  | 'platform_disabled'
  | 'client_not_initialized'
  | 'platform_fetch_failed'
  | 'platform_error';

export type FallbackSeverity = 'info' | 'warning' | 'error';

export interface FallbackEvent {
  type: FallbackType;
  reason: FallbackReason;
  severity: FallbackSeverity;
  timestamp: number;
  error?: string;
  errorStack?: string;
  usePlatformViews: boolean;
}

export interface FallbackStats {
  totalCount: number;
  lastOccurrence: number | null;
  mostCommonReason: FallbackReason | null;
  eventsByType: Record<FallbackType, number>;
  eventsByReason: Record<FallbackReason, number>;
  events: FallbackEvent[];
}

class FallbackMonitor {
  private events: FallbackEvent[] = [];
  private readonly maxEvents = 100; // Keep last 100 events in memory
  private readonly sessionStorageKey = 'fallback_monitor_events';
  private readonly isDevelopment = import.meta.env.DEV;

  constructor() {
    // Load events from sessionStorage in development mode
    if (this.isDevelopment) {
      this.loadFromSessionStorage();
    }
  }

  /**
   * Track a fallback event
   */
  trackFallback(event: Omit<FallbackEvent, 'timestamp'>): void {
    const fullEvent: FallbackEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    // Keep only the last maxEvents
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Persist to sessionStorage in development
    if (this.isDevelopment) {
      this.saveToSessionStorage();
    }

    // Log to console in development
    if (this.isDevelopment) {
      this.logToConsole(fullEvent);
    }
  }

  /**
   * Get statistics about fallback events
   */
  getFallbackStats(): FallbackStats {
    const eventsByType: Record<FallbackType, number> = {
      pipeline_health: 0,
      crm_integrity: 0,
    };

    const eventsByReason: Record<FallbackReason, number> = {
      platform_disabled: 0,
      client_not_initialized: 0,
      platform_fetch_failed: 0,
      platform_error: 0,
    };

    this.events.forEach((event) => {
      eventsByType[event.type]++;
      eventsByReason[event.reason]++;
    });

    const mostCommonReason = this.getMostCommonReason(eventsByReason);
    const lastOccurrence = this.events.length > 0 
      ? this.events[this.events.length - 1].timestamp 
      : null;

    return {
      totalCount: this.events.length,
      lastOccurrence,
      mostCommonReason,
      eventsByType,
      eventsByReason,
      events: [...this.events],
    };
  }

  /**
   * Clear all tracked events
   */
  clearEvents(): void {
    this.events = [];
    if (this.isDevelopment) {
      sessionStorage.removeItem(this.sessionStorageKey);
      console.info('[FallbackMonitor] Events cleared');
    }
  }

  /**
   * Get the most recent fallback event
   */
  getLastEvent(): FallbackEvent | null {
    return this.events.length > 0 ? this.events[this.events.length - 1] : null;
  }

  /**
   * Check if there have been repeated failures (3+ in last 5 minutes)
   */
  hasRepeatedFailures(): boolean {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentEvents = this.events.filter(
      (e) => e.timestamp > fiveMinutesAgo && e.severity === 'error'
    );
    return recentEvents.length >= 3;
  }

  /**
   * Get current data source status
   */
  getDataSourceStatus(): {
    usingMockData: boolean;
    severity: FallbackSeverity;
    message: string;
  } {
    const lastEvent = this.getLastEvent();
    
    if (!lastEvent) {
      return {
        usingMockData: false,
        severity: 'info',
        message: 'Using live platform data',
      };
    }

    const hasRepeatedFailures = this.hasRepeatedFailures();
    
    if (lastEvent.reason === 'platform_disabled') {
      return {
        usingMockData: true,
        severity: 'info',
        message: 'Using mock data - platform views disabled (development mode)',
      };
    }

    if (hasRepeatedFailures) {
      return {
        usingMockData: true,
        severity: 'error',
        message: 'Platform connection failed repeatedly - using mock data',
      };
    }

    if (lastEvent.reason === 'platform_fetch_failed' || lastEvent.reason === 'platform_error') {
      return {
        usingMockData: true,
        severity: 'warning',
        message: 'Platform temporarily unavailable - using mock data',
      };
    }

    if (lastEvent.reason === 'client_not_initialized') {
      return {
        usingMockData: true,
        severity: 'warning',
        message: 'Platform client not initialized - using mock data',
      };
    }

    return {
      usingMockData: true,
      severity: 'info',
      message: 'Using mock data',
    };
  }

  /**
   * Print fallback statistics to console (development only)
   */
  printStats(): void {
    if (!this.isDevelopment) return;

    const stats = this.getFallbackStats();
    
    console.log('\n📊 Fallback Monitor Statistics:');
    console.log('━'.repeat(50));
    console.table({
      'Total Events': stats.totalCount,
      'Last Occurrence': stats.lastOccurrence 
        ? new Date(stats.lastOccurrence).toLocaleString() 
        : 'Never',
      'Most Common Reason': stats.mostCommonReason || 'N/A',
    });

    console.log('\n📈 Events by Type:');
    console.table(stats.eventsByType);

    console.log('\n📉 Events by Reason:');
    console.table(stats.eventsByReason);

    if (stats.events.length > 0) {
      console.log('\n📜 Recent Events (last 10):');
      const recentEvents = stats.events.slice(-10).map((e) => ({
        Type: e.type,
        Reason: e.reason,
        Severity: e.severity,
        Time: new Date(e.timestamp).toLocaleTimeString(),
        Error: e.error || '-',
      }));
      console.table(recentEvents);
    }

    console.log('━'.repeat(50) + '\n');
  }

  // Private methods

  private getMostCommonReason(
    eventsByReason: Record<FallbackReason, number>
  ): FallbackReason | null {
    let maxCount = 0;
    let mostCommon: FallbackReason | null = null;

    Object.entries(eventsByReason).forEach(([reason, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = reason as FallbackReason;
      }
    });

    return mostCommon;
  }

  private logToConsole(event: FallbackEvent): void {
    const emoji = event.severity === 'error' ? '🔴' : event.severity === 'warning' ? '🟡' : '🔵';
    const logMethod = event.severity === 'error' ? console.error : 
                     event.severity === 'warning' ? console.warn : 
                     console.info;

    logMethod(`${emoji} [FallbackMonitor] ${event.type} fallback`, {
      reason: event.reason,
      severity: event.severity,
      timestamp: new Date(event.timestamp).toISOString(),
      usePlatformViews: event.usePlatformViews,
      error: event.error,
      stack: event.errorStack,
    });
  }

  private saveToSessionStorage(): void {
    try {
      sessionStorage.setItem(
        this.sessionStorageKey,
        JSON.stringify(this.events)
      );
    } catch (error) {
      console.warn('[FallbackMonitor] Failed to save to sessionStorage:', error);
    }
  }

  private loadFromSessionStorage(): void {
    try {
      const stored = sessionStorage.getItem(this.sessionStorageKey);
      if (stored) {
        this.events = JSON.parse(stored);
        console.info(`[FallbackMonitor] Loaded ${this.events.length} events from sessionStorage`);
      }
    } catch (error) {
      console.warn('[FallbackMonitor] Failed to load from sessionStorage:', error);
      this.events = [];
    }
  }
}

// Singleton instance
const fallbackMonitor = new FallbackMonitor();

// Export instance and types
export default fallbackMonitor;

// Expose to window object in development for debugging
if (import.meta.env.DEV) {
  (window as any).fallbackMonitor = fallbackMonitor;
  console.info('💡 FallbackMonitor available at window.fallbackMonitor');
  console.info('   Methods: trackFallback(), getFallbackStats(), clearEvents(), printStats()');
}
