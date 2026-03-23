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

const growthConfig: ChartConfig = {
  followers: { label: 'Followers', color: '#D97706' }, // amber-600
  engagement: { label: 'Engagement', color: '#FBBF24' }, // amber-400
};

interface GrowthChartProps {
  data: GrowthDataPoint[];
}

export function GrowthChart({ data }: GrowthChartProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Growth Metrics</CardTitle>
        <CardDescription className="text-slate-300">
          Follower growth and engagement over time
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              stroke="#D97706"
              strokeWidth={2}
              dot={{ fill: '#D97706', r: 3 }}
              activeDot={{ r: 5, fill: '#D97706' }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="engagement"
              stroke="#FBBF24"
              strokeWidth={2}
              dot={{ fill: '#FBBF24', r: 3 }}
              activeDot={{ r: 5, fill: '#FBBF24' }}
            />
          </RechartsLineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
