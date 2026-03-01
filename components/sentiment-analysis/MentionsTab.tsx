'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageSquare, Users } from '@/components/icons';
import type { SentimentData } from './types';
import { getSentimentIcon, getPriorityColor } from './helpers';

interface MentionsTabProps {
  sentimentData: SentimentData[];
}

export function MentionsTab({ sentimentData }: MentionsTabProps) {
  return (
    <div className="space-y-3">
      {sentimentData.slice(0, 10).map(item => (
        <Card key={item.id} variant="glass">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getSentimentIcon(item.sentiment)}
                <Badge variant="secondary">{item.platform}</Badge>
                <span className="text-xs text-gray-400">
                  @{item.author} • {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              <div className={`w-2 h-2 rounded-full ${getPriorityColor(item.priority)}`} />
            </div>

            <p className="text-sm text-gray-300 mb-3">{item.content}</p>

            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {item.engagement.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {item.engagement.comments}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {item.engagement.reach}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={item.actionable ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {item.actionable ? 'Action Required' : 'Monitor'}
                </Badge>
                <span className="text-xs text-gray-400">
                  {(item.confidence).toFixed(0)}% confidence
                </span>
              </div>
            </div>

            {item.topics.length > 0 && (
              <div className="flex gap-2 mt-3">
                {item.topics.map(topic => (
                  <Badge key={topic} className="bg-cyan-500/20 text-cyan-400 text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
