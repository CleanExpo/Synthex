/**
 * Error Tracking Service
 * Centralized error handling and monitoring
 */

export interface ErrorContext {
  userId?: string;
  action?: string;
  component?: string;
  metadata?: Record<string, any>;
}

export interface TrackedError {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  level: 'error' | 'warning' | 'info';
  context?: ErrorContext;
  userAgent?: string;
  url?: string;
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  private maxErrors = 100;

  /**
   * Track an error
   */
  trackError(error: Error | string, context?: ErrorContext, level: 'error' | 'warning' | 'info' = 'error') {
    const trackedError: TrackedError = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      level,
      context,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    // Add to local storage
    this.errors.push(trackedError);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Error Tracker]', trackedError);
    }

    // Send to monitoring service
    this.sendToMonitoring(trackedError);

    return trackedError;
  }

  /**
   * Send error to monitoring service
   */
  private async sendToMonitoring(error: TrackedError) {
    try {
      // Send to API endpoint
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error)
      });
    } catch (err) {
      console.error('Failed to send error to monitoring:', err);
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10): TrackedError[] {
    return this.errors.slice(-limit);
  }

  /**
   * Clear error history
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Get error statistics
   */
  getStats() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recent = this.errors.filter(e => e.timestamp > last24Hours);
    
    return {
      total: this.errors.length,
      last24Hours: recent.length,
      byLevel: {
        error: recent.filter(e => e.level === 'error').length,
        warning: recent.filter(e => e.level === 'warning').length,
        info: recent.filter(e => e.level === 'info').length
      }
    };
  }
}

// Create singleton instance
export const errorTracker = new ErrorTracker();

/**
 * React Error Boundary Component
 */
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorTracker.trackError(error, {
      component: errorInfo.componentStack || 'Unknown',
      action: 'React Error Boundary'
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
              <p className="text-gray-400 mb-6">
                We encountered an unexpected error. Please try refreshing the page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      errorTracker.trackError(
        event.reason || 'Unhandled Promise Rejection',
        { action: 'unhandledrejection' }
      );
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      errorTracker.trackError(
        event.error || event.message,
        { 
          action: 'global-error',
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      );
    });
  }
}

/**
 * Utility function to safely execute code with error tracking
 */
export async function withErrorTracking<T>(
  fn: () => Promise<T> | T,
  context?: ErrorContext
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    errorTracker.trackError(error as Error, context);
    return null;
  }
}