'use client';

export default function WebProjectsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-40 bg-white/5 rounded" />
          <div className="h-5 w-72 bg-white/5 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-cyan-500/10 rounded" />
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-44 bg-white/5 rounded-xl border border-white/[0.05]"
          />
        ))}
      </div>
    </div>
  );
}
