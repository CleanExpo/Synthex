/**
 * Loading skeleton for Content Repurposer page
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function RepurposeLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-white/5 rounded-md animate-pulse" />
        <div className="h-5 w-96 bg-white/5 rounded-md animate-pulse" />
      </div>

      {/* Input card skeleton */}
      <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
        <CardHeader className="pb-4">
          <div className="h-6 w-56 bg-white/5 rounded-md animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source type dropdown skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
            <div className="h-10 w-full bg-white/5 rounded-md animate-pulse" />
          </div>

          {/* Textarea skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
            <div className="h-48 w-full bg-white/5 rounded-md animate-pulse" />
          </div>

          {/* Output formats skeleton */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 bg-white/5 rounded-md animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Button skeleton */}
          <div className="flex justify-end">
            <div className="h-10 w-40 bg-white/5 rounded-md animate-pulse" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
