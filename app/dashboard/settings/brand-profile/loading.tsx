'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function BrandProfileLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-9 w-40 bg-white/5 rounded" />
        <div className="h-5 w-80 bg-white/5 rounded mt-2" />
      </div>

      {/* Brand identity card */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="h-6 w-32 bg-white/5 rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-10 w-full bg-white/5 rounded" />
            <div className="h-10 w-full bg-white/5 rounded" />
          </div>
          <div className="h-20 w-full bg-white/5 rounded" />
          <div className="h-10 w-full bg-white/5 rounded" />
        </CardContent>
      </Card>

      {/* Colours card */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="h-6 w-28 bg-white/5 rounded" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-10 bg-white/5 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
