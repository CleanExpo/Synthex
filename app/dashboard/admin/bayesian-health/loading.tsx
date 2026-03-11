'use client';

export default function BOHealthLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-9 w-56 bg-white/5 rounded" />
        <div className="h-5 w-80 bg-white/5 rounded mt-2" />
      </div>

      {/* Service status card */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-white/5 rounded" />
          <div className="h-4 w-16 bg-white/5 rounded" />
        </div>
        <div className="h-20 bg-white/5 rounded" />
      </div>

      {/* Spatiotemporal models card */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 space-y-4">
        <div className="h-6 w-44 bg-white/5 rounded" />
        <div className="h-4 w-56 bg-white/5 rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-full bg-white/5 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
