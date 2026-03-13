'use client';

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 animate-pulse">
        {/* Logo placeholder */}
        <div className="flex justify-center">
          <div className="h-10 w-10 bg-white/5 rounded-lg" />
        </div>

        {/* Heading */}
        <div className="text-center space-y-2">
          <div className="h-8 w-48 bg-white/5 rounded mx-auto" />
          <div className="h-5 w-64 bg-white/5 rounded mx-auto" />
        </div>

        {/* Form card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 space-y-5">
          {/* Email field */}
          <div className="space-y-2">
            <div className="h-4 w-16 bg-white/5 rounded" />
            <div className="h-10 w-full bg-white/5 rounded-lg" />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <div className="h-4 w-20 bg-white/5 rounded" />
            <div className="h-10 w-full bg-white/5 rounded-lg" />
          </div>

          {/* Submit button */}
          <div className="h-11 w-full bg-cyan-500/10 rounded-lg" />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <div className="h-4 w-8 bg-white/5 rounded" />
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Social buttons */}
          <div className="space-y-3">
            <div className="h-10 w-full bg-white/5 rounded-lg" />
            <div className="h-10 w-full bg-white/5 rounded-lg" />
          </div>
        </div>

        {/* Footer link */}
        <div className="h-4 w-56 bg-white/5 rounded mx-auto" />
      </div>
    </div>
  );
}
