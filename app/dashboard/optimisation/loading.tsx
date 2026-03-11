'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function OptimisationLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-9 w-48 bg-white/5 rounded" />
        <div className="h-5 w-80 bg-white/5 rounded mt-2" />
      </div>

      {/* Active Optimisation Spaces */}
      <div>
        <div className="h-6 w-48 bg-white/5 rounded" />
        <div className="h-4 w-72 bg-white/5 rounded mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-48 bg-white/5 rounded-xl border border-white/[0.05]"
          />
        ))}
      </div>

      {/* Run History */}
      <div>
        <div className="h-6 w-28 bg-white/5 rounded" />
        <div className="h-4 w-56 bg-white/5 rounded mt-2" />
      </div>
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardContent className="pt-6 space-y-3">
          <div className="h-8 w-full bg-white/5 rounded" />
          <div className="h-8 w-full bg-white/5 rounded" />
          <div className="h-8 w-full bg-white/5 rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
