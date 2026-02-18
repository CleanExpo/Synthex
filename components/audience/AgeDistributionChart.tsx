'use client';

/**
 * Age Distribution Chart
 *
 * @description Horizontal bar chart showing audience age range distribution.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface AgeDistributionChartProps {
  data: Array<{ range: string; percentage: number; count: number }>;
  isLoading?: boolean;
  className?: string;
}

// Age gradient colors (young cyan → older purple)
const AGE_COLORS: Record<string, string> = {
  '13-17': '#06b6d4', // cyan-500
  '18-24': '#22d3ee', // cyan-400
  '25-34': '#8b5cf6', // violet-500
  '35-44': '#a78bfa', // violet-400
  '45-54': '#c084fc', // purple-400
  '55+': '#d946ef', // fuchsia-500
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: { range: string; percentage: number; count: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-white mb-1">{data.range} years</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-sm">Percentage</span>
          <span className="text-white font-medium">{data.percentage}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-sm">Count</span>
          <span className="text-white font-medium">{formatNumber(data.count)}</span>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-12 h-4 bg-white/5 rounded animate-pulse" />
          <div
            className="h-6 bg-white/5 rounded animate-pulse"
            style={{ width: `${40 + Math.random() * 40}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function AgeDistributionChart({
  data,
  isLoading,
  className,
}: AgeDistributionChartProps) {
  if (isLoading) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Age Distribution</h4>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Age Distribution</h4>
        <p className="text-gray-500 text-sm text-center py-8">No age data available</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
      <h4 className="text-sm font-medium text-gray-400 mb-4">Age Distribution</h4>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              domain={[0, 'dataMax']}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="range"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((entry) => (
                <Cell key={entry.range} fill={AGE_COLORS[entry.range] || '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default AgeDistributionChart;
