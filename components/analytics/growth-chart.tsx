'use client';

/**
 * Growth Chart
 * Dual-axis line chart: follower count (left) + engagement (right).
 * Synthex card shell — no Card component, raw div with border-[0.5px] border-white/6.
 */

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { GrowthDataPoint } from './types';

const growthConfig: ChartConfig = {
  followers:  { label: 'Followers',   color: '#00FF88' },
  engagement: { label: 'Engagement',  color: '#FF6B35' },
};

interface GrowthChartProps {
  data: GrowthDataPoint[];
  collectingFollowerData?: boolean;
}

export function GrowthChart({ data, collectingFollowerData = false }: GrowthChartProps) {
  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      <div className="mb-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-0.5">Over Time</p>
        <h3 className="text-sm font-medium text-white/80">Growth Metrics</h3>
        <p className="text-xs text-white/35 mt-0.5">Follower growth and engagement trend</p>
      </div>

      {collectingFollowerData && (
        <p className="mb-3 text-[10px] text-white/25 border-[0.5px] border-white/6 bg-white/2 rounded-sm px-3 py-2">
          Collecting follower snapshots — check back in a few days.
        </p>
      )}

      {data.length === 0 ? (
        <div className="h-60 flex items-center justify-center">
          <p className="text-xs text-white/25">No growth data yet</p>
        </div>
      ) : (
        <ChartContainer config={growthConfig} className="h-60">
          <RechartsLineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="transparent"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              stroke="transparent"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="transparent"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="followers"
              stroke="#00FF88"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#00FF88' }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="engagement"
              stroke="#FF6B35"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#FF6B35' }}
            />
          </RechartsLineChart>
        </ChartContainer>
      )}
    </div>
  );
}
