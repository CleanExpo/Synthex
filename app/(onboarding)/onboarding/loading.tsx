'use client';

export default function OnboardingLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Step indicator skeleton */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-40 bg-white/5 rounded" />
          <div className="h-4 w-20 bg-white/5 rounded" />
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full">
          <div className="h-2 w-1/4 bg-cyan-500/20 rounded-full" />
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

      {/* Business profile form skeleton */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-8 w-56 bg-white/5 rounded mx-auto" />
          <div className="h-5 w-72 bg-white/5 rounded mx-auto" />
        </div>

        {/* Form fields */}
        <div className="space-y-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-white/5 rounded" />
              <div className="h-10 w-full bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <div className="h-4 w-28 bg-white/5 rounded" />
          <div className="h-24 w-full bg-white/5 rounded-lg" />
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
