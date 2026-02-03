/**
 * API Error States
 *
 * @description Error handling components for API failures:
 * - Error cards with retry
 * - Error boundaries
 * - Toast notifications
 * - Inline errors
 */

'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, WifiOff, ServerCrash, Lock, Clock } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ErrorType =
  | 'network'
  | 'server'
  | 'auth'
  | 'timeout'
  | 'not-found'
  | 'validation'
  | 'unknown';

interface ErrorConfig {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const ERROR_CONFIGS: Record<ErrorType, ErrorConfig> = {
  network: {
    icon: WifiOff,
    title: 'Connection Error',
    description: 'Unable to connect to the server. Please check your internet connection.',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
  },
  server: {
    icon: ServerCrash,
    title: 'Server Error',
    description: 'Something went wrong on our end. Our team has been notified.',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  auth: {
    icon: Lock,
    title: 'Authentication Error',
    description: 'Your session has expired. Please log in again to continue.',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  timeout: {
    icon: Clock,
    title: 'Request Timeout',
    description: 'The request took too long to complete. Please try again.',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  'not-found': {
    icon: AlertCircle,
    title: 'Not Found',
    description: 'The requested resource could not be found.',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
  },
  validation: {
    icon: AlertCircle,
    title: 'Validation Error',
    description: 'The data provided is invalid. Please check and try again.',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
  unknown: {
    icon: AlertCircle,
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Please try again.',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getErrorType(error: Error | string | unknown): ErrorType {
  const message = error instanceof Error ? error.message : String(error);
  const lowercaseMessage = message.toLowerCase();

  if (lowercaseMessage.includes('network') || lowercaseMessage.includes('fetch')) {
    return 'network';
  }
  if (lowercaseMessage.includes('401') || lowercaseMessage.includes('unauthorized')) {
    return 'auth';
  }
  if (lowercaseMessage.includes('404') || lowercaseMessage.includes('not found')) {
    return 'not-found';
  }
  if (lowercaseMessage.includes('timeout')) {
    return 'timeout';
  }
  if (lowercaseMessage.includes('validation') || lowercaseMessage.includes('invalid')) {
    return 'validation';
  }
  if (lowercaseMessage.includes('500') || lowercaseMessage.includes('server')) {
    return 'server';
  }

  return 'unknown';
}

// ============================================================================
// API ERROR CARD
// ============================================================================

interface APIErrorCardProps {
  error: Error | string | unknown;
  onRetry?: () => void;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function APIErrorCard({
  error,
  onRetry,
  className = '',
  showDetails = false,
  compact = false,
}: APIErrorCardProps) {
  const errorType = getErrorType(error);
  const config = ERROR_CONFIGS[errorType];
  const Icon = config.icon;
  const message = error instanceof Error ? error.message : String(error);

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg ${config.bgColor} ${className}`}
      >
        <Icon className={`h-5 w-5 ${config.color}`} />
        <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
          {config.title}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1.5 rounded-md hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
            aria-label="Retry"
          >
            <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      <div className={`p-6 ${config.bgColor}`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {config.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {config.description}
            </p>
            {showDetails && message && (
              <details className="mt-3">
                <summary className="text-sm text-gray-500 dark:text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                  {message}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
      {onRetry && (
        <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INLINE ERROR
// ============================================================================

interface InlineErrorProps {
  error: Error | string | unknown;
  onRetry?: () => void;
  className?: string;
}

export function InlineError({ error, onRetry, className = '' }: InlineErrorProps) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div
      className={`flex items-center gap-2 text-sm text-red-600 dark:text-red-400 ${className}`}
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-red-700 dark:text-red-300 hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-8">
          <APIErrorCard
            error={this.state.error || 'An unexpected error occurred'}
            onRetry={this.handleReset}
            showDetails={process.env.NODE_ENV === 'development'}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 ${className}`}
    >
      {Icon && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
          <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// LOADING ERROR WRAPPER
// ============================================================================

interface DataStateWrapperProps<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  emptyComponent?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}

export function DataStateWrapper<T>({
  data,
  isLoading,
  error,
  onRetry,
  loadingComponent,
  errorComponent,
  emptyComponent,
  isEmpty = (d) => Array.isArray(d) && d.length === 0,
  children,
}: DataStateWrapperProps<T>) {
  if (isLoading && !data) {
    return <>{loadingComponent || <div className="animate-pulse">Loading...</div>}</>;
  }

  if (error && !data) {
    return (
      <>
        {errorComponent || (
          <APIErrorCard error={error} onRetry={onRetry} showDetails />
        )}
      </>
    );
  }

  if (!data || isEmpty(data)) {
    return (
      <>
        {emptyComponent || (
          <EmptyState
            title="No data available"
            description="There's nothing to display at the moment."
          />
        )}
      </>
    );
  }

  return <>{children(data)}</>;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default APIErrorCard;
