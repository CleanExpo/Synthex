'use client';

/**
 * Gender Distribution Chart
 *
 * @description Pie chart showing audience gender breakdown with center total.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

interface GenderChartProps {
  data: Array<{ gender: string; percentage: number; count: number }>;
  totalAudience?: number;
  isLoading?: boolean;
  className?: string;
}

const GENDER_COLORS: Record<string, string> = {
  Male: '#3B82F6', // blue-500
  Female: '#EC4899', // pink-500
  Other: '#8B5CF6', // violet-500
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: { gender: string; percentage: number; count: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-white mb-1">{data.gender}</p>
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
    <div className="flex items-center justify-center h-[200px]">
      <div className="w-32 h-32 rounded-full border-8 border-white/5 animate-pulse" />
    </div>
  );
}

export function GenderChart({
  data,
  totalAudience,
  isLoading,
  className,
}: GenderChartProps) {
  if (isLoading) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Gender Distribution</h4>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Gender Distribution</h4>
        <p className="text-gray-500 text-sm text-center py-8">No gender data available</p>
      </div>
    );
  }

  const total = totalAudience || data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
      <h4 className="text-sm font-medium text-gray-400 mb-4">Gender Distribution</h4>
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="percentage"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.gender} fill={GENDER_COLORS[entry.gender] || '#6366f1'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-white">{formatNumber(total)}</span>
          <span className="text-xs text-gray-400">Total</span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((entry) => (
          <div key={entry.gender} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: GENDER_COLORS[entry.gender] || '#6366f1' }}
            />
            <span className="text-xs text-gray-400">{entry.gender}</span>
            <span className="text-xs text-white font-medium">{entry.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GenderChart;
