'use client';

export default function ReportBuilderLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 bg-white/5 rounded-lg" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-white/5 rounded-lg" />
          <div className="h-10 w-28 bg-cyan-500/10 rounded-lg" />
        </div>
      </div>

      {/* Builder layout: sidebar + main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar — widget palette */}
        <div className="lg:col-span-1">
          <div className="h-96 w-full bg-white/5 rounded-lg" />
        </div>

        {/* Main content — canvas area */}
        <div className="lg:col-span-3">
          <div className="h-96 w-full bg-white/5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
