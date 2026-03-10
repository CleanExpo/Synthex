/**
 * AI Chat Loading State
 *
 * @description Skeleton loading state with glassmorphic styling.
 */

export default function AIChatLoading() {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse" />
          <div>
            <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
            <div className="h-3 w-64 bg-white/5 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="h-6 w-24 bg-white/5 rounded-full animate-pulse" />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="w-80 border-r border-white/10 flex flex-col bg-surface-base/30">
          <div className="p-4 border-b border-white/10">
            <div className="h-10 w-full bg-white/5 rounded-lg animate-pulse" />
          </div>
          <div className="flex-1 p-2 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 w-full bg-white/5 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Chat area skeleton */}
        <div className="flex-1 flex items-center justify-center bg-surface-darker">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 animate-pulse mx-auto mb-4" />
            <div className="h-5 w-48 bg-white/5 rounded animate-pulse mx-auto mb-2" />
            <div className="h-4 w-64 bg-white/5 rounded animate-pulse mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
