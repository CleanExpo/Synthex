'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-48 bg-white/5 rounded" />
          <div className="h-5 w-72 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-white/5 rounded" />
          <div className="h-10 w-28 bg-white/5 rounded" />
          <div className="h-10 w-32 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-white/5 rounded-lg" />
                <div className="w-16 h-5 bg-white/5 rounded" />
              </div>
              <div className="h-8 w-24 bg-white/5 rounded mb-2" />
              <div className="h-4 w-32 bg-white/5 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart placeholder */}
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-6 w-40 bg-white/5 rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-20 bg-white/5 rounded" />
                <div className="h-8 w-20 bg-white/5 rounded" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full bg-white/5 rounded" />
          </CardContent>
        </Card>

        {/* List placeholder */}
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardHeader>
            <div className="h-6 w-40 bg-white/5 rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 h-12 bg-white/5 rounded px-3">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-white/5 rounded mb-1" />
                  <div className="h-3 w-20 bg-white/5 rounded" />
                </div>
                <div className="h-5 w-16 bg-white/5 rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
