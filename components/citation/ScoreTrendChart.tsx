'use client';

/**
 * ScoreTrendChart — Phase 99
 *
 * Pure SVG multi-metric trend chart showing GEO score, Quality score,
 * and alert counts over the last 30 days. No charting library required.
 */

import type { TimelinePoint } from '@/lib/citation/aggregator';

interface ScoreTrendChartProps {
  data: TimelinePoint[];
  loading?: boolean;
}

// Chart dimensions
const W = 800;
const H = 200;
const PADDING = { top: 16, right: 24, bottom: 36, left: 40 };
const INNER_W = W - PADDING.left - PADDING.right;
const INNER_H = H - PADDING.top - PADDING.bottom;

const LINES = [
  { key: 'geoScore' as const, colour: '#06b6d4', label: 'GEO' },
  { key: 'qualityScore' as const, colour: '#10b981', label: 'Quality' },
];

function scaleX(i: number, total: number): number {
  if (total <= 1) return PADDING.left;
  return PADDING.left + (i / (total - 1)) * INNER_W;
}

function scaleY(value: number): number {
  // 0 = bottom, 100 = top
  return PADDING.top + INNER_H - (value / 100) * INNER_H;
}

/**
 * Build a polyline points string, splitting at null values.
 * Returns an array of segments (each segment is a continuous run of non-null values).
 */
function buildSegments(
  data: TimelinePoint[],
  key: 'geoScore' | 'qualityScore'
): Array<Array<{ x: number; y: number }>> {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  data.forEach((point, i) => {
    const value = point[key];
    if (value === null || value === undefined) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push({ x: scaleX(i, data.length), y: scaleY(value) });
    }
  });

  if (current.length > 0) segments.push(current);
  return segments;
}

function pointsToString(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function ScoreTrendChart({ data, loading = false }: ScoreTrendChartProps) {
  if (loading) {
    return (
      <div className="w-full h-[200px] rounded-xl bg-white/[0.02] animate-pulse" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center">
        <p className="text-sm text-gray-500">No trend data available yet</p>
      </div>
    );
  }

  // X-axis labels: show every ~7 days
  const labelStep = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data
    .map((d, i) => ({ i, date: d.date }))
    .filter((_, i) => i === 0 || i % labelStep === 0 || i === data.length - 1);

  // Y-axis guide lines
  const yGuides = [25, 50, 75, 100];

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {LINES.map(({ colour, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-2 rounded-sm"
              style={{ background: colour }}
            />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Score trend chart over 30 days"
      >
        {/* Y-axis guide lines */}
        {yGuides.map((v) => {
          const y = scaleY(v);
          return (
            <g key={v}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={W - PADDING.right}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="rgba(255,255,255,0.3)"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* X-axis baseline */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + INNER_H}
          x2={W - PADDING.right}
          y2={PADDING.top + INNER_H}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* Data lines */}
        {LINES.map(({ key, colour }) => {
          const segments = buildSegments(data, key);
          return segments.map((seg, si) => (
            <polyline
              key={`${key}-${si}`}
              points={pointsToString(seg)}
              fill="none"
              stroke={colour}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
            />
          ));
        })}

        {/* Data dots for GEO score */}
        {data.map((point, i) => {
          if (point.geoScore === null) return null;
          return (
            <circle
              key={`dot-geo-${i}`}
              cx={scaleX(i, data.length)}
              cy={scaleY(point.geoScore)}
              r="2.5"
              fill="#06b6d4"
              opacity={0.8}
            />
          );
        })}

        {/* X-axis labels */}
        {xLabels.map(({ i, date }) => (
          <text
            key={`xl-${i}`}
            x={scaleX(i, data.length)}
            y={PADDING.top + INNER_H + 16}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.3)"
          >
            {formatDate(date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
