'use client';

/**
 * Engagement Timeline Chart Component
 * Area chart showing peak engagement times by platform
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from '@/components/icons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { engagementData } from './patterns-config';

export function EngagementTimelineChart() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Engagement Timeline</span>
          <BarChart3 className="h-4 w-4 text-cyan-500" />
        </CardTitle>
        <CardDescription className="text-gray-400">
          Peak engagement times by platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={engagementData}>
            <defs>
              <linearGradient id="colorTwitter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1DA1F2" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#1DA1F2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLinkedIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0077B5" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#0077B5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTikTok" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF0050" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#FF0050" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="hour" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="twitter"
              stroke="#1DA1F2"
              fillOpacity={1}
              fill="url(#colorTwitter)"
            />
            <Area
              type="monotone"
              dataKey="linkedin"
              stroke="#0077B5"
              fillOpacity={1}
              fill="url(#colorLinkedIn)"
            />
            <Area
              type="monotone"
              dataKey="tiktok"
              stroke="#FF0050"
              fillOpacity={1}
              fill="url(#colorTikTok)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
