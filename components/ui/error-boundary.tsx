'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw, MessageCircle, Home } from '@/components/icons';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { cn } from '@/lib/utils';

/**
 * Error Boundary Component for React applications
 *
 * Provides a user-friendly error UI with retry functionality
 * and optional error reporting capabilities.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallbackTitle="Dashboard Error"
 *   onError={(error, info) => logToSentry(error, info)}
 * >
 *   <DashboardContent />
 * </ErrorBoundary>
 * ```
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom title for the error fallback UI */
  fallbackTitle?: string;
  /** Custom description for the error fallback UI */
  fallbackDescription?: string;
  /** Callback when an error is caught - useful for logging to external services */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to show the "Report Issue" button */
  showReportButton?: boolean;
  /** Custom report URL or handler */
  onReport?: () => void;
  /** Whether to show the "Go Home" button */
  showHomeButton?: boolean;
  /** Custom home URL */
  homeUrl?: string;
  /** Custom className for the error container */
  className?: string;
  /** Custom fallback component */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

// Glass morphism styles for consistency with the design system
const glassStyles = {
  base: 'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06]',
  destructive: 'bg-gradient-to-br from-red-500/10 to-rose-500/10 backdrop-blur-xl border border-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.05)_inset,0_4px_24px_rgba(239,68,68,0.1)]',
  button: 'bg-white/[0.05] backdrop-blur-md border border-white/[0.1] hover:bg-white/[0.1]',
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Store error info in state for display
    this.setState({ errorInfo });

    // Call the optional onError callback for external logging (e.g., Sentry)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to any configured error tracking service
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details that would be sent to an error tracking service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    // In production, this would send to Sentry, LogRocket, etc.
    console.error('[ErrorBoundary] Error report:', errorReport);
  }

  handleRetry = (): void => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  handleReport = (): void => {
    if (this.props.onReport) {
      this.props.onReport();
      return;
    }

    // Copy error details to clipboard and show a toast with support info
    const details = [
      `Error occurred at: ${new Date().toISOString()}`,
      `Page: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}`,
      `Error: ${this.state.error?.message || 'Unknown error'}`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(details).then(
        () => {
          toast.info('Error details copied to clipboard. If this persists, contact support@synthex.social or visit the Help Center.', {
            duration: 6000,
            action: {
              label: 'Help Center',
              onClick: () => { window.location.href = '/dashboard/help'; },
            },
          });
        },
        () => {
          toast.info('If this persists, contact support@synthex.social or visit the Help Center.', {
            duration: 6000,
            action: {
              label: 'Help Center',
              onClick: () => { window.location.href = '/dashboard/help'; },
            },
          });
        }
      );
    } else {
      toast.info('If this persists, contact support@synthex.social or visit the Help Center.', {
        duration: 6000,
        action: {
          label: 'Help Center',
          onClick: () => { window.location.href = '/dashboard/help'; },
        },
      });
    }
  };

  handleGoHome = (): void => {
    const homeUrl = this.props.homeUrl || '/';
    if (typeof window !== 'undefined') {
      window.location.href = homeUrl;
    }
  };

  render(): React.ReactNode {
    const {
      children,
      fallbackTitle = 'Something went wrong',
      fallbackDescription = 'We encountered an unexpected error. Please try again or contact support if the problem persists.',
      showReportButton = true,
      showHomeButton = true,
      className,
      fallback,
    } = this.props;

    if (this.state.hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      return (
        <div className={cn(
          'min-h-[400px] flex items-center justify-center p-4 sm:p-6',
          className
        )}>
          <Card className={cn(glassStyles.destructive, 'max-w-lg w-full')}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
              </div>
              <CardTitle className="text-lg sm:text-xl text-red-100">
                {fallbackTitle}
              </CardTitle>
              <CardDescription className="text-sm text-red-200/70 mt-2">
                {fallbackDescription}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error Details (collapsed by default for non-technical users) */}
              <details className="group">
                <summary className="cursor-pointer text-xs sm:text-sm text-red-200/60 hover:text-red-200/80 transition-colors">
                  Show technical details
                </summary>
                <div className="mt-3 p-3 rounded-lg bg-black/20 overflow-auto max-h-32">
                  <code className="text-xs text-red-200/80 whitespace-pre-wrap break-all">
                    {this.state.error?.message || 'No error message available'}
                  </code>
                </div>
              </details>

              {/* Retry count indicator */}
              {this.state.retryCount > 0 && (
                <p className="text-xs text-red-200/50 text-center">
                  Retry attempts: {this.state.retryCount}
                </p>
              )}
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
              {/* Primary action: Retry */}
              <Button
                onClick={this.handleRetry}
                className={cn(
                  'w-full sm:flex-1',
                  'bg-red-500/30 hover:bg-red-500/40 text-red-100 border border-red-500/40 hover:border-red-500/60'
                )}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              {/* Secondary actions */}
              <div className="flex gap-2 w-full sm:w-auto">
                {showReportButton && (
                  <Button
                    variant="outline"
                    onClick={this.handleReport}
                    className={cn(glassStyles.button, 'flex-1 sm:flex-none text-red-200/80')}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Report</span>
                    <span className="sm:hidden">Report</span>
                  </Button>
                )}

                {showHomeButton && (
                  <Button
                    variant="outline"
                    onClick={this.handleGoHome}
                    className={cn(glassStyles.button, 'flex-1 sm:flex-none text-red-200/80')}
                  >
                    <Home className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Go Home</span>
                    <span className="sm:hidden">Home</span>
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return children;
  }
}

/**
 * Functional component wrapper for the ErrorBoundary
 * Useful for hooks-based error handling patterns
 */
interface ErrorBoundaryWrapperProps extends ErrorBoundaryProps {
  resetKey?: string | number;
}

export function ErrorBoundaryWrapper({
  children,
  resetKey,
  ...props
}: ErrorBoundaryWrapperProps): React.ReactElement {
  return (
    <ErrorBoundary key={resetKey} {...props}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Hook for triggering error boundary from functional components
 * Usage: const throwError = useErrorBoundary();
 *        throwError(new Error('Something went wrong'));
 */
export function useErrorBoundary(): (error: Error) => void {
  const [, setError] = React.useState<Error | null>(null);

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}

/**
 * Simple error fallback component for inline use
 */
interface InlineErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function InlineErrorFallback({
  message = 'Failed to load this section',
  onRetry,
  className,
}: InlineErrorFallbackProps): React.ReactElement {
  return (
    <div className={cn(
      'p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center',
      className
    )}>
      <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="text-red-300 hover:text-red-200 hover:bg-red-500/20"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}

export default ErrorBoundary;
