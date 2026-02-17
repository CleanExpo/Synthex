'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading skeleton for the Multi-format Generator page.
 * Mirrors the input phase layout: textarea, 9-platform checkbox grid,
 * two dropdown selectors, and a generate button.
 */
export default function MultiFormatLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="h-8 w-60 bg-white/5 rounded" />
          <div className="h-4 w-96 bg-white/5 rounded mt-2" />
        </div>
      </div>

      {/* Input card skeleton */}
      <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
        <CardHeader className="pb-4">
          <div className="h-6 w-48 bg-white/5 rounded" />
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Textarea skeleton */}
          <div className="space-y-2">
            <div className="h-3 w-28 bg-white/5 rounded" />
            <div className="h-36 w-full bg-white/5 rounded-md" />
          </div>

          {/* Platform multi-select skeleton */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-32 bg-white/5 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 bg-white/5 rounded" />
                <div className="h-3 w-8 bg-white/5 rounded" />
              </div>
            </div>

            {/* 9 checkbox items in a 3-col grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-white/5 border border-white/10"
                >
                  <div className="w-4 h-4 rounded border border-white/20 bg-white/5 flex-shrink-0" />
                  <div className="h-4 w-24 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Dropdowns skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-3 w-10 bg-white/5 rounded" />
              <div className="h-10 w-full bg-white/5 rounded-md" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-10 bg-white/5 rounded" />
              <div className="h-10 w-full bg-white/5 rounded-md" />
            </div>
          </div>

          {/* Generate button skeleton */}
          <div className="flex sm:justify-end">
            <div className="h-10 w-full sm:w-44 bg-cyan-500/10 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
