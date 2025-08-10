// Error tracking and monitoring setup for SYNTHEX

interface ErrorReport {
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  userAgent: string;
  timestamp: string;
  context?: Record<string, any>;
}

interface UserAction {
  action: string;
  element?: string;
  timestamp: string;
  metadata?: Record<string, any>;
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

  captureError(error: Error | string, context?: Record<string, any>) {
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
  trackAction(action: string, element?: string, metadata?: Record<string, any>) {
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
  trackEvent(eventName: string, data?: Record<string, any>) {
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

// React Error Boundary Component
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    if (typeof window !== 'undefined') {
      getMonitoring().captureError(error, {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      });
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Oops! Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              We're sorry for the inconvenience. The error has been reported and we'll fix it soon.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
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