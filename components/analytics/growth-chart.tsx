'use client';

/**
 * Growth Chart Component
 * Line chart showing follower growth and engagement rate.
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
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { GrowthDataPoint } from './types';

// Brand amber design token (app/globals.css --color-amber) — not a raw hex.
const FOLLOWERS_COLOR = 'rgb(var(--color-amber))';
const ENGAGEMENT_COLOR = '#FBBF24'; // amber-400

const growthConfig: ChartConfig = {
  followers: { label: 'Followers', color: FOLLOWERS_COLOR },
  engagement: { label: 'Engagement', color: ENGAGEMENT_COLOR },
};

interface GrowthChartProps {
  data: GrowthDataPoint[];
  /**
   * When true, the follower series has fewer than 2 snapshot days, so we show an
   * honest "collecting data" state instead of a misleading single-point line.
   */
  collectingFollowerData?: boolean;
}

export function GrowthChart({
  data,
  collectingFollowerData = false,
}: GrowthChartProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Growth Metrics</CardTitle>
        <CardDescription className="text-slate-300">
          Follower growth and engagement over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {collectingFollowerData && (
          <p className="mb-3 text-xs text-slate-400">
            Collecting follower data — check back in a few days. Follower growth
            appears once a few daily snapshots have accumulated.
          </p>
        )}
        <ChartContainer config={growthConfig} className="h-[250px]">
          <RechartsLineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="month"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            />
            <YAxis
              yAxisId="left"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="followers"
              stroke={FOLLOWERS_COLOR}
              strokeWidth={2}
              dot={{ fill: FOLLOWERS_COLOR, r: 3 }}
              activeDot={{ r: 5, fill: FOLLOWERS_COLOR }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="engagement"
              stroke={ENGAGEMENT_COLOR}
              strokeWidth={2}
              dot={{ fill: ENGAGEMENT_COLOR, r: 3 }}
              activeDot={{ r: 5, fill: ENGAGEMENT_COLOR }}
            />
          </RechartsLineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
