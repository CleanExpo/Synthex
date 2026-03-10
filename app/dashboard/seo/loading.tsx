import { Card, CardContent } from '@/components/ui/card';

export default function SEODashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-9 w-48 bg-white/5 rounded" />
          <div className="h-5 w-96 bg-white/5 rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-white/5 rounded" />
          <div className="h-10 w-32 bg-cyan-500/10 rounded" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-white/5 rounded-lg" />
                <div className="w-20 h-5 bg-white/5 rounded" />
              </div>
              <div className="h-8 w-24 bg-white/5 rounded mb-2" />
              <div className="h-4 w-32 bg-white/5 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tools grid skeleton */}
      <div>
        <div className="h-7 w-40 bg-white/5 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-surface-base/80 border border-cyan-500/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-white/5 rounded-xl mb-4" />
                <div className="h-6 w-32 bg-white/5 rounded mb-2" />
                <div className="h-4 w-full bg-white/5 rounded mb-1" />
                <div className="h-4 w-3/4 bg-white/5 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent audits skeleton */}
      <div>
        <div className="h-7 w-40 bg-white/5 rounded mb-4" />
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardContent className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-lg" />
                  <div>
                    <div className="h-5 w-40 bg-white/10 rounded mb-2" />
                    <div className="h-4 w-24 bg-white/10 rounded" />
                  </div>
                </div>
                <div className="h-4 w-20 bg-white/10 rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
