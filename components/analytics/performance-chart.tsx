'use client';

/**
 * Performance Chart Component
 * Radar chart showing content performance by platform.
 * Wrapped with Shadcn ChartContainer + ChartTooltipContent (amber design tokens).
 * NOTE: #10b981 (green) removed — replaced with amber palette per design system.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

// Amber-only palette for radar layers
const performanceConfig: ChartConfig = {
  engagement: { label: 'Engagement', color: '#D97706' }, // amber-600
  reach: { label: 'Reach', color: '#FBBF24' }, // amber-400
  clicks: { label: 'Clicks', color: '#B45309' }, // amber-700
};

interface PerformanceChartProps {
  data: ContentPerformanceItem[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Content Performance by Platform</CardTitle>
        <CardDescription className="text-slate-300">
          Engagement, reach and posts by platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={performanceConfig} className="h-[300px]">
          <RadarChart data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="type"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            />
            <PolarRadiusAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            />
            <Radar
              name="Engagement"
              dataKey="engagement"
              stroke="#D97706"
              fill="#D97706"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Radar
              name="Reach"
              dataKey="reach"
              stroke="#FBBF24"
              fill="#FBBF24"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Radar
              name="Clicks"
              dataKey="clicks"
              stroke="#B45309"
              fill="#B45309"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <ChartTooltip content={<ChartTooltipContent />} />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
