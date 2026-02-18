'use client';

/**
 * Stats Overview
 *
 * @description Summary cards showing affiliate performance metrics.
 */

import { cn } from '@/lib/utils';
import { MousePointer, TrendingUp, DollarSign, Percent, Globe } from '@/components/icons';
import type { AffiliateStats } from '@/hooks/useAffiliateLinks';
import { NETWORK_COLORS, type NetworkSlug } from '@/hooks/useAffiliateLinks';

interface StatsOverviewProps {
  stats: AffiliateStats;
  isLoading?: boolean;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  isLoading,
}: {
  icon: typeof MousePointer;
  label: string;
  value: string;
  subtext?: string;
  color: string;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2.5 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      {isLoading ? (
        <>
          <div className="w-24 h-7 bg-white/5 rounded animate-pulse mb-1" />
          <div className="w-16 h-4 bg-white/5 rounded animate-pulse" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-white mb-1">{value}</div>
          <div className="text-sm text-white/50">{label}</div>
          {subtext && (
            <div className="text-xs text-white/40 mt-1">{subtext}</div>
          )}
        </>
      )}
    </div>
  );
}

function NetworkBreakdown({
  breakdown,
  isLoading,
}: {
  breakdown: AffiliateStats['networkBreakdown'];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <div className="w-32 h-5 bg-white/5 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
              <div className="flex-1">
                <div className="w-24 h-4 bg-white/5 rounded animate-pulse mb-1" />
                <div className="w-full h-2 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (breakdown.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white/70 mb-4">By Network</h3>
        <div className="text-center py-6">
          <Globe className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">No network data yet</p>
        </div>
      </div>
    );
  }

  const maxClicks = Math.max(...breakdown.map((n) => n.clicks), 1);

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <h3 className="text-sm font-medium text-white/70 mb-4">By Network</h3>
      <div className="space-y-3">
        {breakdown.map((network, idx) => {
          const color = NETWORK_COLORS[network.networkId as NetworkSlug] || NETWORK_COLORS.custom;
          const width = (network.clicks / maxClicks) * 100;

          return (
            <div key={network.networkId || idx} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}20` }}
              >
                <Globe className="h-4 w-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-white truncate">{network.networkName}</span>
                  <span className="text-white/50 ml-2">{formatNumber(network.clicks)}</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${width}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopLinks({
  links,
  isLoading,
}: {
  links: AffiliateStats['topLinks'];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <div className="w-32 h-5 bg-white/5 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="w-32 h-4 bg-white/5 rounded animate-pulse" />
              <div className="w-16 h-4 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white/70 mb-4">Top Links</h3>
        <div className="text-center py-6">
          <TrendingUp className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">No link data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <h3 className="text-sm font-medium text-white/70 mb-4">Top Links</h3>
      <div className="space-y-1">
        {links.slice(0, 5).map((link, idx) => (
          <div
            key={link.id}
            className="flex items-center justify-between py-2 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white/30 text-sm w-4">{idx + 1}</span>
              <span className="text-white truncate">{link.name}</span>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="text-white/50 text-sm">{formatNumber(link.clicks)}</span>
              <span className="text-emerald-400 text-sm">{formatCurrency(link.revenue)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsOverview({ stats, isLoading, className }: StatsOverviewProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MousePointer}
          label="Total Clicks"
          value={formatNumber(stats.totalClicks)}
          color="#06B6D4"
          isLoading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Conversions"
          value={formatNumber(stats.totalConversions)}
          color="#10B981"
          isLoading={isLoading}
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          color="#F59E0B"
          isLoading={isLoading}
        />
        <StatCard
          icon={Percent}
          label="Conversion Rate"
          value={`${stats.conversionRate.toFixed(1)}%`}
          color="#8B5CF6"
          isLoading={isLoading}
        />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NetworkBreakdown breakdown={stats.networkBreakdown} isLoading={isLoading} />
        <TopLinks links={stats.topLinks} isLoading={isLoading} />
      </div>
    </div>
  );
}

export default StatsOverview;
