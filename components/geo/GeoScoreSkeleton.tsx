'use client';

/**
 * GeoScoreSkeleton — SYN-657
 *
 * Cold-start and loading skeleton for the GEO Score panel.
 * "Your GEO Score is being calculated — check back tomorrow"
 * Rendered when client_geo_scores has no row for this client.
 */

interface GeoScoreSkeletonProps {
  coldStart?: boolean; // true = no data yet message; false = loading shimmer
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-white/[0.06] rounded ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}

export function GeoScoreSkeleton({ coldStart = false }: GeoScoreSkeletonProps) {
  if (coldStart) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
        {/* Ring placeholder */}
        <div
          className="rounded-full border-2 border-dashed border-white/10 flex items-center justify-center"
          style={{ width: 140, height: 140 }}
          aria-hidden="true"
        >
          <span className="text-white/20 text-2xl font-light">—</span>
        </div>
        <p className="text-sm text-white/40 max-w-xs">
          Your GEO Score is being calculated — check back tomorrow
        </p>
        <p className="text-xs text-white/20">
          Synthex runs the first scan within 24 hours of onboarding
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Ring shimmer */}
      <div className="flex justify-center">
        <div className="animate-pulse bg-white/[0.06] rounded-full" style={{ width: 140, height: 140 }} aria-hidden="true" />
      </div>

      {/* Trend shimmer */}
      <div className="space-y-2">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-36 w-full" />
      </div>

      {/* Action cards shimmer */}
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <Shimmer key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
