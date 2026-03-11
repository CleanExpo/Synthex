'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function VoiceLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-9 w-48 bg-white/5 rounded" />
        <div className="h-5 w-80 bg-white/5 rounded mt-2" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <div className="h-10 w-28 bg-white/5 rounded" />
        <div className="h-10 w-32 bg-white/5 rounded" />
        <div className="h-10 w-24 bg-white/5 rounded" />
      </div>

      {/* Text area + action */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardContent className="pt-6 space-y-4">
          <div className="h-40 w-full bg-white/5 rounded" />
          <div className="flex justify-end">
            <div className="h-10 w-32 bg-cyan-500/10 rounded" />
          </div>
        </CardContent>
      </Card>

      {/* Results area */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardContent className="pt-6 space-y-4">
          <div className="h-6 w-40 bg-white/5 rounded" />
          <div className="h-4 w-full bg-white/5 rounded" />
          <div className="h-4 w-3/4 bg-white/5 rounded" />
          <div className="h-32 w-full bg-white/5 rounded" />
        </CardContent>
      </Card>
    </div>
  );
}
