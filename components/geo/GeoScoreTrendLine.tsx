'use client';

/**
 * GeoScoreTrendLine — SYN-657
 *
 * Recharts LineChart displaying the 13-week GEO Score trend.
 * Shows "Score tracking started {date}" when fewer than 13 weeks of data exist.
 * Line colour matches the current score's colour band.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export interface TrendDataPoint {
  week: string;  // e.g. "Mar 10"
  score: number;
}

interface GeoScoreTrendLineProps {
  data:          TrendDataPoint[];
  currentScore:  number;
  trackingStart?: string | null; // ISO date of first data point
}

function colourForScore(score: number): string {
  if (score >= 67) return '#10B981';
  if (score >= 34) return '#F59E0B';
  return '#EF4444';
}

export function GeoScoreTrendLine({
  data,
  currentScore,
  trackingStart,
}: GeoScoreTrendLineProps) {
  const colour = colourForScore(currentScore);
  const isPartial = data.length < 13;

  const startLabel = trackingStart
    ? new Date(trackingStart).toLocaleDateString('en-AU', {
        day:   'numeric',
        month: 'short',
        year:  'numeric',
      })
    : null;

  return (
    <div className="w-full">
      {isPartial && startLabel && (
        <p className="text-xs text-white/30 mb-2">
          Score tracking started {startLabel}
        </p>
      )}

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip
            contentStyle={{
              background:   '#1a1a1a',
              border:       '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              fontSize:     '12px',
              color:        '#fff',
            }}
            formatter={(value: number) => [`${value}`, 'GEO Score']}
            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={colour}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: colour }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
