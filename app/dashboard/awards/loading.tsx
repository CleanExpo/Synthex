'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AwardsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-48 bg-white/5 rounded" />
          <div className="h-5 w-80 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="h-8 w-12 bg-white/5 rounded" />
            <div className="h-4 w-20 bg-white/5 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <div className="h-10 w-20 bg-white/5 rounded" />
        <div className="h-10 w-28 bg-white/5 rounded" />
        <div className="h-10 w-24 bg-white/5 rounded" />
        <div className="h-10 w-28 bg-white/5 rounded" />
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
            <CardHeader>
              <div className="h-6 w-40 bg-white/5 rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full bg-white/5 rounded" />
              <div className="h-4 w-2/3 bg-white/5 rounded" />
              <div className="h-8 w-24 bg-cyan-500/10 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
