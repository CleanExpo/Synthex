'use client';

/**
 * Performance Chart Component
 * Radar chart showing content performance by type
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ContentPerformanceItem } from './types';

interface PerformanceChartProps {
  data: ContentPerformanceItem[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Content Performance by Type</CardTitle>
        <CardDescription className="text-slate-400">
          Engagement metrics by content category
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data}>
            <PolarGrid stroke="#333" />
            <PolarAngleAxis dataKey="type" stroke="#666" />
            <PolarRadiusAxis stroke="#666" />
            <Radar
              name="Engagement"
              dataKey="engagement"
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.3}
            />
            <Radar
              name="Reach"
              dataKey="reach"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.3}
            />
            <Radar
              name="Clicks"
              dataKey="clicks"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.3}
            />
            <Legend />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #333',
                borderRadius: '8px',
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
