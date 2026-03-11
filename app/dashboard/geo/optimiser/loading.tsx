'use client';

export default function GEOOptimiserLoading() {
  return (
    <div className="h-full p-6 animate-pulse">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="h-7 w-36 bg-white/5 rounded" />
          <div className="h-4 w-64 bg-white/5 rounded mt-2" />
        </div>
        <div className="h-10 w-16 bg-white/5 rounded" />
      </div>

      {/* Main grid: Scores | Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 h-[calc(100vh-200px)]">
        {/* Left panel: Tactic scores */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 bg-white/5 rounded-xl border border-white/[0.05]"
            />
          ))}
        </div>

        {/* Right panel: Editor */}
        <div className="bg-white/5 rounded-xl border border-white/[0.05] h-full" />
      </div>
    </div>
  );
}
