'use client';

/**
 * Platform Comparison Chart
 *
 * @description Stacked area chart showing engagement across platforms over time.
 */

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlatformComparisonChartProps {
  data: Array<{
    date: string;
    [platform: string]: number | string;
  }>;
  platforms: Array<{
    id: string;
    name: string;
    color: string;
    connected: boolean;
  }>;
  className?: string;
}

type MetricType = 'engagement' | 'stacked';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);

  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-white">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-white">
              {formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-white/10">
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-sm font-semibold text-white">
            {formatNumber(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PlatformComparisonChart({
  data,
  platforms,
  className,
}: PlatformComparisonChartProps) {
  const [metricType, setMetricType] = useState<MetricType>('stacked');
  const [visiblePlatforms, setVisiblePlatforms] = useState<Set<string>>(
    new Set(platforms.filter((p) => p.connected).map((p) => p.id))
  );

  const connectedPlatforms = platforms.filter((p) => p.connected);

  const togglePlatform = (platformId: string) => {
    const newVisible = new Set(visiblePlatforms);
    if (newVisible.has(platformId)) {
      newVisible.delete(platformId);
    } else {
      newVisible.add(platformId);
    }
    setVisiblePlatforms(newVisible);
  };

  // Format data for chart
  const chartData = data.map((point) => ({
    ...point,
    date: formatDate(point.date),
  }));

  if (connectedPlatforms.length === 0) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-8', className)}>
        <div className="text-center text-gray-400">
          <p>Connect platforms to see comparison data</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Platform Comparison</h3>
        <div className="flex gap-2">
          <Button
            variant={metricType === 'stacked' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMetricType('stacked')}
          >
            Stacked
          </Button>
          <Button
            variant={metricType === 'engagement' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMetricType('engagement')}
          >
            Individual
          </Button>
        </div>
      </div>

      {/* Platform toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {connectedPlatforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => togglePlatform(platform.id)}
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium transition-all',
              visiblePlatforms.has(platform.id)
                ? 'text-white'
                : 'text-gray-500 opacity-50'
            )}
            style={{
              backgroundColor: visiblePlatforms.has(platform.id)
                ? `${platform.color}30`
                : 'transparent',
              borderColor: platform.color,
              borderWidth: 1,
            }}
          >
            {platform.name}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {connectedPlatforms.map((platform) => (
                <linearGradient
                  key={platform.id}
                  id={`gradient-${platform.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={platform.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={platform.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => <span className="text-gray-300">{value}</span>}
            />
            {connectedPlatforms
              .filter((p) => visiblePlatforms.has(p.id))
              .map((platform) => (
                <Area
                  key={platform.id}
                  type="monotone"
                  dataKey={platform.id}
                  name={platform.name}
                  stroke={platform.color}
                  fill={`url(#gradient-${platform.id})`}
                  strokeWidth={2}
                  stackId={metricType === 'stacked' ? 'stack' : undefined}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PlatformComparisonChart;
