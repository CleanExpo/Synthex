'use client';

export default function ChatLoading() {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/5 rounded-lg" />
          <div>
            <div className="h-6 w-40 bg-white/5 rounded" />
            <div className="h-4 w-56 bg-white/5 rounded mt-1" />
          </div>
        </div>
        <div className="h-6 w-24 bg-white/5 rounded-full" />
      </div>

      {/* Two column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-white/10 p-4 space-y-3">
          <div className="h-10 w-full bg-cyan-500/10 rounded" />
          <div className="h-10 w-full bg-white/5 rounded" />
          <div className="space-y-2 mt-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-white/5 rounded-lg border border-white/[0.05]"
              />
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-surface-darker p-6 space-y-4">
          <div className="h-12 w-3/4 bg-white/5 rounded" />
          <div className="h-12 w-1/2 bg-white/5 rounded ml-auto" />
          <div className="h-12 w-2/3 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  );
}
