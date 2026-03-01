'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function PlatformsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-48 bg-white/5 rounded" />
          <div className="h-5 w-72 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-36 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* 9-Platform Grid (3×3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <Card key={i} className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardContent className="p-6">
              {/* Icon + title row */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-full flex-shrink-0" />
                <div>
                  <div className="h-5 w-32 bg-white/5 rounded" />
                  <div className="h-4 w-24 bg-white/5 rounded mt-1" />
                </div>
              </div>

              {/* Status badge */}
              <div className="h-6 w-20 bg-white/5 rounded mt-3" />

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                <div className="h-8 w-24 bg-white/5 rounded" />
                <div className="h-8 w-24 bg-white/5 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
