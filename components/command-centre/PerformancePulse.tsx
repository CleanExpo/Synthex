'use client';

import type { PerformanceData } from './types';

interface Props {
  data: PerformanceData | null;
}

export function PerformancePulse({ data }: Props) {
  if (!data) return null;

  const { sevenDay, dailyBreakdown } = data;

  // Sparkline: normalize engagement values to 0-100% height
  const maxEngagement = Math.max(
    ...dailyBreakdown.map(d => d.avgEngagement),
    0.01
  );

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-5">
      <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest mb-4">
        Performance Pulse
      </h3>

      {/* Sparkline */}
      <div className="flex items-end gap-1 h-16 mb-4">
        {dailyBreakdown.map(day => {
          const heightPct =
            maxEngagement > 0 ? (day.avgEngagement / maxEngagement) * 100 : 0;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-cyan-400/30 rounded-sm min-h-[2px] transition-all"
                style={{ height: `${Math.max(heightPct, 3)}%` }}
              />
              <span className="text-[8px] text-white/50">
                {new Date(day.date).toLocaleDateString('en-AU', {
                  weekday: 'narrow',
                })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Avg Engagement"
          value={`${sevenDay.avgEngagement.toFixed(1)}%`}
        />
        <MetricCard
          label="Likes (7d)"
          value={sevenDay.totalLikes.toLocaleString()}
        />
        <MetricCard
          label="Comments (7d)"
          value={sevenDay.totalComments.toLocaleString()}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border-[0.5px] border-white/[0.06] rounded-sm p-3 text-center">
      <div className="text-sm font-light text-white tabular-nums">{value}</div>
      <div className="text-[9px] text-white/50 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}
