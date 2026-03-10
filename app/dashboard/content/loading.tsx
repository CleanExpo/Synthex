'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ContentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-56 bg-white/5 rounded" />
          <div className="h-5 w-96 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-white/5 rounded" />
          <div className="h-10 w-36 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Generation Settings Panel */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader className="pb-4">
          <div className="h-6 w-48 bg-white/5 rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="h-4 w-20 bg-white/5 rounded mb-2" />
              <div className="h-10 w-full bg-white/5 rounded" />
            </div>
            <div>
              <div className="h-4 w-24 bg-white/5 rounded mb-2" />
              <div className="h-10 w-full bg-white/5 rounded" />
            </div>
            <div>
              <div className="h-4 w-16 bg-white/5 rounded mb-2" />
              <div className="h-10 w-full bg-white/5 rounded" />
            </div>
          </div>
          <div>
            <div className="h-4 w-24 bg-white/5 rounded mb-2" />
            <div className="h-32 w-full bg-white/5 rounded" />
          </div>
        </CardContent>
      </Card>

      {/* Content Preview Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardHeader>
            <div className="h-6 w-36 bg-white/5 rounded" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="h-4 w-full bg-white/5 rounded" />
              <div className="h-4 w-5/6 bg-white/5 rounded" />
              <div className="h-4 w-4/5 bg-white/5 rounded" />
              <div className="h-4 w-full bg-white/5 rounded" />
              <div className="h-4 w-3/4 bg-white/5 rounded" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardHeader>
            <div className="h-6 w-40 bg-white/5 rounded" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/5 rounded" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-white/5 rounded mb-1" />
                    <div className="h-3 w-20 bg-white/5 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
