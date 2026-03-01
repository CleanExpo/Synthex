'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Hash, TrendingUp, TrendingDown } from '@/components/icons';
import type { TopicSentiment } from './types';
import { getSentimentColor } from './helpers';

interface TopicsTabProps {
  topicSentiments: TopicSentiment[];
}

export function TopicsTab({ topicSentiments }: TopicsTabProps) {
  return (
    <div className="space-y-4">
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Topic Sentiment</CardTitle>
          <CardDescription>Sentiment analysis by topic</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topicSentiments.sort((a, b) => b.mentions - a.mentions).map(topic => (
              <div key={topic.topic} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-white capitalize">{topic.topic}</span>
                    <Badge variant="secondary" className="text-xs">
                      {topic.mentions} mentions
                    </Badge>
                    {topic.trend === 'rising' && <TrendingUp className="h-4 w-4 text-green-400" />}
                    {topic.trend === 'falling' && <TrendingDown className="h-4 w-4 text-red-400" />}
                  </div>
                  <div className="flex items-center gap-4">
                    <Progress
                      value={(topic.sentiment + 1) * 50}
                      className="flex-1 h-2"
                    />
                    <span className={`text-sm font-medium ${getSentimentColor(topic.sentiment)}`}>
                      {(topic.sentiment * 100).toFixed(0)}
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
