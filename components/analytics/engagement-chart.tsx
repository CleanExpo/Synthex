'use client';

/**
 * Engagement Chart Component
 * Area chart showing engagement trends across platforms
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { platformColors } from './analytics-config';
import type { EngagementDataPoint } from './types';

interface EngagementChartProps {
  data: EngagementDataPoint[];
}

export function EngagementChart({ data }: EngagementChartProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Engagement Trend</CardTitle>
        <CardDescription className="text-slate-400">
          Daily engagement across platforms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorTwitter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={platformColors.twitter} stopOpacity={0.3} />
                <stop offset="95%" stopColor={platformColors.twitter} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLinkedin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={platformColors.linkedin} stopOpacity={0.3} />
                <stop offset="95%" stopColor={platformColors.linkedin} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorInstagram" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={platformColors.instagram} stopOpacity={0.3} />
                <stop offset="95%" stopColor={platformColors.instagram} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #333',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="twitter"
              stroke={platformColors.twitter}
              fillOpacity={1}
              fill="url(#colorTwitter)"
            />
            <Area
              type="monotone"
              dataKey="linkedin"
              stroke={platformColors.linkedin}
              fillOpacity={1}
              fill="url(#colorLinkedin)"
            />
            <Area
              type="monotone"
              dataKey="instagram"
              stroke={platformColors.instagram}
              fillOpacity={1}
              fill="url(#colorInstagram)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
