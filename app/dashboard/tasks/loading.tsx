'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function TasksLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-28 bg-white/5 rounded" />
          <div className="h-5 w-64 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 bg-white/5 rounded" />
          <div className="h-10 w-24 bg-white/5 rounded" />
          <div className="h-10 w-32 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* To Do Column */}
        <div className="flex-shrink-0 w-80">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 bg-white/5 rounded" />
                  <div className="h-5 w-6 bg-white/5 rounded-full" />
                </div>
                <div className="h-6 w-6 bg-white/5 rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg">
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-full bg-white/10 rounded mb-3" />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <div className="h-5 w-14 bg-cyan-500/10 rounded-full" />
                      <div className="h-5 w-14 bg-purple-500/10 rounded-full" />
                    </div>
                    <div className="w-6 h-6 bg-white/10 rounded-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* In Progress Column */}
        <div className="flex-shrink-0 w-80">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-24 bg-white/5 rounded" />
                  <div className="h-5 w-6 bg-white/5 rounded-full" />
                </div>
                <div className="h-6 w-6 bg-white/5 rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg">
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-full bg-white/10 rounded mb-3" />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <div className="h-5 w-14 bg-yellow-500/10 rounded-full" />
                    </div>
                    <div className="w-6 h-6 bg-white/10 rounded-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Review Column */}
        <div className="flex-shrink-0 w-80">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 bg-white/5 rounded" />
                  <div className="h-5 w-6 bg-white/5 rounded-full" />
                </div>
                <div className="h-6 w-6 bg-white/5 rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg">
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-full bg-white/10 rounded mb-3" />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <div className="h-5 w-14 bg-blue-500/10 rounded-full" />
                    </div>
                    <div className="w-6 h-6 bg-white/10 rounded-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Done Column */}
        <div className="flex-shrink-0 w-80">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-12 bg-white/5 rounded" />
                  <div className="h-5 w-6 bg-white/5 rounded-full" />
                </div>
                <div className="h-6 w-6 bg-white/5 rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg">
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-full bg-white/10 rounded mb-3" />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <div className="h-5 w-14 bg-green-500/10 rounded-full" />
                    </div>
                    <div className="w-6 h-6 bg-white/10 rounded-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
