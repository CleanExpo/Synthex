'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function IntegrationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-44 bg-white/5 rounded" />
          <div className="h-5 w-80 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-white/5 rounded" />
        </div>
      </div>

      {/* Connected Platforms */}
      <div>
        <div className="h-6 w-48 bg-white/5 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-[#0f172a]/80 border border-cyan-500/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/5 rounded-xl" />
                    <div>
                      <div className="h-5 w-24 bg-white/5 rounded mb-1" />
                      <div className="h-3 w-16 bg-white/5 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-20 bg-green-500/10 rounded-full" />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <div className="h-3 w-20 bg-white/5 rounded" />
                    <div className="h-3 w-16 bg-white/5 rounded" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 w-24 bg-white/5 rounded" />
                    <div className="h-3 w-12 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 flex-1 bg-white/5 rounded" />
                  <div className="h-8 w-8 bg-white/5 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Available Integrations */}
      <div>
        <div className="h-6 w-48 bg-white/5 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-[#0f172a]/80 border border-white/10 border-dashed">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl" />
                  <div>
                    <div className="h-5 w-24 bg-white/5 rounded mb-1" />
                    <div className="h-3 w-32 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="h-10 w-full bg-cyan-500/10 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
