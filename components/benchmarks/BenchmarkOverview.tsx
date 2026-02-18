'use client';

/**
 * Benchmark Overview
 *
 * @description Overall benchmark score display with stats
 * and quick insights summary.
 */

import { Target, BarChart3, Award, TrendingUp } from '@/components/icons';
import { cn } from '@/lib/utils';
import { BenchmarkGauge, BenchmarkGaugeSkeleton } from './BenchmarkGauge';
import type { BenchmarkReport } from '@/lib/analytics/benchmark-service';

interface BenchmarkOverviewProps {
  report: BenchmarkReport | null;
  platformsAnalyzed?: number;
  postsAnalyzed?: number;
  isLoading?: boolean;
  className?: string;
}

interface StatItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}

function StatItem({ icon: Icon, label, value, color }: StatItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', `bg-${color}-500/10`)}>
        <Icon className={cn('w-4 h-4', `text-${color}-400`)} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Gauge skeleton */}
        <div className="flex-shrink-0">
          <BenchmarkGaugeSkeleton size="lg" />
        </div>

        {/* Stats skeleton */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
                <div className="space-y-1">
                  <div className="w-16 h-3 bg-white/5 rounded animate-pulse" />
                  <div className="w-12 h-4 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Insights skeleton */}
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${80 - i * 15}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BenchmarkOverview({
  report,
  platformsAnalyzed = 0,
  postsAnalyzed = 0,
  isLoading,
  className,
}: BenchmarkOverviewProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!report || report.byPlatform.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-8 text-center', className)}>
        <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-white mb-1">No Benchmark Data</h3>
        <p className="text-gray-500 text-sm">
          Connect platforms and publish content to see benchmark comparisons.
        </p>
      </div>
    );
  }

  // Find best performing platform
  const bestPlatform = [...report.byPlatform].sort((a, b) => b.overallScore - a.overallScore)[0];

  // Count metrics compared (4 metrics per platform)
  const metricsCompared = report.byPlatform.length * 4;

  return (
    <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-6', className)}>
      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Main gauge */}
        <div className="flex-shrink-0">
          <BenchmarkGauge
            value={report.overall.score}
            rating={report.overall.rating}
            label="Overall Performance"
            size="lg"
          />
        </div>

        {/* Stats and insights */}
        <div className="flex-1 w-full">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <StatItem
              icon={BarChart3}
              label="Platforms"
              value={platformsAnalyzed}
              color="cyan"
            />
            <StatItem
              icon={Target}
              label="Metrics Compared"
              value={metricsCompared}
              color="violet"
            />
            <StatItem
              icon={TrendingUp}
              label="Posts Analyzed"
              value={postsAnalyzed}
              color="emerald"
            />
            <StatItem
              icon={Award}
              label="Top Performer"
              value={formatPlatformName(bestPlatform.platform)}
              color="orange"
            />
          </div>

          {/* Quick insights */}
          {report.insights.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Quick Insights
              </h4>
              <ul className="space-y-1">
                {report.insights.slice(0, 3).map((insight, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPlatformName(platform: string): string {
  const names: Record<string, string> = {
    instagram: 'Instagram',
    twitter: 'Twitter',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    pinterest: 'Pinterest',
    reddit: 'Reddit',
    threads: 'Threads',
  };
  return names[platform.toLowerCase()] || platform;
}

export default BenchmarkOverview;
