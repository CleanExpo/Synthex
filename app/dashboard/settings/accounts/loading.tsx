'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AccountsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <div className="h-8 w-36 bg-white/5 rounded" />

      {/* Header */}
      <div>
        <div className="h-9 w-44 bg-white/5 rounded" />
        <div className="h-5 w-64 bg-white/5 rounded mt-2" />
      </div>

      {/* Auth methods card */}
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader>
          <div className="h-6 w-52 bg-white/5 rounded" />
          <div className="h-4 w-72 bg-white/5 rounded mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-white/5 rounded-full" />
                <div>
                  <div className="h-5 w-28 bg-white/5 rounded" />
                  <div className="h-3 w-40 bg-white/5 rounded mt-1" />
                </div>
              </div>
              <div className="h-8 w-20 bg-white/5 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
