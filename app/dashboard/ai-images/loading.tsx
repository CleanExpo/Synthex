/**
 * AI Images Loading State
 *
 * @description Skeleton loading state with glassmorphic styling.
 */

export default function AIImagesLoading() {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse" />
          <div>
            <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
            <div className="h-3 w-64 bg-white/5 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="h-6 w-24 bg-white/5 rounded-full animate-pulse" />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Generator panel skeleton */}
        <div className="w-full lg:w-[450px] lg:border-r border-white/10 p-6 bg-[#0f172a]/30">
          <div className="space-y-6">
            {/* Card header */}
            <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />

            {/* Prompt area */}
            <div className="h-20 w-full bg-white/5 rounded-xl animate-pulse" />

            {/* Style presets */}
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-white/5 rounded-xl animate-pulse"
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>

            {/* Generate button */}
            <div className="h-12 w-full bg-cyan-500/20 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Gallery panel skeleton */}
        <div className="flex-1 p-6 bg-[#0a0f1a]">
          <div className="mb-4">
            <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
          </div>

          {/* Empty state placeholder */}
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-white/5 animate-pulse mb-4" />
            <div className="h-4 w-40 bg-white/5 rounded animate-pulse mb-2" />
            <div className="h-3 w-56 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
