'use client';

/**
 * ForecastChart Component
 *
 * @description Time-series area chart with confidence bands for engagement forecasts.
 * Renders predicted engagement with upper/lower confidence bounds using Recharts.
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EngagementForecast, ForecastPoint } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface ForecastChartProps {
  forecast: EngagementForecast | null;
  isLoading: boolean;
}

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTrendConfig(trend: EngagementForecast['trend']) {
  switch (trend) {
    case 'rising':
      return { label: 'Rising', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    case 'declining':
      return { label: 'Declining', className: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    case 'stable':
      return { label: 'Stable', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
    case 'volatile':
      return { label: 'Volatile', className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' };
    default:
      return { label: 'Unknown', className: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
  }
}

// Transform forecast points to chart-ready format (bandWidth stacked on lowerBound)
function transformForecastData(predictions: ForecastPoint[]) {
  return predictions.map((point) => ({
    date: formatDate(point.date),
    rawDate: point.date,
    predicted: point.predicted,
    lowerBound: point.lowerBound,
    bandWidth: point.upperBound - point.lowerBound,
    upperBound: point.upperBound,
  }));
}

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

function ForecastTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const predicted = payload.find((p) => p.dataKey === 'predicted')?.value ?? 0;
  const lowerBound = payload.find((p) => p.dataKey === 'lowerBound')?.value ?? 0;
  const bandWidth = payload.find((p) => p.dataKey === 'bandWidth')?.value ?? 0;
  const upperBound = lowerBound + bandWidth;

  return (
    <div className="rounded-lg bg-[#0f172a]/90 border border-white/10 px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-cyan-400 font-medium">
        Predicted: <span className="text-white">{predicted.toLocaleString()}</span>
      </p>
      <p className="text-slate-400">
        Range: {lowerBound.toLocaleString()} – {Math.round(upperBound).toLocaleString()}
      </p>
    </div>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function ForecastChartSkeleton() {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="h-5 w-40 rounded bg-gradient-to-r from-white/5 to-white/10 animate-pulse" />
        <div className="flex gap-2 mt-1">
          <div className="h-4 w-16 rounded-full bg-gradient-to-r from-white/5 to-white/10 animate-pulse" />
          <div className="h-4 w-24 rounded bg-gradient-to-r from-white/5 to-white/10 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] rounded-lg bg-gradient-to-br from-white/[0.02] to-white/[0.04] animate-pulse" />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function ForecastChartEmpty() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white">Engagement Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-sm text-slate-500">Select a platform to see engagement forecast</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ForecastChart({ forecast, isLoading }: ForecastChartProps) {
  if (isLoading) return <ForecastChartSkeleton />;
  if (!forecast) return <ForecastChartEmpty />;

  const chartData = transformForecastData(forecast.predictions);
  const trendConfig = getTrendConfig(forecast.trend);
  const growthSign = forecast.growthRate >= 0 ? '+' : '';

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-white capitalize">
              {forecast.metric} Forecast — {forecast.platform}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${trendConfig.className}`}
              >
                {trendConfig.label}
              </span>
              <span className="text-xs text-slate-400">
                {growthSign}{forecast.growthRate.toFixed(1)}% growth
              </span>
              <span className="text-xs text-slate-500">
                {Math.round(forecast.confidence * 100)}% confidence
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              {/* Confidence band gradient */}
              <linearGradient id="forecastBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(34,211,238,0.25)" stopOpacity={1} />
                <stop offset="95%" stopColor="rgba(34,211,238,0.05)" stopOpacity={1} />
              </linearGradient>
              {/* Predicted line gradient */}
              <linearGradient id="forecastLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(34,211,238,0.1)" stopOpacity={1} />
                <stop offset="95%" stopColor="rgba(34,211,238,0)" stopOpacity={1} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />

            <XAxis
              dataKey="date"
              stroke="#475569"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              stroke="#475569"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              }
            />

            <Tooltip content={<ForecastTooltip />} />

            {/* Lower bound — transparent base for stacking */}
            <Area
              type="monotone"
              dataKey="lowerBound"
              stroke="none"
              fill="transparent"
              fillOpacity={0}
              legendType="none"
              isAnimationActive={false}
              stackId="band"
            />

            {/* Band width — stacked on lowerBound to create confidence band */}
            <Area
              type="monotone"
              dataKey="bandWidth"
              stroke="none"
              fill="url(#forecastBandGradient)"
              fillOpacity={1}
              legendType="none"
              isAnimationActive={false}
              stackId="band"
            />

            {/* Predicted line — rendered on top */}
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#forecastLineGradient)"
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 4, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
