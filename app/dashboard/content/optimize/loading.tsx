'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading skeleton for the Content Optimizer page.
 * Mirrors the split-panel layout: left editor panel (60%) + right scoring panel (40%).
 */
export default function ContentOptimizeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="h-8 w-52 bg-white/5 rounded" />
          <div className="h-4 w-80 bg-white/5 rounded mt-2" />
        </div>
        <div className="h-10 w-40 bg-cyan-500/10 rounded" />
      </div>

      {/* Split-panel skeleton */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left panel skeleton (60%) */}
        <div className="w-full lg:w-[60%] space-y-4">
          <Card className="bg-surface-base/80 border border-cyan-500/10">
            <CardHeader className="pb-4">
              <div className="h-6 w-40 bg-white/5 rounded" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="h-3 w-16 bg-white/5 rounded" />
                  <div className="h-10 w-full bg-white/5 rounded" />
                </div>
                <div className="space-y-1">
                  <div className="h-3 w-12 bg-white/5 rounded" />
                  <div className="h-10 w-full bg-white/5 rounded" />
                </div>
              </div>
              {/* Textarea */}
              <div className="space-y-1">
                <div className="h-3 w-16 bg-white/5 rounded" />
                <div className="h-40 w-full bg-white/5 rounded" />
              </div>
              {/* Character count */}
              <div className="flex justify-between">
                <div className="h-3 w-40 bg-white/5 rounded" />
                <div className="h-3 w-24 bg-white/5 rounded" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right panel skeleton (40%) */}
        <div className="w-full lg:w-[40%] space-y-4">

          {/* Score card skeleton */}
          <Card className="bg-surface-base/80 border border-cyan-500/10">
            <CardHeader className="pb-3">
              <div className="h-6 w-36 bg-white/5 rounded" />
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Score circle */}
              <div className="flex justify-center">
                <div className="w-28 h-28 rounded-full bg-white/5" />
              </div>
              {/* Dimension bars */}
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between">
                      <div className="h-3 w-24 bg-white/5 rounded" />
                      <div className="h-3 w-8 bg-white/5 rounded" />
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Suggestions skeleton */}
          <Card className="bg-surface-base/80 border border-cyan-500/10">
            <CardHeader className="pb-3">
              <div className="h-5 w-32 bg-white/5 rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-white/5 rounded flex-shrink-0 mt-0.5" />
                  <div className="h-4 w-full bg-white/5 rounded" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Templates skeleton */}
          <Card className="bg-surface-base/80 border border-cyan-500/10">
            <CardHeader className="pb-3">
              <div className="h-5 w-40 bg-white/5 rounded" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-white/5 rounded-lg" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
