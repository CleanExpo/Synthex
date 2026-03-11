'use client';

/**
 * Metric Trend Chart Component
 *
 * Pure SVG chart — no external chart library required.
 * Renders a line + area fill chart for site health metrics over time.
 *
 * Supports: clicks, impressions, avgPosition
 */

interface DataPoint {
  date: string;
  value: number;
}

interface MetricTrendChartProps {
  data: DataPoint[];
  label: string;
  colour?: string;
  height?: number;
  invertY?: boolean; // true for avgPosition (lower is better)
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatValue(value: number, label: string): string {
  if (label.toLowerCase().includes('position')) return value.toFixed(1);
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function MetricTrendChart({
  data,
  label,
  colour = '#22d3ee',
  height = 160,
  invertY = false,
}: MetricTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-gray-500 text-sm rounded-lg bg-white/5"
      >
        No data available yet
      </div>
    );
  }

  const width = 100; // SVG viewBox units
  const padding = { top: 8, right: 4, bottom: 24, left: 0 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    padding.left + (i / Math.max(data.length - 1, 1)) * chartW;

  const toY = (val: number) => {
    const normalised = (val - minVal) / range;
    const y = invertY ? normalised : 1 - normalised;
    return padding.top + y * chartH;
  };

  // Build SVG path points
  const points = data.map((d, i) => `${toX(i).toFixed(2)},${toY(d.value).toFixed(2)}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${toX(data.length - 1).toFixed(2)},${(padding.top + chartH).toFixed(2)} L ${padding.left.toFixed(2)},${(padding.top + chartH).toFixed(2)} Z`;

  // Select tick labels (up to 4)
  const tickIndices =
    data.length <= 4
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];

  const gradId = `grad-${label.replace(/\s+/g, '')}`;

  return (
    <div className="rounded-lg bg-white/5 p-3">
      <div className="text-xs text-gray-400 font-medium mb-2">{label}</div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ height }}
        aria-label={`${label} trend chart`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity="0.25" />
            <stop offset="100%" stopColor={colour} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines (3 horizontal) */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = padding.top + frac * chartH;
          return (
            <line
              key={frac}
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={colour} strokeWidth="1.5" strokeLinejoin="round" />

        {/* Data points */}
        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.value)} r="1.5" fill={colour} />
        ))}

        {/* X-axis labels */}
        {tickIndices.map((i) => (
          <text
            key={i}
            x={toX(i)}
            y={padding.top + chartH + 14}
            textAnchor="middle"
            fontSize="4.5"
            fill="rgba(156,163,175,0.8)"
          >
            {formatAxisDate(data[i].date)}
          </text>
        ))}

        {/* Latest value label */}
        {data.length > 0 && (
          <text
            x={toX(data.length - 1)}
            y={toY(data[data.length - 1].value) - 4}
            textAnchor="end"
            fontSize="5"
            fill={colour}
            fontWeight="600"
          >
            {formatValue(data[data.length - 1].value, label)}
          </text>
        )}
      </svg>
    </div>
  );
}
