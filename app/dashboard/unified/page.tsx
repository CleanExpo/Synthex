'use client';

/**
 * Unified Dashboard Page
 *
 * @description All-platform metrics view with aggregated stats,
 * platform cards, and comparison charts.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUnifiedMetrics } from '@/hooks/useUnifiedMetrics';
import { PlatformGrid } from '@/components/unified/PlatformGrid';
import { PlatformComparisonChart } from '@/components/unified/PlatformComparisonChart';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Activity,
  Eye,
  FileText,
  RefreshCw,
  TrendingUp,
  Zap,
  Target,
  Loader2,
  AlertTriangle,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// Platform display names for insights
const PLATFORM_NAMES: Record<string, string> = {
  twitter: 'Twitter',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  threads: 'Threads',
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
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

export default function UnifiedDashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading, error, refetch } = useUnifiedMetrics({ period });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleConnect = useCallback((platformId: string) => {
    router.push(`/dashboard/integrations?connect=${platformId}`);
  }, [router]);

  const handleViewDetails = useCallback((platformId: string) => {
    router.push(`/dashboard/analytics?platform=${platformId}`);
  }, [router]);

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Failed to load metrics</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const connectedCount = data?.platforms.filter((p) => p.connected).length ?? 0;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <PageHeader
        title="Unified Dashboard"
        description={`${connectedCount} platform${connectedCount !== 1 ? 's' : ''} connected`}
        actions={
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Followers</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(data?.totals.followers ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Engagement</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(data?.totals.engagement ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Eye className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Reach</p>
              <p className="text-2xl font-bold text-white">
                {formatNumber(data?.totals.reach ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Posts</p>
              <p className="text-2xl font-bold text-white">
                {data?.totals.posts ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Insights Row */}
      {data?.insights && (data.insights.topPlatform || data.insights.fastestGrowing) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.insights.topPlatform && (
            <div className="bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Target className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Top Platform</p>
                  <p className="text-lg font-semibold text-white">
                    {PLATFORM_NAMES[data.insights.topPlatform] ?? data.insights.topPlatform}
                  </p>
                  <p className="text-xs text-gray-500">Highest engagement</p>
                </div>
              </div>
            </div>
          )}
          {data.insights.fastestGrowing && (
            <div className="bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Fastest Growing</p>
                  <p className="text-lg font-semibold text-white">
                    {PLATFORM_NAMES[data.insights.fastestGrowing] ?? data.insights.fastestGrowing}
                  </p>
                  <p className="text-xs text-gray-500">Best growth rate</p>
                </div>
              </div>
            </div>
          )}
          {data.insights.bestEngagementRate && (
            <div className="bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Best Engagement Rate</p>
                  <p className="text-lg font-semibold text-white">
                    {PLATFORM_NAMES[data.insights.bestEngagementRate] ?? data.insights.bestEngagementRate}
                  </p>
                  <p className="text-xs text-gray-500">Most engaged audience</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Platform Grid */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Platforms</h2>
        <PlatformGrid
          platforms={data?.platforms ?? []}
          isLoading={isLoading}
          onConnect={handleConnect}
          onViewDetails={handleViewDetails}
        />
      </section>

      {/* Comparison Chart */}
      <section>
        <PlatformComparisonChart
          data={data?.timeline ?? []}
          platforms={data?.platforms ?? []}
        />
      </section>
    </div>
  );
}
