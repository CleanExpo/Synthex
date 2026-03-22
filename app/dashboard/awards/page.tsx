'use client';

/**
 * /dashboard/awards
 *
 * Displays user awards, badges, and recognition milestones.
 * Data is fetched from /api/dashboard/awards via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Trophy, Star, Award } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AwardItem {
  id: string;
  title: string;
  description: string;
  category: 'engagement' | 'content' | 'growth' | 'milestone';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earnedAt: string;
  iconUrl?: string;
}

interface AwardsData {
  total: number;
  recentCount: number;
  awards: AwardItem[];
  nextMilestone?: {
    title: string;
    description: string;
    progress: number;
    target: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

async function fetcher(url: string): Promise<AwardsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load awards (${res.status})`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<AwardItem['tier'], string> = {
  bronze: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  silver: 'text-slate-300 border-slate-300/30 bg-slate-300/10',
  gold: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  platinum: 'text-cyan-300 border-cyan-300/30 bg-cyan-300/10',
};

const CATEGORY_ICONS: Record<AwardItem['category'], React.ReactNode> = {
  engagement: <Star className="h-4 w-4" />,
  content: <Award className="h-4 w-4" />,
  growth: <Trophy className="h-4 w-4" />,
  milestone: <Trophy className="h-4 w-4" />,
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function AwardsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-56 bg-white/[0.05] rounded-sm" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
            <div className="h-5 w-24 bg-white/[0.05] rounded-sm mb-2" />
            <div className="h-8 w-12 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 flex gap-3">
            <div className="h-10 w-10 bg-white/[0.05] rounded-sm flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-white/[0.05] rounded-sm" />
              <div className="h-3 w-full bg-white/[0.05] rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AwardsPage() {
  const { data, error, isLoading } = useSWR<AwardsData>(
    '/api/dashboard/awards',
    fetcher,
    { refreshInterval: 60_000 }
  );

  if (isLoading) return <AwardsSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load awards data. {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Recognition</p>
        <h1 className="text-2xl font-semibold text-white">Awards & Badges</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <p className="text-xs text-white/40 mb-1">Total Earned</p>
          <p className="text-2xl font-semibold text-white">{data.total}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <p className="text-xs text-white/40 mb-1">Last 30 Days</p>
          <p className="text-2xl font-semibold text-amber-400">{data.recentCount}</p>
        </div>
        {data.nextMilestone && (
          <div className="border-[0.5px] border-amber-500/20 bg-amber-500/5 rounded-sm p-4">
            <p className="text-xs text-amber-400/70 mb-1">Next Milestone</p>
            <p className="text-sm font-medium text-amber-300">{data.nextMilestone.title}</p>
            <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${(data.nextMilestone.progress / data.nextMilestone.target) * 100}%` }}
              />
            </div>
            <p className="text-xs text-white/30 mt-1">
              {data.nextMilestone.progress} / {data.nextMilestone.target}
            </p>
          </div>
        )}
      </div>

      {/* Awards grid */}
      <div className="grid grid-cols-2 gap-4">
        {data.awards.map((award) => (
          <div
            key={award.id}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 flex gap-3 hover:border-amber-500/20 transition-colors"
          >
            <div className={`h-10 w-10 rounded-sm border flex items-center justify-center flex-shrink-0 ${TIER_COLORS[award.tier]}`}>
              {CATEGORY_ICONS[award.category]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-white truncate">{award.title}</p>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${TIER_COLORS[award.tier]}`}
                >
                  {award.tier}
                </Badge>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">{award.description}</p>
              <p className="text-[10px] text-white/25 mt-1">
                {new Date(award.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
