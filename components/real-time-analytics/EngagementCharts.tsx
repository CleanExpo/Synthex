'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { COLORS } from './constants';
import type { AnalyticsData } from './types';

interface EngagementChartsProps {
  performance: AnalyticsData['performance'];
  platforms: AnalyticsData['platforms'];
}

export function EngagementCharts({ performance, platforms }: EngagementChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Engagement Over Time */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Engagement Over Time</CardTitle>
          <CardDescription>Daily engagement and reach trends</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performance.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                labelStyle={{ color: '#888' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="engagement"
                stroke="#06b6d4"
                fill="#06b6d4"
                fillOpacity={0.3}
                name="Engagement"
              />
              <Area
                type="monotone"
                dataKey="reach"
                stroke="#ec4899"
                fill="#ec4899"
                fillOpacity={0.3}
                name="Reach"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Platform Distribution */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Platform Distribution</CardTitle>
          <CardDescription>Follower distribution across platforms</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={Object.entries(platforms).map(([platform, data]) => ({
                  name: platform.charAt(0).toUpperCase() + platform.slice(1),
                  value: data.followers
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {Object.keys(platforms).map((platform, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
