'use client';

/**
 * Top Posts Grid
 *
 * @description Two-column grid showing top and low performing posts.
 */

import { useState } from 'react';
import { TrendingUp, TrendingDown, Heart, MessageCircle, Share2, Eye } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { PostPerformance } from '@/lib/ai/content-performance-analyzer';

interface TopPostsGridProps {
  topPerforming: PostPerformance[];
  lowPerforming: PostPerformance[];
  isLoading?: boolean;
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  instagram: '#E4405F',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
  facebook: '#1877F2',
  tiktok: '#000000',
  pinterest: '#E60023',
  reddit: '#FF4500',
  threads: '#000000',
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength).trim() + '...';
}

interface PostCardProps {
  post: PostPerformance;
  type: 'top' | 'low';
}

function PostCard({ post, type }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const platformColor = PLATFORM_COLORS[post.platform] || '#6366f1';

  return (
    <div
      className={cn(
        'bg-gray-900/30 border rounded-lg p-3 cursor-pointer transition-all hover:bg-gray-900/50',
        type === 'top' ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-orange-500/20 hover:border-orange-500/40'
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: platformColor }}
          />
          <span className="text-xs text-gray-400 capitalize">{post.platform}</span>
        </div>
        <span className="text-xs text-gray-500">{formatDate(post.publishedAt)}</span>
      </div>

      {/* Content */}
      <p className="text-sm text-white mb-3">
        {expanded ? post.content : truncateContent(post.content)}
      </p>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Heart className="w-3 h-3" />
          <span>{formatNumber(post.metrics.likes)}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle className="w-3 h-3" />
          <span>{formatNumber(post.metrics.comments)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Share2 className="w-3 h-3" />
          <span>{formatNumber(post.metrics.shares)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          <span>{formatNumber(post.metrics.impressions)}</span>
        </div>
        <div className={cn('ml-auto font-medium', type === 'top' ? 'text-emerald-400' : 'text-orange-400')}>
          {post.metrics.engagementRate.toFixed(1)}%
        </div>
      </div>

      {/* Hashtags (expanded) */}
      {expanded && post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/5">
          {post.hashtags.map((tag) => (
            <span key={tag} className="text-xs text-cyan-400">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, colIdx) => (
        <div key={colIdx} className="bg-gray-900/30 border border-white/10 rounded-xl p-4">
          <div className="w-32 h-5 bg-white/5 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-3 animate-pulse">
                <div className="w-20 h-3 bg-white/5 rounded mb-2" />
                <div className="w-full h-12 bg-white/5 rounded mb-2" />
                <div className="flex gap-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="w-12 h-3 bg-white/5 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopPostsGrid({
  topPerforming,
  lowPerforming,
  isLoading,
  className,
}: TopPostsGridProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const hasData = topPerforming.length > 0 || lowPerforming.length > 0;

  if (!hasData) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-8', className)}>
        <p className="text-gray-500 text-center">No post data available</p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-4', className)}>
      {/* Top Performers */}
      <div className="bg-gray-900/30 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-medium text-white">Top Performers</h4>
          <span className="text-xs text-gray-500">({topPerforming.length})</span>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {topPerforming.length > 0 ? (
            topPerforming.slice(0, 5).map((post) => (
              <PostCard key={post.postId} post={post} type="top" />
            ))
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">No top performers found</p>
          )}
        </div>
      </div>

      {/* Needs Improvement */}
      <div className="bg-gray-900/30 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-4 h-4 text-orange-400" />
          <h4 className="text-sm font-medium text-white">Needs Improvement</h4>
          <span className="text-xs text-gray-500">({lowPerforming.length})</span>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {lowPerforming.length > 0 ? (
            lowPerforming.slice(0, 5).map((post) => (
              <PostCard key={post.postId} post={post} type="low" />
            ))
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">No underperforming posts</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TopPostsGrid;
