'use client';

/**
 * List View Component
 * List of scheduled posts with actions
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Send, Trash2, AlertTriangle } from '@/components/icons';
import { getPlatformIconComponent } from './schedule-config';
import { PLATFORM_COLORS } from '@/components/calendar';
import type { ScheduledPost } from './types';

interface ListViewProps {
  posts: ScheduledPost[];
  hasFilters: boolean;
  onPostClick: (post: ScheduledPost) => void;
  onCreatePost: () => void;
  onPublishNow: (postId: string) => void;
  onDeletePost: (postId: string) => void;
}

export function ListView({
  posts,
  hasFilters,
  onPostClick,
  onCreatePost,
  onPublishNow,
  onDeletePost,
}: ListViewProps) {
  if (posts.length === 0) {
    return (
      <Card variant="glass">
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No posts found</h3>
          <p className="text-slate-400 mb-4">
            {hasFilters
              ? 'Try adjusting your filters'
              : 'Create your first scheduled post to get started'}
          </p>
          <Button onClick={onCreatePost} className="gradient-primary text-white">
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sortedPosts = [...posts].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedPosts.map(post => (
        <PostListItem
          key={post.id}
          post={post}
          onClick={() => onPostClick(post)}
          onPublishNow={() => onPublishNow(post.id)}
          onDelete={() => onDeletePost(post.id)}
        />
      ))}
    </div>
  );
}

interface PostListItemProps {
  post: ScheduledPost;
  onClick: () => void;
  onPublishNow: () => void;
  onDelete: () => void;
}

function PostListItem({ post, onClick, onPublishNow, onDelete }: PostListItemProps) {
  return (
    <Card
      variant="glass"
      className="cursor-pointer hover:border-cyan-500/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="flex -space-x-1">
                {post.platforms.slice(0, 3).map(platform => {
                  const color = PLATFORM_COLORS[platform];
                  const IconComponent = getPlatformIconComponent(platform);
                  return (
                    <div
                      key={platform}
                      className="p-2 rounded-lg border-2 border-slate-900"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      {IconComponent && <IconComponent className="h-4 w-4" />}
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {post.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(post.scheduledFor).toLocaleString()}
                </p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                post.status === 'published'
                  ? 'bg-green-500/20 text-green-300'
                  : post.status === 'scheduled'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-500/20 text-slate-300'
              }`}>
                {post.status}
              </span>
              {post.conflict && (
                <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Conflict
                </span>
              )}
            </div>
            <p className="text-white mb-3">{post.content}</p>
            <div className="flex items-center space-x-4 text-xs text-slate-400">
              {post.persona && <span>Persona: {post.persona}</span>}
              {post.status === 'published' && post.engagement ? (
                <>
                  <span>❤️ {post.engagement.likes}</span>
                  <span>💬 {post.engagement.comments}</span>
                  <span>🔄 {post.engagement.shares}</span>
                  <span className="text-green-400">
                    {post.engagement.actual}% engagement
                  </span>
                </>
              ) : post.engagement?.estimated ? (
                <span className="text-cyan-400">
                  Est. {post.engagement.estimated}% engagement
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
            {post.status === 'scheduled' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onPublishNow}
                className="text-slate-400 hover:text-green-400"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
