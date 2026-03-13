'use client';

export default function ConnectLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Step indicator skeleton */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-44 bg-white/5 rounded" />
          <div className="h-4 w-20 bg-white/5 rounded" />
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full">
          <div className="h-2 w-2/3 bg-cyan-500/20 rounded-full" />
        </div>
      </div>

      {/* Connect platforms card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-8 w-64 bg-white/5 rounded mx-auto" />
          <div className="h-5 w-80 bg-white/5 rounded mx-auto" />
        </div>

        {/* Platform grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/5"
            >
              <div className="h-10 w-10 bg-white/5 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-white/5 rounded" />
                <div className="h-3 w-32 bg-white/5 rounded" />
              </div>
              <div className="h-8 w-20 bg-cyan-500/10 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between pt-4">
          <div className="h-10 w-24 bg-white/5 rounded-lg" />
          <div className="h-10 w-32 bg-cyan-500/10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
