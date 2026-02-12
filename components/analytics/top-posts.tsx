'use client';

/**
 * Top Posts Component
 * List of top performing posts
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Heart, BarChart3, Twitter, Linkedin, Instagram, Facebook, Video } from 'lucide-react';
import type { TopPost } from './types';

interface TopPostsProps {
  posts: TopPost[];
  onViewDetails: (postId: number) => void;
  onViewAll: () => void;
}

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

function PlatformIcon({ platform }: { platform: string }) {
  const Icon = platformIcons[platform];
  return Icon ? <Icon className="h-4 w-4" /> : null;
}

export function TopPosts({ posts, onViewDetails, onViewAll }: TopPostsProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Top Performing Posts</CardTitle>
        <CardDescription className="text-slate-400">
          Your best content this period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start space-x-3">
                <PlatformIcon platform={post.platform} />
                <div>
                  <p className="text-sm text-white truncate max-w-[250px]">
                    {post.content}
                  </p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs text-slate-400 flex items-center">
                      <Eye className="h-3 w-3 mr-1" />
                      {(post.impressions / 1000).toFixed(1)}K
                    </span>
                    <span className="text-xs text-slate-400 flex items-center">
                      <Heart className="h-3 w-3 mr-1" />
                      {(post.engagement / 1000).toFixed(1)}K
                    </span>
                    <span className="text-xs text-slate-500">{post.date}</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => onViewDetails(post.id)}
                size="sm"
                variant="ghost"
                className="text-slate-400"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          onClick={onViewAll}
          variant="outline"
          className="w-full mt-4 bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          View All Posts
        </Button>
      </CardContent>
    </Card>
  );
}
