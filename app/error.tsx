'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  ChevronLeft,
} from '@/components/icons';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log error to error reporting service
    console.error('Application error:', error);

    // SYN-906: ship to Sentry — the React error boundary catches errors
    // BEFORE window.onerror fires, so Sentry's automatic global handlers
    // don't see them. We have to explicitly captureException here.
    // Sentry.init() is booted from app/_sentry-init.tsx; if NEXT_PUBLIC_
    // SENTRY_DSN isn't set, captureException is a no-op (safe).
    void import('@sentry/react')
      .then(Sentry => {
        Sentry.captureException(error, {
          tags: {
            boundary: 'app/error.tsx',
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

    // SYN-904: also ship to Axiom via the existing error-tracker. Note that
    // the tracker's reportToAxiom() reads process.env.AXIOM_TOKEN which is
    // server-only, so this branch is currently a no-op in the browser. Kept
    // for forward-compatibility in case AXIOM_TOKEN is later exposed via an
    // API tunnel similar to the Sentry one.
    void import('@/lib/observability/error-tracker')
      .then(({ trackError, ErrorSeverity, ErrorCategory }) => {
        trackError(error, {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.INTERNAL,
          operation: 'app/error.tsx',
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <Card variant="glass" className="p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Oops! Something went wrong
          </h1>

          <p className="text-gray-400 mb-6">
            We encountered an unexpected error. Don't worry, we're on it!
          </p>

          {error.message && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-300 font-mono">{error.message}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} className="gradient-primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="bg-white/5 border-white/10"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-500">
              Error ID: {error.digest || 'Unknown'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
