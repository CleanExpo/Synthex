'use client';

/**
 * ROI Chart
 *
 * @description Bar chart comparing revenue vs investment by platform.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import type { PlatformROI } from '@/lib/roi/roi-service';

interface ROIChartProps {
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

function LoadingSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-cyan-500/10 rounded-lg animate-pulse" />
        <div className="w-48 h-5 bg-white/5 rounded animate-pulse" />
      </div>
      <div className="h-[300px] bg-white/5 rounded animate-pulse" />
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
  currency: string;
}

function CustomTooltip({ active, payload, label, currency }: CustomTooltipProps) {
  if (!active || !payload || !payload.length || !label) return null;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-white mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.fill }}>
          {entry.name}: {formatCurrency(entry.value, currency)}
        </p>
      ))}
    </div>
  );
}

export function ROIChart({ data, currency = 'USD', isLoading, className }: ROIChartProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-8 text-center', className)}>
        <ChartBarIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No platform data to display</p>
        <p className="text-sm text-gray-500 mt-1">Add investments to see ROI comparison</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.map((p) => ({
    platform: p.platform,
    Revenue: p.revenue,
    Investment: p.moneyInvested,
    roi: p.roi,
  }));

  return (
    <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <ChartBarIcon className="w-4 h-4 text-cyan-400" />
        </div>
        <h3 className="font-medium text-white">Revenue vs Investment by Platform</h3>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="platform"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => <span className="text-gray-400 text-sm">{value}</span>}
            />
            <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Investment" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ROIChart;
