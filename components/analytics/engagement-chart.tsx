'use client';

/**
 * Engagement Chart Component
 * Area chart showing engagement trends across platforms.
 * Wrapped with Shadcn ChartContainer + ChartTooltipContent (amber design tokens).
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { EngagementDataPoint } from './types';

// Amber-first chart config — platform lines use their brand colours
const engagementConfig: ChartConfig = {
  twitter: { label: 'Twitter / X', color: '#1DA1F2' },
  linkedin: { label: 'LinkedIn', color: '#0077B5' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  tiktok: { label: 'TikTok', color: '#D97706' }, // amber fallback for TikTok
};

interface EngagementChartProps {
  data: EngagementDataPoint[];
}

export function EngagementChart({ data }: EngagementChartProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Engagement Trend</CardTitle>
        <CardDescription className="text-slate-300">
          Daily engagement across platforms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={engagementConfig} className="h-[300px]">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="engTwitter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1DA1F2" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#1DA1F2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="engLinkedin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0077B5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0077B5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="engInstagram" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E4405F" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#E4405F" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="engTiktok" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D97706" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="twitter"
              stroke="#1DA1F2"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#engTwitter)"
            />
            <Area
              type="monotone"
              dataKey="linkedin"
              stroke="#0077B5"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#engLinkedin)"
            />
            <Area
              type="monotone"
              dataKey="instagram"
              stroke="#E4405F"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#engInstagram)"
            />
            <Area
              type="monotone"
              dataKey="tiktok"
              stroke="#D97706"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#engTiktok)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
