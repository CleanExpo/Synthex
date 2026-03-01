'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowDownRight, Info } from '@/components/icons';
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { FunnelStage } from './types';
import { COST_BREAKDOWN } from './types';

interface FunnelTabProps {
  funnelData: FunnelStage[];
}

export function FunnelTab({ funnelData }: FunnelTabProps) {
  return (
    <div className="space-y-6">
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Track drop-off at each stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {funnelData.map((stage, index) => (
              <div key={stage.name} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-cyan-400">{index + 1}</span>
                    </div>
                    <span className="font-medium text-white">{stage.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-white">{stage.value.toLocaleString()} users</span>
                    {index > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {stage.conversionRate}% conversion
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="ml-10">
                  <Progress value={(stage.value / funnelData[0].value) * 100} className="h-3" />
                </div>
                {index < funnelData.length - 1 && (
                  <div className="ml-10 mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <ArrowDownRight className="h-3 w-3" />
                    <span>{stage.dropOff}% drop-off</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-400" />
              <p className="text-sm font-medium text-white">Optimization Opportunities</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-300">&bull; Highest drop-off at Product Views &rarr; Add to Cart (60%)</p>
              <p className="text-xs text-gray-300">&bull; Consider improving product page design and CTAs</p>
              <p className="text-xs text-gray-300">&bull; Implement cart abandonment recovery campaigns</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>Marketing spend allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPie>
              <Pie
                data={COST_BREAKDOWN}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {COST_BREAKDOWN.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPie>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
