// Error tracking and monitoring setup for SYNTHEX

interface ErrorReport {
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  userAgent: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface UserAction {
  action: string;
  element?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

class MonitoringService {
  private errorQueue: ErrorReport[] = [];
  private actionQueue: UserAction[] = [];
  private sessionId: string;
  private userId?: string;
  private flushInterval: number = 30000; // 30 seconds
  private maxQueueSize: number = 50;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined') {
      // Global error handler
      window.addEventListener('error', this.handleError.bind(this));
      window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
      
      // Start flush interval
      this.intervalId = setInterval(() => {
        this.flush();
      }, this.flushInterval);

      // Flush on page unload
      window.addEventListener('beforeunload', () => {
        this.flush(true);
      });
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setUser(userId: string) {
    this.userId = userId;
  }

  // Error tracking
  private handleError(event: ErrorEvent) {
    const error: ErrorReport = {
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      url: event.filename,
      line: event.lineno,
      column: event.colno,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      context: {
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
      },
    };

    this.addError(error);
  }

  private handlePromiseRejection(event: PromiseRejectionEvent) {
    const error: ErrorReport = {
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      context: {
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        reason: event.reason,
      },
    };

    this.addError(error);
  }

  captureError(error: Error | string, context?: Record<string, unknown>) {
    const errorReport: ErrorReport = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      context: {
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        ...context,
      },
    };

    this.addError(errorReport);
  }

  private addError(error: ErrorReport) {
    this.errorQueue.push(error);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', error);
    }

    // Flush if queue is full
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  // User action tracking
  trackAction(action: string, element?: string, metadata?: Record<string, unknown>) {
    const userAction: UserAction = {
      action,
      element,
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        ...metadata,
      },
    };

    this.actionQueue.push(userAction);

    // Flush if queue is full
    if (this.actionQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  // Performance tracking
  trackPerformance(metrics: Record<string, number>) {
    this.trackAction('performance', undefined, { metrics });
  }

  // Custom event tracking
  trackEvent(eventName: string, data?: Record<string, unknown>) {
    this.trackAction('custom_event', eventName, data);
  }

  // Flush queues to server
  private async flush(immediate: boolean = false) {
    if (this.errorQueue.length === 0 && this.actionQueue.length === 0) {
      return;
    }

    const payload = {
      sessionId: this.sessionId,
      userId: this.userId,
      errors: [...this.errorQueue],
      actions: [...this.actionQueue],
      timestamp: new Date().toISOString(),
    };

    // Clear queues
    this.errorQueue = [];
    this.actionQueue = [];

    try {
      const method = immediate ? 'sendBeacon' : 'fetch';
      
      if (immediate && 'sendBeacon' in navigator) {
        // Use sendBeacon for immediate flush (page unload)
        navigator.sendBeacon(
          '/api/monitoring/events',
          JSON.stringify(payload)
        );
      } else {
        // Use fetch for regular flush
        await fetch('/api/monitoring/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (error) {
      console.error('Failed to send monitoring data:', error);
      // Re-add items to queue if send failed
      if (!immediate) {
        this.errorQueue.push(...payload.errors);
        this.actionQueue.push(...payload.actions);
      }
    }
  }

  // Clean up
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.flush(true);
  }
}

// Create singleton instance
let monitoringInstance: MonitoringService | null = null;

export function getMonitoring(): MonitoringService {
  if (!monitoringInstance && typeof window !== 'undefined') {
    monitoringInstance = new MonitoringService();
  }
  return monitoringInstance!;
}


// Utility functions for monitoring
export function withMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  actionName: string
): T {
  return ((...args: Parameters<T>) => {
    const monitoring = getMonitoring();
    const startTime = performance.now();
    
    try {
      const result = fn(...args);
      
      // Handle async functions
      if (result instanceof Promise) {
        return result
          .then((value) => {
            const duration = performance.now() - startTime;
            monitoring.trackAction(actionName, undefined, {
              success: true,
              duration,
            });
            return value;
          })
          .catch((error) => {
            const duration = performance.now() - startTime;
            monitoring.captureError(error, {
              action: actionName,
              duration,
            });
            throw error;
          });
      }
      
      // Handle sync functions
      const duration = performance.now() - startTime;
      monitoring.trackAction(actionName, undefined, {
        success: true,
        duration,
      });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      monitoring.captureError(error as Error, {
        action: actionName,
        duration,
      });
      throw error;
    }
  }) as T;
}

// Export monitoring hooks for React
export function useMonitoring() {
  const monitoring = getMonitoring();
  
  return {
    trackAction: monitoring.trackAction.bind(monitoring),
    trackEvent: monitoring.trackEvent.bind(monitoring),
    captureError: monitoring.captureError.bind(monitoring),
    setUser: monitoring.setUser.bind(monitoring),
  };
}