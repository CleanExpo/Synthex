'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CitationLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-48 bg-white/5 rounded" />
          <div className="h-5 w-80 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 bg-white/5 rounded" />
          <div className="h-10 w-32 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Score gauge + stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
            <CardContent className="pt-6 space-y-2">
              <div className="h-8 w-16 bg-white/5 rounded" />
              <div className="h-4 w-24 bg-white/5 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="h-6 w-40 bg-white/5 rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full bg-white/5 rounded" />
        </CardContent>
      </Card>

      {/* Activity feed + pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardHeader>
            <div className="h-6 w-36 bg-white/5 rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 w-full bg-white/5 rounded" />
            ))}
          </CardContent>
        </Card>
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardHeader>
            <div className="h-6 w-44 bg-white/5 rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 w-full bg-white/5 rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
