'use client';

/**
 * ReviewQueue — Human-in-the-Loop Approval Panel
 *
 * Fetches all draft posts for the active user and presents them for
 * review before they are approved (status → scheduled) and published
 * by the cron job.
 *
 * Usage:
 *   <ReviewQueue onEdit={post => setSelectedPost(post)} />
 *
 * Design:
 * - Collapsed by default when there are no drafts
 * - Expanded automatically when draft posts are found
 * - Approve → PATCH /api/scheduler/posts { status: 'scheduled' }
 * - Edit    → calls onEdit() with the raw API post so parent can open PostDetailModal
 * - Reject  → DELETE /api/scheduler/posts?id=<id>
 */

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  Sparkles,
  Calendar,
  Loader2,
} from '@/components/icons';
import { fetchWithCSRF } from '@/lib/csrf';
import { fetchJson } from '@/lib/fetcher';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewPost {
  id: string;
  content: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  campaign: {
    id: string;
    name: string;
  };
}

interface ReviewQueueProps {
  /** Called when user clicks Edit on a draft post */
  onEdit?: (post: ReviewPost) => void;
  /** Called after a post is approved, rejected, or edited (triggers parent refresh) */
  onMutate?: () => void;
}

// ---------------------------------------------------------------------------
// Platform display helpers
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter / X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  reddit: 'Reddit',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

const PLATFORM_COLOURS: Record<string, string> = {
  linkedin: '#0077B5',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  instagram: '#E4405F',
  youtube: '#FF0000',
  reddit: '#FF4500',
  tiktok: '#010101',
  pinterest: '#E60023',
};

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p.toLowerCase()] ?? p;
}

function platformColour(p: string): string {
  return PLATFORM_COLOURS[p.toLowerCase()] ?? '#64748b';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReviewQueue({ onEdit, onMutate }: ReviewQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Set<string>>(new Set());

  const { data, isLoading, mutate } = useSWR(
    '/api/scheduler/posts?status=draft&limit=100&sortBy=scheduledAt&sortOrder=asc',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const posts: ReviewPost[] = useMemo(() => data?.data ?? [], [data]);
  const count = posts.length;

  // Auto-collapse when empty
  const showBody = isExpanded && count > 0;

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = useCallback(
    async (post: ReviewPost) => {
      setApproving(prev => new Set(prev).add(post.id));
      try {
        const res = await fetchWithCSRF('/api/scheduler/posts', {
          method: 'PATCH',
          body: JSON.stringify({ id: post.id, status: 'scheduled' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(
          `Post approved — will publish ${post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'when scheduled'}`
        );
        await mutate();
        onMutate?.();
      } catch {
        toast.error('Failed to approve post. Please try again.');
      } finally {
        setApproving(prev => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
      }
    },
    [mutate, onMutate]
  );

  // ── Approve All ────────────────────────────────────────────────────────────
  const handleApproveAll = useCallback(async () => {
    const ids = posts.map(p => p.id);
    setApproving(new Set(ids));
    try {
      const res = await fetchWithCSRF('/api/scheduler/posts/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'set-status',
          postIds: ids,
          status: 'scheduled',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`${ids.length} posts approved and scheduled`);
      await mutate();
      onMutate?.();
    } catch {
      toast.error('Failed to approve all posts.');
    } finally {
      setApproving(new Set());
    }
  }, [posts, mutate, onMutate]);

  // ── Reject ─────────────────────────────────────────────────────────────────
  const handleReject = useCallback(
    async (post: ReviewPost) => {
      if (!confirm(`Discard this post?\n\n"${post.content.slice(0, 100)}..."`))
        return;
      setRejecting(prev => new Set(prev).add(post.id));
      try {
        const res = await fetchWithCSRF(`/api/scheduler/posts?id=${post.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success('Post discarded');
        await mutate();
        onMutate?.();
      } catch {
        toast.error('Failed to discard post. Please try again.');
      } finally {
        setRejecting(prev => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
      }
    },
    [mutate, onMutate]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card variant="glass" className="border-orange-500/20">
        <CardContent className="py-4 flex items-center gap-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading review queue…</span>
        </CardContent>
      </Card>
    );
  }

  if (count === 0) {
    return null; // Nothing to review — hide entirely
  }

  return (
    <Card variant="glass" className="border-orange-500/30 bg-orange-500/5">
      {/* Header */}
      <CardHeader className="pb-0 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Sparkles className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                Review Queue
                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                  {count} awaiting approval
                </Badge>
              </CardTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                These posts are drafted and ready — approve each one to schedule
                it for publishing.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {count > 1 && (
              <Button
                size="sm"
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs"
                onClick={handleApproveAll}
                disabled={approving.size > 0}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Approve All {count}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white"
              onClick={() => setIsExpanded(v => !v)}
            >
              {showBody ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Post list */}
      {showBody && (
        <CardContent className="pt-4 pb-4 px-4 space-y-3">
          {posts.map(post => (
            <ReviewPostCard
              key={post.id}
              post={post}
              isApproving={approving.has(post.id)}
              isRejecting={rejecting.has(post.id)}
              onApprove={() => handleApprove(post)}
              onEdit={() => onEdit?.(post)}
              onReject={() => handleReject(post)}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Individual post card
// ---------------------------------------------------------------------------

interface ReviewPostCardProps {
  post: ReviewPost;
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}

function ReviewPostCard({
  post,
  isApproving,
  isRejecting,
  onApprove,
  onEdit,
  onReject,
}: ReviewPostCardProps) {
  const [expanded, setExpanded] = useState(false);

  const colour = platformColour(post.platform);
  const contentPreview =
    post.content.length > 180 ? post.content.slice(0, 180) + '…' : post.content;
  const scheduledDate = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleString('en-AU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not yet scheduled';

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
      {/* Top row: platform + campaign + date */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Platform chip */}
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${colour}25`,
              color: colour,
              border: `1px solid ${colour}40`,
            }}
          >
            {platformLabel(post.platform)}
          </span>
          {/* Campaign name */}
          <span className="text-xs text-slate-300 truncate max-w-[180px]">
            {post.campaign.name}
          </span>
        </div>
        {/* Scheduled date */}
        <div className="flex items-center gap-1 text-xs text-slate-300">
          <Calendar className="h-3 w-3" />
          <span>{scheduledDate}</span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
        {expanded ? post.content : contentPreview}
      </p>

      {post.content.length > 180 && (
        <button
          className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
          onClick={() => setExpanded(v => !v)}
        >
          <Eye className="h-3 w-3" />
          {expanded ? 'Show less' : 'Show full post'}
        </button>
      )}

      {/* Action buttons */}
      <div
        className="flex items-center gap-2 pt-1"
        onClick={e => e.stopPropagation()}
      >
        {/* Approve */}
        <Button
          size="sm"
          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs h-7 px-3"
          onClick={onApprove}
          disabled={isApproving || isRejecting}
        >
          {isApproving ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3 mr-1.5" />
          )}
          Approve
        </Button>

        {/* Edit */}
        <Button
          size="sm"
          variant="ghost"
          className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 text-xs h-7 px-3"
          onClick={onEdit}
          disabled={isApproving || isRejecting}
        >
          <Edit className="h-3 w-3 mr-1.5" />
          Edit
        </Button>

        {/* Reject / Discard */}
        <Button
          size="sm"
          variant="ghost"
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 px-3 ml-auto"
          onClick={onReject}
          disabled={isApproving || isRejecting}
        >
          {isRejecting ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3 mr-1.5" />
          )}
          Discard
        </Button>
      </div>
    </div>
  );
}
