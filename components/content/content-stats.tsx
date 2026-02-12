'use client';

/**
 * Content Stats Component
 * Statistics cards for content generation metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart3, Clock, Target } from '@/components/icons';

const statsConfig = [
  {
    title: 'Generated Today',
    value: '24',
    change: '+12% from yesterday',
    Icon: Sparkles,
  },
  {
    title: 'Avg Engagement',
    value: '8.7%',
    change: 'Above industry avg',
    Icon: BarChart3,
  },
  {
    title: 'Scheduled',
    value: '15',
    change: 'Next 7 days',
    Icon: Clock,
  },
  {
    title: 'Success Rate',
    value: '92%',
    change: 'Hit targets',
    Icon: Target,
  },
];

export function ContentStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsConfig.map(({ title, value, change, Icon }) => (
        <Card key={title} variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
            <Icon className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{value}</div>
            <p className="text-xs text-gray-500 mt-1">{change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
