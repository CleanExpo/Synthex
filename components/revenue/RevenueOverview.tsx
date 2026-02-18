'use client';

/**
 * Revenue Overview
 *
 * @description Stats row showing total revenue and key metrics.
 */

import { DollarSign, TrendingUp, TrendingDown, Calendar, Hash } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { RevenueSummary } from '@/lib/revenue/revenue-service';

interface RevenueOverviewProps {
  summary: RevenueSummary | null;
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

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  trend?: number;
  color: string;
}

function StatCard({ icon: Icon, label, value, subValue, trend, color }: StatCardProps) {
  const hasTrend = trend !== undefined;
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-lg', `bg-${color}-500/10`)}>
          <Icon className={cn('w-5 h-5', `text-${color}-400`)} />
        </div>
        {hasTrend && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded',
              isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
            <div className="w-16 h-6 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="w-24 h-7 bg-white/5 rounded animate-pulse" />
            <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RevenueOverview({
  summary,
  isLoading,
  className,
}: RevenueOverviewProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!summary) {
    return null;
  }

  // Calculate this month's revenue
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const thisMonth = summary.byMonth.find((m) => m.month === currentMonth)?.amount || 0;

  // Calculate last month's revenue
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const lastMonthAmount = summary.byMonth.find((m) => m.month === lastMonth)?.amount || 0;

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      <StatCard
        icon={DollarSign}
        label="Total Revenue"
        value={formatCurrency(summary.total, summary.currency)}
        trend={summary.trend}
        color="emerald"
      />
      <StatCard
        icon={Calendar}
        label="This Month"
        value={formatCurrency(thisMonth, summary.currency)}
        subValue={`vs ${formatCurrency(lastMonthAmount)} last month`}
        color="cyan"
      />
      <StatCard
        icon={Hash}
        label="Total Entries"
        value={summary.entryCount.toString()}
        subValue={`Avg ${formatCurrency(summary.avgPerEntry, summary.currency)} per entry`}
        color="violet"
      />
      <StatCard
        icon={TrendingUp}
        label="Top Source"
        value={getTopSource(summary.bySource)}
        subValue={formatCurrency(getTopSourceAmount(summary.bySource), summary.currency)}
        color="orange"
      />
    </div>
  );
}

function getTopSource(bySource: Record<string, number>): string {
  const labels: Record<string, string> = {
    sponsorship: 'Sponsorship',
    affiliate: 'Affiliate',
    ads: 'Ad Revenue',
    tips: 'Tips',
    merchandise: 'Merchandise',
    other: 'Other',
  };

  let top = 'None';
  let max = 0;
  for (const [source, amount] of Object.entries(bySource)) {
    if (amount > max) {
      max = amount;
      top = labels[source] || source;
    }
  }
  return top;
}

function getTopSourceAmount(bySource: Record<string, number>): number {
  return Math.max(0, ...Object.values(bySource));
}

export default RevenueOverview;
