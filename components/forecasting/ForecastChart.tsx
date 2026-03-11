'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';
import type { ForecastPrediction, ForecastAccuracy, ForecastMetric } from '@/lib/forecasting/types';

interface ForecastChartProps {
  predictions: ForecastPrediction[];
  metric: ForecastMetric;
  horizonDays: number;
  accuracy: ForecastAccuracy | null;
}

/**
 * Recharts area chart rendering Prophet forecast confidence bands.
 *
 * Renders three layered areas:
 *  1. Upper band (yhat_upper) — emerald fill at 15% opacity
 *  2. Lower fill  (yhat_lower) — dark background colour to occlude below-lower area
 *  3. Main line   (yhat)       — solid emerald stroke
 *
 * Accuracy row below chart shows MAPE and MAE in emerald.
 */
export function ForecastChart({
  predictions,
  metric,
  horizonDays,
  accuracy,
}: ForecastChartProps) {
  const chartData = predictions.map((p) => ({
    date: format(parseISO(p.ds), 'dd/MM'),
    yhat: parseFloat(p.yhat.toFixed(2)),
    yhat_upper: parseFloat(p.yhat_upper.toFixed(2)),
    yhat_lower: parseFloat(p.yhat_lower.toFixed(2)),
  }));

  const metricDef = FORECAST_METRICS[metric];

  return (
    <div className="bg-white/[0.02] border border-emerald-500/10 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">
          {horizonDays}-Day Forecast — {metricDef.label}
        </h3>
        {metricDef.unit !== 'count' && (
          <p className="text-xs text-gray-500 mt-0.5">Unit: {metricDef.unit}</p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: 12,
            }}
            labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
            formatter={(value: number) => [
              `${value}${metricDef.unit === '%' ? '%' : ''}`,
            ]}
          />

          {/* Upper confidence band */}
          <Area
            dataKey="yhat_upper"
            fill="#10b981"
            fillOpacity={0.15}
            stroke="none"
            isAnimationActive={false}
          />
          {/* Lower fill — occludes area below lower bound */}
          <Area
            dataKey="yhat_lower"
            fill="#0f172a"
            fillOpacity={1}
            stroke="none"
            isAnimationActive={false}
          />
          {/* Main forecast line */}
          <Area
            dataKey="yhat"
            stroke="#10b981"
            strokeWidth={2}
            fill="none"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', stroke: 'rgba(16,185,129,0.4)', strokeWidth: 4 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Accuracy row */}
      {accuracy && (
        <div className="flex items-center gap-4 pt-1 border-t border-white/5">
          <div className="text-xs text-gray-500">
            Model accuracy:
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span>
              MAPE{' '}
              <span className="text-emerald-400 font-medium">
                {accuracy.mape.toFixed(1)}%
              </span>
            </span>
            {accuracy.mae !== undefined && (
              <span>
                MAE{' '}
                <span className="text-emerald-400 font-medium">
                  {accuracy.mae.toFixed(2)}
                </span>
              </span>
            )}
            <span>
              RMSE{' '}
              <span className="text-emerald-400 font-medium">
                {accuracy.rmse.toFixed(2)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ForecastChart;
