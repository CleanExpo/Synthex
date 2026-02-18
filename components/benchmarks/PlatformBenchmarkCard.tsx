'use client';

/**
 * Platform Benchmark Card
 *
 * @description Shows metric comparisons for a single platform
 * with progress bars and delta indicators.
 */

import { cn } from '@/lib/utils';
import {
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Facebook,
} from '@/components/icons';
import type { PlatformReport, BenchmarkComparison } from '@/lib/analytics/benchmark-service';

// Platform icons
type IconComponent = React.ComponentType<{ className?: string }>;
const PLATFORM_ICONS: Record<string, IconComponent> = {
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  facebook: Facebook,
};

// Fallback icon for platforms without a dedicated icon
import { Globe } from '@/components/icons';

interface PlatformBenchmarkCardProps {
  report: PlatformReport;
  className?: string;
}

const RATING_COLORS = {
  below: { text: 'text-red-400', bg: 'bg-red-500', badge: 'bg-red-500/10 text-red-400' },
  average: { text: 'text-yellow-400', bg: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-400' },
  good: { text: 'text-green-400', bg: 'bg-green-500', badge: 'bg-green-500/10 text-green-400' },
  excellent: { text: 'text-cyan-400', bg: 'bg-cyan-500', badge: 'bg-cyan-500/10 text-cyan-400' },
};

const RATING_LABELS = {
  below: 'Below Average',
  average: 'Average',
  good: 'Good',
  excellent: 'Excellent',
};

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

function MetricRow({ comparison }: { comparison: BenchmarkComparison }) {
  const colors = RATING_COLORS[comparison.rating];
  const deltaSign = comparison.delta >= 0 ? '+' : '';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{comparison.displayName}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {comparison.userValue.toFixed(1)}{comparison.unit}
          </span>
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              comparison.delta >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            )}
          >
            {deltaSign}{comparison.deltaPercent}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors.bg)}
          style={{ width: `${Math.min(100, comparison.percentile)}%` }}
        />
      </div>

      {/* Benchmark reference */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>Avg: {comparison.benchmark.average}{comparison.unit}</span>
        <span>{comparison.percentile}th percentile</span>
      </div>
    </div>
  );
}

export function PlatformBenchmarkCard({
  report,
  className,
}: PlatformBenchmarkCardProps) {
  const Icon = PLATFORM_ICONS[report.platform.toLowerCase()] || Globe;
  const colors = RATING_COLORS[report.overallRating];

  return (
    <div
      className={cn(
        'bg-gray-900/50 border border-white/10 rounded-xl p-5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-lg">
            <Icon className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <h3 className="font-medium text-white">
              {formatPlatformName(report.platform)}
            </h3>
            <p className="text-xs text-gray-500">
              Score: {report.overallScore}
            </p>
          </div>
        </div>

        {/* Rating badge */}
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', colors.badge)}>
          {RATING_LABELS[report.overallRating]}
        </span>
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        {report.comparisons.map((comparison) => (
          <MetricRow key={comparison.metric} comparison={comparison} />
        ))}
      </div>
    </div>
  );
}

// Loading skeleton
export function PlatformBenchmarkCardSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
            <div className="w-16 h-3 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-20 h-6 bg-white/5 rounded-full animate-pulse" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="w-28 h-4 bg-white/5 rounded animate-pulse" />
              <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="h-1.5 bg-white/10 rounded-full" />
            <div className="flex justify-between">
              <div className="w-16 h-3 bg-white/5 rounded animate-pulse" />
              <div className="w-20 h-3 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlatformBenchmarkCard;
