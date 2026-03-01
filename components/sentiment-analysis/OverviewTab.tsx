'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { SentimentTrend } from './types';
import { CHART_TOOLTIP_STYLE } from './helpers';

interface OverviewTabProps {
  trends: SentimentTrend[];
  emotionRadarData: Array<{ emotion: string; score: number }>;
}

export function OverviewTab({ trends, emotionRadarData }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Sentiment Trend */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Sentiment Trend</CardTitle>
          <CardDescription>Track emotional patterns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#666"
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Area type="monotone" dataKey="positive" stackId="1" fill="#10b981" stroke="#10b981" />
              <Area type="monotone" dataKey="neutral" stackId="1" fill="#f59e0b" stroke="#f59e0b" />
              <Area type="monotone" dataKey="negative" stackId="1" fill="#ef4444" stroke="#ef4444" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Emotion Analysis */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Emotion Breakdown</CardTitle>
          <CardDescription>Detailed emotional analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={emotionRadarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="emotion" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="score" fill="#06b6d4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
