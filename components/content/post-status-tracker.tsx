'use client';

/**
 * Post Status Tracker
 *
 * Displays per-platform publish status for a batch of cross-posted content.
 * Fetches posts by batchId from the scheduler API and shows real-time status
 * (scheduled, published, failed) for each platform in the batch.
 */

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Check,
  AlertTriangle,
  Clock,
  Loader2,
  ExternalLink,
} from '@/components/icons';

// =============================================================================
// Types
// =============================================================================

export interface PostStatusTrackerProps {
  batchId: string;
  onRefresh?: () => void;
  onDismiss?: () => void;
}

interface ScheduledPost {
  id: string;
  content: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  metadata: Record<string, unknown> | null;
  campaign?: { id: string; name: string };
}

interface PostsResponse {
  data: ScheduledPost[];
  pagination: { total: number };
}

// =============================================================================
// Helpers
// =============================================================================

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  threads: 'Threads',
};

function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform.toLowerCase()] ?? platform;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  colour: string;
  bgColour: string;
  borderColour: string;
  Icon: typeof Check;
}> = {
  scheduled: {
    label: 'Scheduled',
    colour: 'text-blue-400',
    bgColour: 'bg-blue-500/10',
    borderColour: 'border-blue-500/20',
    Icon: Clock,
  },
  published: {
    label: 'Published',
    colour: 'text-emerald-400',
    bgColour: 'bg-emerald-500/10',
    borderColour: 'border-emerald-500/20',
    Icon: Check,
  },
  failed: {
    label: 'Failed',
    colour: 'text-red-400',
    bgColour: 'bg-red-500/10',
    borderColour: 'border-red-500/20',
    Icon: AlertTriangle,
  },
  draft: {
    label: 'Draft',
    colour: 'text-amber-400',
    bgColour: 'bg-amber-500/10',
    borderColour: 'border-amber-500/20',
    Icon: Clock,
  },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// =============================================================================
// Component
// =============================================================================

export function PostStatusTracker({
  batchId,
  onRefresh,
  onDismiss,
}: PostStatusTrackerProps) {
  const {
    data,
    isLoading,
    mutate,
  } = useSWR<PostsResponse>(
    batchId ? `/api/scheduler/posts?batchId=${encodeURIComponent(batchId)}` : null,
    fetchJson,
    {
      refreshInterval: 30000, // Poll every 30 seconds
      revalidateOnFocus: true,
    }
  );

  const posts = data?.data ?? [];
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const totalCount = posts.length;
  const progressPercent = totalCount > 0 ? Math.round((publishedCount / totalCount) * 100) : 0;

  const handleRefresh = () => {
    mutate();
    onRefresh?.();
  };

  if (isLoading) {
    return (
      <Card variant="glass">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading post status...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            Post Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-7 px-2 text-slate-400 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-7 px-2 text-slate-400 hover:text-white text-xs"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 1 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{publishedCount}/{totalCount} platforms published</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {posts.map((post) => {
          const config = getStatusConfig(post.status);
          const StatusIcon = config.Icon;
          const platformPostUrl = (post.metadata as Record<string, unknown> | null)?.platformPostUrl as string | undefined;

          return (
            <div
              key={post.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${config.bgColour} ${config.borderColour}`}
            >
              <div className="flex items-center gap-2.5">
                <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${config.colour}`} />
                <span className="text-xs font-medium text-white">
                  {getPlatformLabel(post.platform)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {post.scheduledAt && (
                  <span className="text-[10px] text-slate-400">
                    {new Date(post.scheduledAt).toLocaleString('en-AU', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}

                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bgColour} ${config.colour}`}>
                  {config.label}
                </span>

                {platformPostUrl && post.status === 'published' && (
                  <a
                    href={platformPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
