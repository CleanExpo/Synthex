'use client';

/**
 * Location Distribution Chart
 *
 * @description Horizontal bar chart showing top audience locations.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

interface LocationMapProps {
  data: Array<{ location: string; country: string; percentage: number; count: number }>;
  isLoading?: boolean;
  className?: string;
}

// Country flag emojis
const COUNTRY_FLAGS: Record<string, string> = {
  USA: '\u{1F1FA}\u{1F1F8}',
  UK: '\u{1F1EC}\u{1F1E7}',
  Canada: '\u{1F1E8}\u{1F1E6}',
  Australia: '\u{1F1E6}\u{1F1FA}',
  Germany: '\u{1F1E9}\u{1F1EA}',
  France: '\u{1F1EB}\u{1F1F7}',
  Japan: '\u{1F1EF}\u{1F1F5}',
  Brazil: '\u{1F1E7}\u{1F1F7}',
  India: '\u{1F1EE}\u{1F1F3}',
  Mexico: '\u{1F1F2}\u{1F1FD}',
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: { location: string; country: string; percentage: number; count: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const flag = COUNTRY_FLAGS[data.country] || '';

  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-white mb-1">
        {flag} {data.location}, {data.country}
      </p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-sm">Percentage</span>
          <span className="text-white font-medium">{data.percentage}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400 text-sm">Followers</span>
          <span className="text-white font-medium">{formatNumber(data.count)}</span>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
          <div
            className="h-5 bg-white/5 rounded animate-pulse"
            style={{ width: `${50 + Math.random() * 40}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function LocationMap({
  data,
  isLoading,
  className,
}: LocationMapProps) {
  if (isLoading) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Top Locations</h4>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Top Locations</h4>
        <p className="text-gray-500 text-sm text-center py-8">No location data available</p>
      </div>
    );
  }

  // Add flag to location name for display
  const chartData = data.slice(0, 10).map((item) => ({
    ...item,
    displayName: `${COUNTRY_FLAGS[item.country] || ''} ${item.location}`,
  }));

  return (
    <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
      <h4 className="text-sm font-medium text-gray-400 mb-4">Top Locations</h4>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
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
              dataKey="displayName"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="percentage" fill="#06b6d4" radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LocationMap;
