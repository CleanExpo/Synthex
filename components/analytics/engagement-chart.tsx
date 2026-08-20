'use client';

/**
 * Engagement Trend Chart
 * Area chart — daily engagement per connected platform.
 * Synthex card shell: sharp corners, white/6 border, white/1.5 bg.
 */

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { EngagementDataPoint } from './types';

const engagementConfig: ChartConfig = {
  twitter:   { label: 'Twitter / X', color: '#1DA1F2' },
  linkedin:  { label: 'LinkedIn',    color: '#0A66C2' },
  instagram: { label: 'Instagram',   color: '#E1306C' },
  tiktok:    { label: 'TikTok',      color: '#FF6B35' },
};

interface EngagementChartProps {
  data: EngagementDataPoint[];
}

export function EngagementChart({ data }: EngagementChartProps) {
  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      <div className="mb-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-0.5">Trend</p>
        <h3 className="text-sm font-medium text-white/80">Engagement Over Time</h3>
        <p className="text-xs text-white/35 mt-0.5">Daily engagement across platforms</p>
      </div>

      {data.length === 0 ? (
        <div className="h-65 flex items-center justify-center">
          <p className="text-xs text-white/25">No engagement data yet</p>
        </div>
      ) : (
        <ChartContainer config={engagementConfig} className="h-65">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <defs>
              {Object.entries(engagementConfig).map(([key, cfg]) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="transparent"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="transparent"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="dot" />}
              cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {(['twitter', 'linkedin', 'instagram', 'tiktok'] as const).map(key => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={engagementConfig[key].color}
                strokeWidth={1.5}
                fillOpacity={1}
                fill={`url(#grad-${key})`}
                dot={false}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}
