'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from '@/components/icons';
import { Button } from '@/components/ui/button';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AuthError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">
            Authentication Error
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Something went wrong during authentication. Please try again.
          </p>

          {error.message && (
            <details className="mb-6 group text-left">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400">
                Technical details
              </summary>
              <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-mono break-all">
                {error.message}
              </div>
            </details>
          )}

          <div className="flex gap-3">
            <Button
              onClick={reset}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/')}
              className="bg-white/5 border-white/10 text-gray-300 hover:text-white"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </div>

          {error.digest && (
            <p className="mt-6 text-xs text-gray-600">
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
