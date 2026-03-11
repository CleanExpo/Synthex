'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 bg-white/5 rounded" />
        <div className="flex-1">
          <div className="h-8 w-56 bg-white/5 rounded" />
          <div className="h-4 w-80 bg-white/5 rounded mt-2" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-white/[0.08]">
        <div className="h-10 w-24 bg-white/5 rounded" />
        <div className="h-10 w-28 bg-white/5 rounded" />
        <div className="h-10 w-36 bg-white/5 rounded" />
        <div className="h-10 w-24 bg-white/5 rounded" />
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-white/5 rounded-xl border border-white/[0.05]"
          />
        ))}
      </div>

      {/* Detail card */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardContent className="pt-6 space-y-4">
          <div className="h-6 w-36 bg-white/5 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-10 w-full bg-white/5 rounded" />
            <div className="h-10 w-full bg-white/5 rounded" />
            <div className="h-20 w-full bg-white/5 rounded sm:col-span-2" />
            <div className="h-10 w-full bg-white/5 rounded" />
            <div className="h-10 w-full bg-white/5 rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
