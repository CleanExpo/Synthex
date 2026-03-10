'use client';

/**
 * Patterns Stats Component
 * Key insight cards
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Clock, Zap, Activity } from '@/components/icons';

const statsConfig = [
  {
    title: 'Avg Virality Score',
    value: '91.7',
    change: '+12.3% from last week',
    Icon: TrendingUp,
  },
  {
    title: 'Best Time to Post',
    value: '2-3 PM',
    change: 'Peak engagement window',
    Icon: Clock,
  },
  {
    title: 'Top Hook Type',
    value: 'Questions',
    change: '30% of viral posts',
    Icon: Zap,
  },
  {
    title: 'Avg Growth Rate',
    value: '+327%',
    change: 'First 24 hours',
    Icon: Activity,
  },
];

export function PatternsStats() {
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
