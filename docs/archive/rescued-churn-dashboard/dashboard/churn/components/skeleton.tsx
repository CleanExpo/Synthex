import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title Skeleton */}
      <div className="h-8 w-64 bg-sx-bg-tertiary rounded animate-pulse" />

      {/* Skeleton Tables */}
      {[1, 2, 3].map(i => (
        <div key={i} className="border rounded-md overflow-hidden">
          {/* Table Header Skeleton */}
          <div className="grid grid-cols-6 gap-4 p-4 bg-sx-bg-tertiary">
            {[1, 2, 3, 4, 5, 6].map(j => (
              <div
                key={j}
                className="h-4 bg-sx-bg-secondary rounded animate-pulse"
              />
            ))}
          </div>
          {/* Table Body Skeleton */}
          <div className="divide-y divide-sx-border">
            {[1, 2, 3].map(row => (
              <div key={row} className="grid grid-cols-6 gap-4 p-4">
                {[1, 2, 3, 4, 5, 6].map(cell => (
                  <div
                    key={cell}
                    className="h-4 bg-sx-bg-secondary rounded animate-pulse"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Metrics Skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="border rounded-md p-4">
            <div className="h-4 bg-sx-bg-tertiary rounded w-1/2 mb-2" />
            <div className="h-8 bg-sx-bg-secondary rounded w-2/3 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function APIErrorCard({
  error,
  className = '',
}: {
  error: string;
  className?: string;
}) {
  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-md ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="h-6 w-6 shrink-0 text-red-600"
          aria-hidden="true"
        />
        <div>
          <h3 className="font-medium text-red-900">Error</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      </div>
    </div>
  );
}
