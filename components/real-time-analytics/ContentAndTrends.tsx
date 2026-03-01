'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Heart, MessageSquare, Share2, Globe, Target, ArrowUp, ArrowDown
} from '@/components/icons';
import { platformIcons, formatNumber } from './constants';
import type { AnalyticsData } from './types';

interface ContentAndTrendsProps {
  topContent: AnalyticsData['topContent'];
  trends: AnalyticsData['trends'];
}

export function ContentAndTrends({ topContent, trends }: ContentAndTrendsProps) {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Performing Content */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Top Performing Content</CardTitle>
          <CardDescription>Your best performing posts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topContent.slice(0, 5).map((content) => {
              const Icon = platformIcons[content.platform as keyof typeof platformIcons] || Globe;

              return (
                <div key={content.id} className="flex items-start justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex gap-3 flex-1">
                    <Icon className="w-4 h-4 mt-1 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm line-clamp-2">{content.content}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Heart className="w-3 h-3" /> {formatNumber(content.likes)}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> {formatNumber(content.comments)}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Share2 className="w-3 h-3" /> {formatNumber(content.shares)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {formatNumber(content.engagement)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Trending Hashtags */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Trending Hashtags</CardTitle>
          <CardDescription>Popular hashtags in your niche</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trends.map((trend) => (
              <div key={trend.hashtag} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4 text-cyan-500" />
                  <div>
                    <p className="font-medium">{trend.hashtag}</p>
                    <p className="text-sm text-gray-400">{formatNumber(trend.mentions)} mentions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      trend.sentiment === 'positive' ? 'border-green-500 text-green-400' :
                      trend.sentiment === 'negative' ? 'border-red-500 text-red-400' :
                      'border-gray-500 text-gray-400'
                    }
                  >
                    {trend.sentiment}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {getChangeIcon(trend.growth)}
                    <span className={`text-sm font-medium ${getChangeColor(trend.growth)}`}>
                      {Math.abs(trend.growth)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
