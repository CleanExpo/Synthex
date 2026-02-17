'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export function DashboardError({
  error,
  reset,
  title = 'Something went wrong',
  description = 'An error occurred while loading this page.',
}: DashboardErrorProps) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-gradient-to-br from-red-500/10 to-rose-500/10 backdrop-blur-xl border border-red-500/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <CardTitle className="text-lg text-red-100">{title}</CardTitle>
          <CardDescription className="text-sm text-red-200/70 mt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details className="group">
            <summary className="cursor-pointer text-xs text-red-200/60 hover:text-red-200/80">
              Technical details
            </summary>
            <div className="mt-2 p-2 rounded bg-black/20 text-xs text-red-200/80 break-all">
              {error.message}
            </div>
          </details>
          <div className="flex gap-2">
            <Button
              onClick={reset}
              className="flex-1 bg-red-500/30 hover:bg-red-500/40 text-red-100 border border-red-500/40"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/dashboard'}
              className="bg-white/5 border-white/10 text-red-200/80"
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
