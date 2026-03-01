'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Plus, MoreVertical, Globe } from '@/components/icons';
import { format } from 'date-fns';
import { platformIcons } from './constants';
import type { ScheduledPost } from './types';

interface SelectedDatePostsProps {
  selectedDate: Date;
  posts: ScheduledPost[];
  onCreatePost: () => void;
}

export function SelectedDatePosts({ selectedDate, posts, onCreatePost }: SelectedDatePostsProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Posts for {format(selectedDate, 'MMMM d, yyyy')}</CardTitle>
        <CardDescription>
          {posts.length} scheduled posts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {post.platforms.map(platform => {
                        const Icon = platformIcons[platform as keyof typeof platformIcons] || Globe;
                        return <Icon key={platform} className="w-4 h-4 text-gray-400" />;
                      })}
                      <span className="text-sm text-gray-400">
                        {format(post.scheduledTime, 'h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm">{post.content}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="More post options">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No posts scheduled for this date</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={onCreatePost}
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Post
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
