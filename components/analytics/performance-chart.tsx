'use client';

/**
 * Platform Performance Radar Chart
 * Engagement / reach / posts per platform.
 * Synthex card shell — raw div, no Card component.
 */

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import type { ContentPerformanceItem } from './types';

const performanceConfig: ChartConfig = {
  engagement: { label: 'Engagement', color: '#FF6B35' },
  reach:      { label: 'Reach',      color: '#00F5FF' },
  clicks:     { label: 'Posts',      color: '#00FF88' },
};

interface PerformanceChartProps {
  data: ContentPerformanceItem[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      <div className="mb-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-0.5">Radar</p>
        <h3 className="text-sm font-medium text-white/80">Performance by Platform</h3>
        <p className="text-xs text-white/35 mt-0.5">Engagement, reach, and posts per platform</p>
      </div>

      {data.length === 0 ? (
        <div className="h-70 flex items-center justify-center">
          <p className="text-xs text-white/25">No platform data yet</p>
        </div>
      ) : (
        <ChartContainer config={performanceConfig} className="h-70">
          <RadarChart data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.06)" />
            <PolarAngleAxis
              dataKey="type"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            />
            <PolarRadiusAxis
              stroke="transparent"
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
            />
            <Radar name="Engagement" dataKey="engagement" stroke="#FF6B35" fill="#FF6B35" fillOpacity={0.15} strokeWidth={1.5} />
            <Radar name="Reach"      dataKey="reach"      stroke="#00F5FF" fill="#00F5FF" fillOpacity={0.12} strokeWidth={1.5} />
            <Radar name="Posts"      dataKey="clicks"     stroke="#00FF88" fill="#00FF88" fillOpacity={0.12} strokeWidth={1.5} />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
          </RadarChart>
        </ChartContainer>
      )}
    </div>
  );
}
