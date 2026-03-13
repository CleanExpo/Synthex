'use client';

export default function OnboardingGroupLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Progress bar skeleton */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 bg-white/5 rounded" />
          <div className="h-4 w-16 bg-white/5 rounded" />
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full">
          <div className="h-2 w-1/3 bg-cyan-500/20 rounded-full" />
        </div>
        <div className="flex justify-between mt-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 bg-white/5 rounded-full" />
              <div className="h-3 w-16 bg-white/5 rounded hidden sm:block" />
            </div>
          ))}
        </div>
      </div>

      {/* Main content card skeleton */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="h-8 w-64 bg-white/5 rounded mx-auto" />
          <div className="h-5 w-80 bg-white/5 rounded mx-auto" />
        </div>

        {/* Content area */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 w-full bg-white/5 rounded-lg" />
          ))}
        </div>

        {/* Action button */}
        <div className="flex justify-end pt-4">
          <div className="h-11 w-36 bg-cyan-500/10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
