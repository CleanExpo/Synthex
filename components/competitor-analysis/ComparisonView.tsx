'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Competitor } from './types';

interface ComparisonViewProps {
  competitors: Competitor[];
  selectedIds: string[];
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(0,0,0,0.8)',
  border: '1px solid rgba(6, 182, 212, 0.3)',
  borderRadius: '8px',
};

export function ComparisonView({ competitors, selectedIds }: ComparisonViewProps) {
  const selected = competitors.filter(c => selectedIds.includes(c.id));

  const followersData = selected.map(c => ({
    name: c.name,
    value: c.metrics.followers.total,
  }));

  const engagementData = selected.map(c => ({
    name: c.name,
    twitter: c.metrics.engagement.twitter || 0,
    instagram: c.metrics.engagement.instagram || 0,
    linkedin: c.metrics.engagement.linkedin || 0,
  }));

  const radarData = selected.map(c => ({
    competitor: c.name,
    followers: (c.metrics.followers.total / 1_000_000) * 10,
    engagement: c.metrics.engagement.total * 10,
    growth: c.metrics.growthRate,
    sentiment: c.metrics.sentimentScore / 10,
    frequency: c.metrics.postFrequency.total / 5,
  }));

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Competitor Comparison</CardTitle>
        <CardDescription>Comparing {selectedIds.length} competitors</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Follower Comparison */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Total Followers</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={followersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement by Platform */}
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Engagement by Platform</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="twitter" fill="#1DA1F2" />
                <Bar dataKey="instagram" fill="#E4405F" />
                <Bar dataKey="linkedin" fill="#0077B5" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Comparison */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-medium text-white mb-3">Overall Performance</h4>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData[0] ? [radarData[0]] : []}>
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="competitor" stroke="#666" tick={{ fill: '#999', fontSize: 12 }} />
                <PolarRadiusAxis stroke="#666" />
                {radarData.map((_, index) => (
                  <Radar
                    key={index}
                    name={selected[index]?.name || ''}
                    dataKey="followers"
                    stroke={['#06b6d4', '#ec4899', '#3b82f6'][index]}
                    fill={['#06b6d4', '#ec4899', '#3b82f6'][index]}
                    fillOpacity={0.3}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
