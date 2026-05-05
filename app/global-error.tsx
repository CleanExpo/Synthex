'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertOctagon, RefreshCw } from '@/components/icons';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // SYN-904 + SYN-906: same observability path as app/error.tsx. The
    // global error boundary covers errors that escape the route-segment
    // boundary — exactly when we MOST need the trace, because by definition
    // the app shell is broken at that point.
    //
    // Sentry note: this file renders its own <html><body>, replacing the
    // root layout entirely, so app/_sentry-init.tsx may NOT have run when
    // we hit this path. captureException will still no-op cleanly if
    // Sentry isn't initialised yet (no DSN registered → silent return).
    console.error('Critical application error:', error);

    void import('@sentry/react')
      .then(Sentry => {
        Sentry.captureException(error, {
          tags: {
            boundary: 'app/global-error.tsx',
            digest: error.digest ?? 'none',
          },
          extra: {
            pathname:
              typeof window !== 'undefined' ? window.location.pathname : null,
          },
        });
      })
      .catch(() => {
        // Never let a failed import crash the error UI itself.
      });

    void import('@/lib/observability/error-tracker')
      .then(({ trackError, ErrorSeverity, ErrorCategory }) => {
        trackError(error, {
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.INTERNAL,
          operation: 'app/global-error.tsx',
          metadata: {
            digest: error.digest ?? null,
            name: error.name,
            pathname:
              typeof window !== 'undefined' ? window.location.pathname : null,
          },
        });
      })
      .catch(() => {
        // Never let a failed import crash the error UI itself.
      });
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900/20 to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-8 text-center border border-red-500/30">
              {/* Critical Error Icon */}
              <div className="w-24 h-24 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center animate-pulse">
                <AlertOctagon className="h-12 w-12 text-red-400" />
              </div>

              <h1 className="text-3xl font-bold text-white mb-2">
                Critical Error
              </h1>

              <p className="text-gray-400 mb-6">
                A critical error has occurred and the application needs to
                restart.
              </p>

              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-300 font-mono">
                  {error.message || 'An unexpected error occurred'}
                </p>
              </div>

              <Button
                onClick={reset}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart Application
              </Button>

              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  If this error persists, please contact support
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Error ID: {error.digest || 'No ID available'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
