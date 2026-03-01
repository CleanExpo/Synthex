'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon, Clock, Edit3, Trash2,
  Globe, Repeat, Eye, Copy, CheckCircle, XCircle, TrendingUp
} from '@/components/icons';
import { format } from 'date-fns';
import { platformIcons, platformColors } from './constants';
import type { ScheduledPost } from './types';

interface ListViewProps {
  scheduledPosts: ScheduledPost[];
  selectedPlatform: string;
  onDuplicate: (post: ScheduledPost) => void;
  onEdit: (post: ScheduledPost) => void;
  onDelete: (postId: string) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'scheduled': return 'text-yellow-500';
    case 'published': return 'text-green-500';
    case 'failed': return 'text-red-500';
    case 'draft': return 'text-gray-500';
    default: return 'text-gray-400';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'scheduled': return <Clock className="w-4 h-4" />;
    case 'published': return <CheckCircle className="w-4 h-4" />;
    case 'failed': return <XCircle className="w-4 h-4" />;
    case 'draft': return <Edit3 className="w-4 h-4" />;
    default: return null;
  }
}

export function ListView({ scheduledPosts, selectedPlatform, onDuplicate, onEdit, onDelete }: ListViewProps) {
  const filteredPosts = scheduledPosts
    .filter(post => selectedPlatform === 'all' || post.platforms.includes(selectedPlatform))
    .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

  return (
    <div className="space-y-3">
      {filteredPosts.map(post => (
        <Card key={post.id} variant="glass">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {post.platforms.map(platform => {
                    const Icon = platformIcons[platform as keyof typeof platformIcons] || Globe;
                    return (
                      <div
                        key={platform}
                        className={`p-1 rounded ${platformColors[platform as keyof typeof platformColors]}`}
                      >
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                    );
                  })}
                  <span className={`flex items-center gap-1 text-sm ${getStatusColor(post.status)}`}>
                    {getStatusIcon(post.status)}
                    {post.status}
                  </span>
                  {post.isRecurring && (
                    <Badge variant="outline" className="text-xs">
                      <Repeat className="w-3 h-3 mr-1" />
                      {post.recurringPattern}
                    </Badge>
                  )}
                </div>
                <p className="text-sm mb-2 line-clamp-2">{post.content}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {format(post.scheduledTime, 'MMM d, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(post.scheduledTime, 'h:mm a')}
                  </span>
                  {post.hashtags && post.hashtags.length > 0 && (
                    <span>{post.hashtags.length} hashtags</span>
                  )}
                </div>
                {post.analytics && post.status === 'published' && (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-green-400">
                      <Eye className="w-3 h-3 inline mr-1" />
                      {post.analytics.impressions?.toLocaleString()} views
                    </span>
                    <span className="text-blue-400">
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      {post.analytics.engagement} engagements
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Duplicate post"
                  onClick={() => onDuplicate(post)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit post"
                  onClick={() => onEdit(post)}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete post"
                  onClick={() => onDelete(post.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
