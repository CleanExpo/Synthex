'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function SentinelLoading() {
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

      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <div className="h-10 w-20 bg-white/5 rounded" />
        <div className="h-10 w-20 bg-white/5 rounded" />
        <div className="h-10 w-28 bg-white/5 rounded" />
      </div>

      {/* Health card + chart */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="h-6 w-36 bg-white/5 rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 w-24 bg-white/5 rounded" />
          <div className="h-48 w-full bg-white/5 rounded" />
        </CardContent>
      </Card>

      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="h-6 w-40 bg-white/5 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-full bg-white/5 rounded" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
