'use client';

/**
 * Platform Radar Chart Component
 * Comparative analysis across platforms
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from '@/components/icons';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { radarData } from './patterns-config';

export function PlatformRadarChart() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Platform Performance Matrix</span>
          <Activity className="h-4 w-4 text-cyan-500" />
        </CardTitle>
        <CardDescription className="text-gray-400">
          Comparative analysis across platforms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#333" />
            <PolarAngleAxis dataKey="metric" stroke="#666" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#666" />
            <Radar name="Twitter" dataKey="twitter" stroke="#1DA1F2" fill="#1DA1F2" fillOpacity={0.3} />
            <Radar name="LinkedIn" dataKey="linkedin" stroke="#0077B5" fill="#0077B5" fillOpacity={0.3} />
            <Radar name="TikTok" dataKey="tiktok" stroke="#FF0050" fill="#FF0050" fillOpacity={0.3} />
            <Radar name="Instagram" dataKey="instagram" stroke="#E4405F" fill="#E4405F" fillOpacity={0.3} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
