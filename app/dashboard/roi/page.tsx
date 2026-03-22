'use client';

/**
 * /dashboard/roi
 *
 * ROI calculator and content investment analytics.
 * Wired to /api/dashboard/roi via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, DollarSign, BarChart3, Clock } from 'lucide-react';

interface RoiMetric {
  label: string;
  value: number;
  unit: 'currency' | 'percent' | 'hours' | 'number';
  trend: number; // % change vs previous period
  icon: 'dollar' | 'trend' | 'chart' | 'clock';
}

interface RoiData {
  period: string;
  metrics: RoiMetric[];
  breakdown: Array<{
    platform: string;
    investment: number;
    return: number;
    roi: number;
  }>;
  summary: {
    totalInvestment: number;
    totalReturn: number;
    overallRoi: number;
    timeSavedHours: number;
  };
}

const ICONS = {
  dollar: DollarSign,
  trend: TrendingUp,
  chart: BarChart3,
  clock: Clock,
};

async function fetcher(url: string): Promise<RoiData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ROI data (${res.status})`);
  return res.json();
}

function formatValue(value: number, unit: RoiMetric['unit']): string {
  switch (unit) {
    case 'currency': return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent': return `${value.toFixed(1)}%`;
    case 'hours': return `${value.toFixed(1)}h`;
    case 'number': return value.toLocaleString();
    default: return String(value);
  }
}

export default function RoiPage() {
  const { data, error, isLoading } = useSWR<RoiData>('/api/dashboard/roi', fetcher, {
    refreshInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 space-y-3">
              <div className="h-4 w-20 bg-white/[0.05] rounded-sm" />
              <div className="h-8 w-28 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-white/[0.06] p-4 flex justify-between">
              <div className="h-4 w-24 bg-white/[0.05] rounded-sm" />
              <div className="h-4 w-16 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load ROI data. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Performance</p>
        <h1 className="text-2xl font-semibold text-white">Return on Investment</h1>
        <p className="text-sm text-white/40 mt-1">Period: {data.period}</p>
      </div>

      {/* Summary hero */}
      <div className="border-[0.5px] border-amber-500/20 bg-amber-500/5 rounded-sm p-6">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-amber-400/60 mb-1">Total Investment</p>
            <p className="text-xl font-semibold text-white">${data.summary.totalInvestment.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-amber-400/60 mb-1">Total Return</p>
            <p className="text-xl font-semibold text-amber-300">${data.summary.totalReturn.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-amber-400/60 mb-1">Overall ROI</p>
            <p className="text-xl font-semibold text-emerald-400">+{data.summary.overallRoi.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-amber-400/60 mb-1">Time Saved</p>
            <p className="text-xl font-semibold text-white">{data.summary.timeSavedHours}h</p>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      {data.metrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.metrics.map((metric, i) => {
            const Icon = ICONS[metric.icon];
            const trendPositive = metric.trend >= 0;
            return (
              <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-3.5 w-3.5 text-white/30" />
                  <p className="text-xs text-white/40">{metric.label}</p>
                </div>
                <p className="text-xl font-semibold text-white">{formatValue(metric.value, metric.unit)}</p>
                <p className={`text-xs mt-1 ${trendPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {trendPositive ? '+' : ''}{metric.trend.toFixed(1)}% vs last period
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Platform breakdown */}
      <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
        <div className="border-b border-white/[0.06] p-4 grid grid-cols-4 gap-4">
          <p className="text-xs text-white/40 uppercase tracking-wider">Platform</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Investment</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Return</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">ROI</p>
        </div>
        {data.breakdown.map((row, i) => (
          <div key={i} className="border-b border-white/[0.04] p-4 grid grid-cols-4 gap-4 hover:bg-white/[0.01] transition-colors">
            <p className="text-sm text-white capitalize">{row.platform}</p>
            <p className="text-sm text-white/60">${row.investment.toLocaleString()}</p>
            <p className="text-sm text-white/60">${row.return.toLocaleString()}</p>
            <p className={`text-sm font-medium ${row.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {row.roi >= 0 ? '+' : ''}{row.roi.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
