'use client';

/**
 * Platform Distribution Chart
 * Donut pie chart — share of posts / engagement per platform.
 * Synthex card shell — raw div, no Card component.
 */

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import type { PlatformDistributionItem } from './types';

function buildConfig(data: PlatformDistributionItem[]): ChartConfig {
  return Object.fromEntries(
    data.map(item => [item.name.toLowerCase(), { label: item.name, color: item.color ?? '#FF6B35' }])
  );
}

interface PlatformChartProps {
  data: PlatformDistributionItem[];
}

export function PlatformChart({ data }: PlatformChartProps) {
  const config = buildConfig(data);

  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      <div className="mb-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-0.5">Breakdown</p>
        <h3 className="text-sm font-medium text-white/80">Platform Distribution</h3>
        <p className="text-xs text-white/35 mt-0.5">Share of posts by platform</p>
      </div>

      {data.length === 0 ? (
        <div className="h-65 flex items-center justify-center">
          <p className="text-xs text-white/25">No platform data yet</p>
        </div>
      ) : (
        <>
          <ChartContainer config={config} className="h-55">
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color ?? '#FF6B35'} />
                ))}
              </Pie>
              <ChartTooltip
                content={<ChartTooltipContent formatter={v => `${v}%`} />}
                cursor={false}
              />
            </RechartsPieChart>
          </ChartContainer>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {data.map(item => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color ?? '#FF6B35' }} />
                <span className="text-[10px] text-white/50">{item.name}</span>
                <span className="font-mono text-[10px] text-white/70">{item.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
