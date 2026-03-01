'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Copy, Check, MessageSquare } from '@/components/icons';
import { platformIcons, platformColors } from './constants';
import type { GeneratedContent } from './types';

interface ContentHistoryProps {
  contentHistory: GeneratedContent[];
  copiedContent: string;
  onSelectContent: (content: GeneratedContent) => void;
  onCopy: (text: string, type: string) => void;
}

export function ContentHistory({
  contentHistory,
  copiedContent,
  onSelectContent,
  onCopy,
}: ContentHistoryProps) {
  if (contentHistory.length === 0) return null;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-500" />
          Recent Generations
        </CardTitle>
        <CardDescription>Your content generation history</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {contentHistory.map((item) => {
            const Icon = platformIcons[item.platform as keyof typeof platformIcons] || MessageSquare;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => onSelectContent(item)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${platformColors[item.platform as keyof typeof platformColors]}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-md">
                      {item.content.substring(0, 50)}...
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.metadata.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {item.viralScore}%
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Copy trending content"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopy(item.content, item.id);
                    }}
                  >
                    {copiedContent === item.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
