'use client';

/**
 * Revenue By Source
 *
 * @description Pie chart showing revenue breakdown by source.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { RevenueSource } from '@/lib/revenue/revenue-service';

interface RevenueBySourceProps {
  data: Record<RevenueSource, number>;
  currency?: string;
  isLoading?: boolean;
  className?: string;
}

const SOURCE_COLORS: Record<RevenueSource, string> = {
  sponsorship: '#06b6d4', // cyan
  affiliate: '#10b981', // emerald
  ads: '#8b5cf6', // violet
  tips: '#f97316', // orange
  merchandise: '#ec4899', // pink
  other: '#6b7280', // gray
};

const SOURCE_LABELS: Record<RevenueSource, string> = {
  sponsorship: 'Sponsorship',
  affiliate: 'Affiliate',
  ads: 'Ad Revenue',
  tips: 'Tips & Donations',
  merchandise: 'Merchandise',
  other: 'Other',
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function LoadingSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-violet-500/10 rounded-lg animate-pulse" />
        <div className="w-28 h-5 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="h-[200px] flex items-center justify-center">
        <div className="w-32 h-32 rounded-full bg-white/5 animate-pulse" />
      </div>
      <div className="space-y-2 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
            <div className="w-16 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { source: RevenueSource; amount: number } }>;
  currency: string;
}

function CustomTooltip({ active, payload, currency }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const { source, amount } = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm text-gray-400">{SOURCE_LABELS[source]}</p>
      <p className="text-lg font-bold text-white">{formatCurrency(amount, currency)}</p>
    </div>
  );
}

export function RevenueBySource({
  data,
  currency = 'USD',
  isLoading,
  className,
}: RevenueBySourceProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Filter out sources with 0 amount and prepare chart data
  const chartData = Object.entries(data)
    .filter(([, amount]) => amount > 0)
    .map(([source, amount]) => ({
      source: source as RevenueSource,
      amount,
      name: SOURCE_LABELS[source as RevenueSource],
      color: SOURCE_COLORS[source as RevenueSource],
    }))
    .sort((a, b) => b.amount - a.amount);

  const total = chartData.reduce((sum, d) => sum + d.amount, 0);

  if (chartData.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-8 text-center', className)}>
        <PieChartIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No revenue sources to display</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-violet-500/10 rounded-lg">
          <PieChartIcon className="w-4 h-4 text-violet-400" />
        </div>
        <h3 className="font-medium text-white">By Source</h3>
      </div>

      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="amount"
            >
              {chartData.map((entry) => (
                <Cell key={entry.source} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-2 mt-4">
        {chartData.map((item) => {
          const percent = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0';
          return (
            <div key={item.source} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-400">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{percent}%</span>
                <span className="text-white font-medium">
                  {formatCurrency(item.amount, currency)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RevenueBySource;
