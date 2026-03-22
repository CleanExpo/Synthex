'use client';

/**
 * /dashboard/visuals
 *
 * Visual content performance — image/video engagement analytics.
 * Wired to /api/dashboard/visuals via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Image, Video, BarChart3 } from 'lucide-react';

interface VisualItem {
  id: string;
  type: 'image' | 'video' | 'carousel' | 'reel';
  platform: string;
  thumbnailUrl?: string;
  title?: string;
  publishedAt: string;
  views: number;
  engagement: number;
  engagementRate: number;
  saves: number;
  shares: number;
}

interface VisualsData {
  totalVisuals: number;
  avgEngagementRate: number;
  topPerforming: VisualItem[];
  byType: Array<{ type: string; count: number; avgEngagement: number }>;
  byPlatform: Array<{ platform: string; count: number; avgEngagement: number }>;
  recommendations: string[];
}

async function fetcher(url: string): Promise<VisualsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load visuals data (${res.status})`);
  return res.json();
}

const TYPE_ICON = {
  image: Image,
  video: Video,
  carousel: BarChart3,
  reel: Video,
};

export default function VisualsPage() {
  const { data, error, isLoading } = useSWR<VisualsData>(
    '/api/dashboard/visuals',
    fetcher,
    { refreshInterval: 300_000 }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
              <div className="h-4 w-20 bg-white/[0.05] rounded-sm mb-2" />
              <div className="h-8 w-16 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load visuals data. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Content</p>
        <h1 className="text-2xl font-semibold text-white">Visual Performance</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <p className="text-xs text-white/40 mb-2">Total Visuals</p>
          <p className="text-2xl font-semibold text-white">{data.totalVisuals.toLocaleString()}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <p className="text-xs text-white/40 mb-2">Avg Engagement Rate</p>
          <p className="text-2xl font-semibold text-amber-400">{data.avgEngagementRate.toFixed(2)}%</p>
        </div>
        {data.byType.slice(0, 2).map((type, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
            <p className="text-xs text-white/40 mb-2 capitalize">{type.type}s</p>
            <p className="text-2xl font-semibold text-white">{type.count}</p>
            <p className="text-xs text-white/30 mt-1">{type.avgEngagement.toFixed(1)}% avg eng.</p>
          </div>
        ))}
      </div>

      {/* Platform breakdown */}
      {data.byPlatform.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-white">By Platform</h2>
          </div>
          {data.byPlatform.map((p, i) => (
            <div key={i} className="border-b border-white/[0.04] p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
              <p className="text-sm text-white capitalize">{p.platform}</p>
              <div className="flex items-center gap-4">
                <span className="text-xs text-white/40">{p.count} visuals</span>
                <span className="text-sm font-medium text-amber-400">{p.avgEngagement.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top performing visuals */}
      {data.topPerforming.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white mb-4">Top Performing</h2>
          <div className="grid grid-cols-2 gap-4">
            {data.topPerforming.map((visual) => {
              const Icon = TYPE_ICON[visual.type] ?? Image;
              return (
                <div key={visual.id} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden hover:border-amber-500/20 transition-colors">
                  {visual.thumbnailUrl ? (
                    <div className="aspect-video bg-white/[0.03] relative">
                      <img
                        src={visual.thumbnailUrl}
                        alt={visual.title ?? 'Visual'}
                        className="w-full h-full object-cover opacity-80"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-white/[0.03] flex items-center justify-center">
                      <Icon className="h-8 w-8 text-white/10" />
                    </div>
                  )}
                  <div className="p-3">
                    {visual.title && (
                      <p className="text-xs text-white/70 mb-2 line-clamp-1">{visual.title}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-white/30">Views</p>
                        <p className="text-xs font-medium text-white">{visual.views.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30">Eng. Rate</p>
                        <p className="text-xs font-medium text-amber-400">{visual.engagementRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30">Saves</p>
                        <p className="text-xs font-medium text-white">{visual.saves.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/20 mt-2 flex items-center gap-1">
                      <span className="capitalize">{visual.platform}</span>
                      <span>·</span>
                      <span className="capitalize">{visual.type}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <h2 className="text-sm font-medium text-white mb-3">Visual Strategy Tips</h2>
          <ul className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-white/50 flex gap-2">
                <span className="text-amber-500/60 flex-shrink-0">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
