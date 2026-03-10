'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ScheduleLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-52 bg-white/5 rounded" />
          <div className="h-5 w-80 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-white/5 rounded" />
          <div className="h-10 w-10 bg-white/5 rounded" />
          <div className="h-10 w-32 bg-white/5 rounded" />
          <div className="h-10 w-36 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Calendar Header */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 bg-white/5 rounded" />
              <div className="h-6 w-40 bg-white/5 rounded" />
              <div className="h-8 w-8 bg-white/5 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-white/5 rounded" />
              <div className="h-8 w-20 bg-white/5 rounded" />
              <div className="h-8 w-20 bg-white/5 rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Day Headers */}
          <div className="grid grid-cols-7 gap-px mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((_, i) => (
              <div key={i} className="p-2 text-center">
                <div className="h-4 w-8 mx-auto bg-white/5 rounded" />
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-white/5 rounded-lg overflow-hidden">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="bg-surface-base p-2 min-h-[100px]">
                <div className="h-5 w-5 bg-white/5 rounded mb-2" />
                {i % 5 === 0 && (
                  <div className="h-6 w-full bg-cyan-500/10 rounded mb-1" />
                )}
                {i % 7 === 3 && (
                  <div className="h-6 w-full bg-purple-500/10 rounded" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
