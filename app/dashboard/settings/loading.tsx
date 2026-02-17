'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-9 w-32 bg-white/5 rounded" />
        <div className="h-5 w-64 bg-white/5 rounded mt-2" />
      </div>

      {/* Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Sidebar */}
        <Card className="bg-[#0f172a]/80 border border-cyan-500/10 lg:col-span-1">
          <CardContent className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'bg-cyan-500/10' : ''}`}>
                <div className="w-5 h-5 bg-white/5 rounded" />
                <div className="h-4 w-24 bg-white/5 rounded" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Settings Form */}
        <Card className="bg-[#0f172a]/80 border border-cyan-500/10 lg:col-span-3">
          <CardHeader>
            <div className="h-6 w-32 bg-white/5 rounded" />
            <div className="h-4 w-64 bg-white/5 rounded mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Section */}
            <div className="flex items-center gap-4 pb-6 border-b border-white/10">
              <div className="w-20 h-20 bg-white/5 rounded-full" />
              <div>
                <div className="h-5 w-32 bg-white/5 rounded mb-2" />
                <div className="h-8 w-28 bg-white/5 rounded" />
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="h-4 w-20 bg-white/5 rounded mb-2" />
                  <div className="h-10 w-full bg-white/5 rounded" />
                </div>
                <div>
                  <div className="h-4 w-24 bg-white/5 rounded mb-2" />
                  <div className="h-10 w-full bg-white/5 rounded" />
                </div>
              </div>
              <div>
                <div className="h-4 w-16 bg-white/5 rounded mb-2" />
                <div className="h-10 w-full bg-white/5 rounded" />
              </div>
              <div>
                <div className="h-4 w-12 bg-white/5 rounded mb-2" />
                <div className="h-24 w-full bg-white/5 rounded" />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <div className="h-10 w-32 bg-cyan-500/10 rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
