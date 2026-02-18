'use client';

/**
 * Pattern Charts
 *
 * @description Grid of mini charts showing performance patterns.
 */

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

interface PatternChartsProps {
  patterns: {
    bestDays: Array<{ day: string; avgEngagement: number }>;
    bestHours: Array<{ hour: number; avgEngagement: number }>;
    bestLength: { min: number; max: number; avgEngagement: number };
    topHashtags: Array<{ tag: string; avgEngagement: number; count: number }>;
  };
  isLoading?: boolean;
  className?: string;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: Record<string, unknown> }>;
  label?: string;
  valueLabel?: string;
  valueSuffix?: string;
}

function CustomTooltip({ active, payload, label, valueLabel = 'Engagement', valueSuffix = '%' }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-2 shadow-xl">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-white">
        {valueLabel}: {payload[0].value}{valueSuffix}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
      <h4 className="text-sm font-medium text-gray-400 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-gray-900/30 border border-white/10 rounded-xl p-4">
          <div className="w-24 h-4 bg-white/5 rounded animate-pulse mb-3" />
          <div className="h-[150px] bg-white/5 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function PatternCharts({
  patterns,
  isLoading,
  className,
}: PatternChartsProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const hasDays = patterns.bestDays.length > 0;
  const hasHours = patterns.bestHours.length > 0;
  const hasHashtags = patterns.topHashtags.length > 0;
  const hasLength = patterns.bestLength.max > 0;

  if (!hasDays && !hasHours && !hasHashtags && !hasLength) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-8', className)}>
        <p className="text-gray-500 text-center">Not enough data to show patterns</p>
      </div>
    );
  }

  // Prepare data
  const daysData = patterns.bestDays.slice(0, 7).map((d) => ({
    name: d.day.slice(0, 3),
    value: d.avgEngagement,
  }));

  const hoursData = patterns.bestHours.map((h) => ({
    hour: h.hour,
    name: formatHour(h.hour),
    value: h.avgEngagement,
  })).sort((a, b) => a.hour - b.hour);

  const hashtagsData = patterns.topHashtags.slice(0, 5).map((h) => ({
    name: `#${h.tag}`,
    value: h.avgEngagement,
    count: h.count,
  }));

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      {/* Best Days */}
      <ChartCard title="Best Days">
        {hasDays ? (
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daysData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">No data</p>
        )}
      </ChartCard>

      {/* Best Hours */}
      <ChartCard title="Best Hours">
        {hasHours ? (
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hoursData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">No data</p>
        )}
      </ChartCard>

      {/* Top Hashtags */}
      <ChartCard title="Top Hashtags">
        {hasHashtags ? (
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hashtagsData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as { count: number };
                    return (
                      <div className="bg-gray-900 border border-white/10 rounded-lg p-2 shadow-xl">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm font-medium text-white">
                          {payload[0].value}% avg
                        </p>
                        <p className="text-xs text-gray-500">{data.count} uses</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">No hashtag data</p>
        )}
      </ChartCard>

      {/* Best Length */}
      <ChartCard title="Optimal Length">
        {hasLength ? (
          <div className="flex flex-col items-center justify-center h-[150px]">
            <div className="text-4xl font-bold text-white mb-2">
              {patterns.bestLength.min}-{patterns.bestLength.max}
            </div>
            <div className="text-sm text-gray-400">characters</div>
            <div className="mt-3 px-3 py-1 bg-emerald-500/10 rounded-full">
              <span className="text-xs text-emerald-400">
                {patterns.bestLength.avgEngagement}% avg engagement
              </span>
            </div>
            <div className="mt-4 w-full px-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (patterns.bestLength.max / 500) * 100)}%`,
                    marginLeft: `${Math.min(40, (patterns.bestLength.min / 500) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>0</span>
                <span>500+</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">No length data</p>
        )}
      </ChartCard>
    </div>
  );
}

export default PatternCharts;
