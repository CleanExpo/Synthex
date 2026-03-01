'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, ArrowUp, ArrowDown } from '@/components/icons';
import { platformIcons, platformColors, formatNumber } from './constants';
import type { AnalyticsData } from './types';

interface PlatformPerformanceProps {
  platforms: AnalyticsData['platforms'];
}

export function PlatformPerformance({ platforms }: PlatformPerformanceProps) {
  const getChangeIcon = (value: number) => {
    return value >= 0 ? (
      <ArrowUp className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowDown className="w-4 h-4 text-red-500" />
    );
  };

  const getChangeColor = (value: number) => {
    return value >= 0 ? 'text-green-500' : 'text-red-500';
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Platform Performance</CardTitle>
        <CardDescription>Detailed metrics for each social platform</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(platforms).map(([platform, data]) => {
            const Icon = platformIcons[platform as keyof typeof platformIcons] || Globe;
            const color = platformColors[platform as keyof typeof platformColors] || '#888';

            return (
              <div key={platform} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{platform}</p>
                    <p className="text-sm text-gray-400">
                      {formatNumber(data.followers)} followers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Engagement</p>
                    <p className="font-medium">{formatNumber(data.engagement)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Posts</p>
                    <p className="font-medium">{data.posts}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Reach</p>
                    <p className="font-medium">{formatNumber(data.reach)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(data.growth)}
                    <span className={`text-sm font-medium ${getChangeColor(data.growth)}`}>
                      {data.growth}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
