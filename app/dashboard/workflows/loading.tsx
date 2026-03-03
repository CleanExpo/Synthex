/**
 * Workflows page loading skeleton — shown by Next.js during Suspense fallback.
 */
export default function WorkflowsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-white/5 animate-pulse" />
      </div>

      {/* Card skeletons */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white/5 animate-pulse p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-48 rounded bg-white/5" />
              <div className="h-5 w-20 rounded-full bg-white/5" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5" />
            <div className="h-3 w-32 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
