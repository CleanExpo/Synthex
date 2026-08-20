'use client';

/**
 * Top Performing Posts
 * Ranked list of best-performing content this period.
 * Synthex design: sharp-corner rows, mono rank number, platform accent dots,
 * icon buttons, orange CTAs.
 */

import {
  Eye,
  Heart,
  BarChart3,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  ArrowRight,
} from '@/components/icons';
import type { TopPost } from './types';

interface TopPostsProps {
  posts: TopPost[];
  onViewDetails: (postId: number) => void;
  onViewAll: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'var(--platform-twitter)',
  linkedin: 'var(--platform-linkedin)',
  instagram: 'var(--platform-instagram)',
  facebook: 'var(--platform-facebook)',
  tiktok: 'var(--accent-brand)',
};

const platformIcons: Record<string, React.ElementType> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TopPosts({ posts, onViewDetails, onViewAll }: TopPostsProps) {
  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-0.5">
            Content
          </p>
          <h3 className="text-sm font-medium text-white/80">
            Top Performing Posts
          </h3>
          <p className="text-xs text-white/35 mt-0.5">
            Your best content this period
          </p>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* List */}
      {posts.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-white/25">No posts yet for this period</p>
        </div>
      ) : (
        <div className="space-y-1">
          {posts.map((post, i) => {
            const Icon = platformIcons[post.platform];
            const accent =
              PLATFORM_COLORS[post.platform] ?? 'var(--accent-brand)';
            return (
              <div
                key={post.id}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/3 transition-colors"
              >
                {/* Rank */}
                <span className="font-mono text-xs text-white/20 w-4 shrink-0 tabular-nums text-right">
                  {i + 1}
                </span>

                {/* Platform icon */}
                <span className="shrink-0" style={{ color: accent }}>
                  {Icon ? (
                    <Icon className="h-3.5 w-3.5" />
                  ) : (
                    <span
                      className="h-3.5 w-3.5 rounded-full inline-block"
                      style={{ backgroundColor: accent }}
                    />
                  )}
                </span>

                {/* Content */}
                <p className="flex-1 min-w-0 text-xs text-white/65 truncate leading-relaxed">
                  {post.content}
                </p>

                {/* Stats */}
                <div className="shrink-0 flex items-center gap-3 text-xs text-white/30">
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" /> {fmt(post.impressions)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="h-3 w-3" /> {fmt(post.engagement)}
                  </span>
                </div>

                {/* Details button */}
                <button
                  onClick={() => onViewDetails(post.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-white/70 text-white/30"
                  title="View details"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer CTA */}
      <button
        onClick={onViewAll}
        className="mt-4 w-full flex items-center justify-center gap-1.5 h-8 text-xs border-[0.5px] border-white/6 bg-white/2 hover:bg-white/5 text-white/40 hover:text-white/70 rounded-sm transition-colors"
      >
        View all posts <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
