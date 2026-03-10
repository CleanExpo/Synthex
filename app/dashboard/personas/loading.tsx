'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function PersonasLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-40 bg-white/5 rounded" />
          <div className="h-5 w-72 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-white/5 rounded" />
          <div className="h-10 w-36 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personas List */}
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardHeader>
            <div className="h-6 w-32 bg-white/5 rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-10 h-10 bg-white/10 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-white/10 rounded mb-1" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
                </div>
                <div className="h-6 w-16 bg-white/10 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Persona Detail */}
        <Card className="lg:col-span-2 bg-surface-base/80 border border-cyan-500/10">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/5 rounded-full" />
              <div>
                <div className="h-6 w-40 bg-white/5 rounded mb-2" />
                <div className="h-4 w-24 bg-white/5 rounded" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Demographics */}
            <div>
              <div className="h-5 w-28 bg-white/5 rounded mb-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="h-3 w-16 bg-white/5 rounded mb-1" />
                    <div className="h-5 w-20 bg-white/5 rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div>
              <div className="h-5 w-24 bg-white/5 rounded mb-3" />
              <div className="flex flex-wrap gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-7 w-20 bg-white/5 rounded-full" />
                ))}
              </div>
            </div>

            {/* Content Preferences */}
            <div>
              <div className="h-5 w-40 bg-white/5 rounded mb-3" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-lg">
                    <div className="h-4 w-20 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-full bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
