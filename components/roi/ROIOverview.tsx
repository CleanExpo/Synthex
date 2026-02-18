'use client';

/**
 * ROI Overview
 *
 * @description Main ROI metric display with stats row.
 */

import { DollarSign, Clock, TrendingUp, TrendingDown, Calculator } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { ROIMetrics } from '@/lib/roi/roi-service';

interface ROIOverviewProps {
  metrics: ROIMetrics | null;
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

function getROIColor(roi: number): { bg: string; text: string; border: string } {
  if (roi < 0) return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' };
  if (roi < 50) return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' };
  if (roi < 100) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' };
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, subValue, color }: StatCardProps) {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <div className="flex items-start">
        <div className={cn('p-2.5 rounded-lg', `bg-${color}-500/10`)}>
          <Icon className={cn('w-5 h-5', `text-${color}-400`)} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
        {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Main ROI Card Skeleton */}
      <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-center">
          <div className="w-32 h-20 bg-white/5 rounded animate-pulse" />
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="w-24 h-7 bg-white/5 rounded animate-pulse" />
              <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ROIOverview({ metrics, isLoading, className }: ROIOverviewProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!metrics) {
    return null;
  }

  const roiColors = getROIColor(metrics.overallROI);
  const isPositive = metrics.overallROI >= 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main ROI Display */}
      <div
        className={cn(
          'bg-gray-900/50 border rounded-xl p-6 text-center',
          roiColors.border
        )}
      >
        <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-full mb-2', roiColors.bg)}>
          {isPositive ? (
            <TrendingUp className={cn('w-5 h-5', roiColors.text)} />
          ) : (
            <TrendingDown className={cn('w-5 h-5', roiColors.text)} />
          )}
          <span className={cn('text-sm font-medium', roiColors.text)}>
            {isPositive ? 'Positive ROI' : 'Negative ROI'}
          </span>
        </div>
        <p className={cn('text-5xl font-bold', roiColors.text)}>
          {metrics.overallROI > 0 ? '+' : ''}{formatNumber(metrics.overallROI)}%
        </p>
        <p className="text-gray-400 mt-2">Overall Return on Investment</p>
        <p className="text-sm text-gray-500 mt-1">
          {formatCurrency(metrics.roiPerHour, metrics.currency)} per hour invested
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(metrics.totalRevenue, metrics.currency)}
          color="emerald"
        />
        <StatCard
          icon={DollarSign}
          label="Money Invested"
          value={formatCurrency(metrics.totalMoneyInvested, metrics.currency)}
          color="red"
        />
        <StatCard
          icon={Clock}
          label="Hours Invested"
          value={`${formatNumber(metrics.totalHoursInvested)} hrs`}
          color="blue"
        />
        <StatCard
          icon={Calculator}
          label="Net Profit"
          value={formatCurrency(metrics.netProfit, metrics.currency)}
          subValue={metrics.netProfit >= 0 ? 'Profit' : 'Loss'}
          color={metrics.netProfit >= 0 ? 'cyan' : 'orange'}
        />
      </div>
    </div>
  );
}

export default ROIOverview;
