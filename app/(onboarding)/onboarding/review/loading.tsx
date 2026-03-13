'use client';

export default function ReviewLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Step indicator skeleton */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-36 bg-white/5 rounded" />
          <div className="h-4 w-20 bg-white/5 rounded" />
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full">
          <div className="h-2 w-full bg-cyan-500/20 rounded-full" />
        </div>
      </div>

      {/* Review summary card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-8 w-52 bg-white/5 rounded mx-auto" />
          <div className="h-5 w-72 bg-white/5 rounded mx-auto" />
        </div>

        {/* Summary sections */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white/5 rounded-lg border border-white/5 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white/5 rounded-lg" />
                  <div className="h-5 w-36 bg-white/5 rounded" />
                </div>
                <div className="h-4 w-12 bg-cyan-500/10 rounded" />
              </div>
              <div className="h-4 w-3/4 bg-white/5 rounded" />
              <div className="h-4 w-1/2 bg-white/5 rounded" />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between pt-4">
          <div className="h-10 w-24 bg-white/5 rounded-lg" />
          <div className="h-11 w-44 bg-cyan-500/10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
