'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function ForecastingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-9 w-48 bg-white/5 rounded" />
        <div className="h-5 w-80 bg-white/5 rounded mt-2" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <div className="h-10 w-40 bg-white/5 rounded" />
        <div className="h-10 w-48 bg-white/5 rounded" />
      </div>

      {/* Metric selector row */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-40 bg-white/5 rounded" />
            <div className="h-10 w-40 bg-white/5 rounded" />
            <div className="h-10 w-32 bg-white/5 rounded" />
            <div className="h-10 w-28 bg-cyan-500/10 rounded" />
          </div>
        </CardContent>
      </Card>

      {/* Trained models */}
      <div>
        <div className="h-6 w-32 bg-white/5 rounded" />
        <div className="h-4 w-64 bg-white/5 rounded mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-48 bg-white/5 rounded-xl border border-white/[0.05]"
          />
        ))}
      </div>
    </div>
  );
}
