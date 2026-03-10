'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function TeamLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-28 bg-white/5 rounded" />
          <div className="h-5 w-64 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
            <CardContent className="p-6">
              <div className="h-4 w-24 bg-white/5 rounded mb-2" />
              <div className="h-8 w-12 bg-white/5 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Members Grid */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="h-6 w-36 bg-white/5 rounded" />
            <div className="h-8 w-48 bg-white/5 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-12 h-12 bg-white/10 rounded-full" />
                <div className="flex-1">
                  <div className="h-5 w-32 bg-white/10 rounded mb-1" />
                  <div className="h-4 w-24 bg-white/10 rounded mb-2" />
                  <div className="h-6 w-16 bg-cyan-500/10 rounded-full" />
                </div>
                <div className="h-8 w-8 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="h-6 w-44 bg-white/5 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full" />
                <div>
                  <div className="h-4 w-40 bg-white/10 rounded mb-1" />
                  <div className="h-3 w-24 bg-white/10 rounded" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-20 bg-white/10 rounded" />
                <div className="h-8 w-20 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
