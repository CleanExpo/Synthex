'use client';

/**
 * Performance Overview
 *
 * @description Stats row showing key performance metrics.
 */

import { TrendingUp, FileText, Target, Activity } from '@/components/icons';
import { cn } from '@/lib/utils';

interface PerformanceOverviewProps {
  summary: {
    totalPosts: number;
    avgEngagement: number;
    topPerforming: Array<{ postId: string }>;
    lowPerforming: Array<{ postId: string }>;
  };
  isLoading?: boolean;
  className?: string;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, subValue, color }: StatCardProps) {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', `bg-${color}-500/10`)}>
          <Icon className={cn('w-5 h-5', `text-${color}-400`)} />
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
            <div className="space-y-2">
              <div className="w-20 h-3 bg-white/5 rounded animate-pulse" />
              <div className="w-16 h-6 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PerformanceOverview({
  summary,
  isLoading,
  className,
}: PerformanceOverviewProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const topPerformerPercent =
    summary.totalPosts > 0
      ? Math.round((summary.topPerforming.length / summary.totalPosts) * 100)
      : 0;

  const engagementTrend =
    summary.avgEngagement > 3 ? 'Above average' : summary.avgEngagement > 1 ? 'Average' : 'Below average';

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      <StatCard
        icon={FileText}
        label="Posts Analyzed"
        value={formatNumber(summary.totalPosts)}
        subValue="In selected period"
        color="cyan"
      />
      <StatCard
        icon={Activity}
        label="Avg Engagement"
        value={`${summary.avgEngagement}%`}
        subValue={engagementTrend}
        color="emerald"
      />
      <StatCard
        icon={TrendingUp}
        label="Top Performers"
        value={summary.topPerforming.length}
        subValue={`${topPerformerPercent}% of posts`}
        color="violet"
      />
      <StatCard
        icon={Target}
        label="Need Improvement"
        value={summary.lowPerforming.length}
        subValue="Posts to optimize"
        color="orange"
      />
    </div>
  );
}

export default PerformanceOverview;
