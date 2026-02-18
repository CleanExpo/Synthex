'use client';

/**
 * Platform ROI Cards
 *
 * @description Grid of cards showing ROI per platform.
 */

import { cn } from '@/lib/utils';
import { Globe, TrendingUp, TrendingDown, Clock, DollarSign } from '@/components/icons';
import type { PlatformROI } from '@/lib/roi/roi-service';

interface PlatformROICardsProps {
  data: PlatformROI[];
  currency?: string;
  isLoading?: boolean;
  className?: string;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number, decimals: number = 1): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getROIBadgeStyles(roi: number): string {
  if (roi < 0) return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (roi < 50) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
  if (roi < 100) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="w-24 h-5 bg-white/5 rounded animate-pulse" />
            <div className="w-16 h-6 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="w-full h-4 bg-white/5 rounded animate-pulse" />
            <div className="w-full h-4 bg-white/5 rounded animate-pulse" />
            <div className="w-full h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface PlatformCardProps {
  platform: PlatformROI;
  currency: string;
}

function PlatformCard({ platform, currency }: PlatformCardProps) {
  const isPositive = platform.roi >= 0;

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-white">{platform.platform}</span>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full border text-sm font-medium',
            getROIBadgeStyles(platform.roi)
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {platform.roi > 0 ? '+' : ''}{formatNumber(platform.roi)}%
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            Revenue
          </span>
          <span className="text-white font-medium">
            {formatCurrency(platform.revenue, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-red-400" />
            Invested
          </span>
          <span className="text-white font-medium">
            {formatCurrency(platform.moneyInvested, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Hours
          </span>
          <span className="text-white font-medium">
            {formatNumber(platform.hoursInvested)} hrs
          </span>
        </div>
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-sm">
          <span className="text-gray-400">ROI/Hour</span>
          <span className="text-cyan-400 font-medium">
            {formatCurrency(platform.roiPerHour, currency)}/hr
          </span>
        </div>
      </div>
    </div>
  );
}

export function PlatformROICards({
  data,
  currency = 'USD',
  isLoading,
  className,
}: PlatformROICardsProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-8 text-center', className)}>
        <Globe className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No platform data available</p>
        <p className="text-sm text-gray-500 mt-1">Track investments by platform to see ROI breakdown</p>
      </div>
    );
  }

  // Sort by ROI descending
  const sortedData = [...data].sort((a, b) => b.roi - a.roi);

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="font-medium text-white">ROI by Platform</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedData.map((platform) => (
          <PlatformCard key={platform.platform} platform={platform} currency={currency} />
        ))}
      </div>
    </div>
  );
}

export default PlatformROICards;
