'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ExperimentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-48 bg-white/5 rounded" />
          <div className="h-5 w-72 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-white/5 rounded" />
          <div className="h-10 w-28 bg-cyan-500/10 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-white/5 rounded-lg" />
                <div className="w-16 h-5 bg-white/5 rounded" />
              </div>
              <div className="h-7 w-20 bg-white/5 rounded mb-2" />
              <div className="h-4 w-32 bg-white/5 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader className="pb-2">
          <div className="h-6 w-40 bg-white/5 rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full bg-white/5 rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
