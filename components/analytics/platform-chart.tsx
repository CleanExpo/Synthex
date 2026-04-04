'use client';

/**
 * Platform Chart Component
 * Pie chart showing platform distribution.
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
  type ChartConfig,
} from '@/components/ui/chart';
import { PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import type { PlatformDistributionItem } from './types';

// Build a dynamic config from incoming data; amber used as fallback colour
function buildPlatformConfig(data: PlatformDistributionItem[]): ChartConfig {
  return Object.fromEntries(
    data.map(item => [
      item.name.toLowerCase(),
      { label: item.name, color: item.color ?? '#D97706' },
    ])
  );
}

interface PlatformChartProps {
  data: PlatformDistributionItem[];
}

export function PlatformChart({ data }: PlatformChartProps) {
  const config = buildPlatformConfig(data);

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Platform Distribution</CardTitle>
        <CardDescription className="text-slate-300">
          Engagement by platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-sm text-slate-400">
              No platform data yet — connect a platform to see distribution
            </p>
          </div>
        ) : (
          <ChartContainer config={config} className="h-[300px]">
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={90}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color ?? '#D97706'}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={value => `${value}%`} />
                }
              />
            </RechartsPieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
