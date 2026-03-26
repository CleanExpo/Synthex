'use client';

/**
 * First Week Widget
 *
 * Shows AI-generated kickstart content drafts created after onboarding.
 * When no kickstart drafts exist, shows a fallback CTA to generate them.
 * Disappears once all posts are published.
 */

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Calendar,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/fetcher';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface KickstartPost {
  id: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  campaignName?: string;
}

interface KickstartStatus {
  hasKickstart: boolean;
  draftsCount: number;
  scheduledCount: number;
  totalCount: number;
  platforms: string[];
  posts: KickstartPost[];
}

// ── Platform label map ────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  twitter: 'TW',
  linkedin: 'LI',
  tiktok: 'TK',
  youtube: 'YT',
  pinterest: 'PT',
  reddit: 'RD',
  threads: 'TH',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function FirstWeekWidget() {
  const router = useRouter();
  const { data, isLoading, error } = useSWR<KickstartStatus>(
    '/api/onboarding/kickstart',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const { mutate } = useSWRConfig();
  const [generating, setGenerating] = useState(false);

  if (isLoading) return null;

  if (error) {
    return (
      <div className="border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] rounded-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 border-[0.5px] border-orange-500/30 bg-orange-500/[0.08] rounded-sm flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-light text-white tracking-tight">
              Couldn&apos;t load your kickstart posts
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Something went wrong fetching your first week of content
            </p>
          </div>
        </div>
        <button
          onClick={() => mutate('/api/onboarding/kickstart')}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-wide rounded-sm transition-colors bg-orange-500/[0.08] hover:bg-orange-500/[0.15] text-orange-300 border-[0.5px] border-orange-500/20"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Fallback CTA ──────────────────────────────────────────────────────────
  if (!data?.hasKickstart || data.totalCount === 0) {
    const handleGenerateKickstart = async () => {
      setGenerating(true);
      try {
        const res = await fetch('/api/onboarding/kickstart', {
          method: 'POST',
          credentials: 'include',
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to generate content');
        }

        toast.success('Your first week of content has been generated!', {
          description: 'Review and publish your AI-drafted posts.',
          action: {
            label: 'View Drafts',
            onClick: () => router.push('/dashboard/content/drafts'),
          },
          duration: 6000,
        });

        await mutate('/api/onboarding/kickstart');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong';
        toast.error('Could not generate content', { description: message });
      } finally {
        setGenerating(false);
      }
    };

    return (
      <div className="border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] rounded-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 border-[0.5px] border-orange-500/30 bg-orange-500/[0.08] rounded-sm flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-light text-white tracking-tight">
              Generate Your First Week of Content
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Let AI create 7 days of platform-specific posts based on your
              business analysis
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerateKickstart}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium tracking-wide rounded-sm transition-colors bg-orange-500/[0.08] hover:bg-orange-500/[0.15] text-orange-300 border-[0.5px] border-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating posts…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Content Week
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  const { draftsCount, scheduledCount, totalCount, platforms, posts } = data;
  const publishedCount = totalCount - draftsCount - scheduledCount;
  const allDone = publishedCount === totalCount;

  if (allDone) return null;

  return (
    <div className="border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 border-[0.5px] border-orange-500/30 bg-orange-500/[0.08] rounded-sm flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-light text-white tracking-tight">
              Your First Week Content
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              AI-generated drafts ready to review and publish
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/content/drafts"
          className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 transition-colors flex-shrink-0"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Stats strip */}
      <div className="border-t-[0.5px] border-white/[0.06] grid grid-cols-3 divide-x-[0.5px] divide-white/[0.06]">
        <div className="px-4 py-3 text-center">
          <p className="font-mono text-xl font-medium text-white tabular-nums">
            {totalCount}
          </p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mt-0.5">
            Total
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="font-mono text-xl font-medium text-orange-400 tabular-nums">
            {draftsCount}
          </p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mt-0.5">
            Drafts
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="font-mono text-xl font-medium text-emerald-400 tabular-nums">
            {scheduledCount}
          </p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mt-0.5">
            Scheduled
          </p>
        </div>
      </div>

      {/* Platform badges */}
      {platforms.length > 0 && (
        <div className="border-t-[0.5px] border-white/[0.06] px-5 py-3 flex flex-wrap gap-1.5">
          {platforms.map(p => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-white/[0.04] border-[0.5px] border-white/[0.08] text-[9px] uppercase tracking-[0.15em] text-white/40"
            >
              {PLATFORM_LABELS[p] ?? p.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Post previews */}
      <div className="border-t-[0.5px] border-white/[0.06] divide-y-[0.5px] divide-white/[0.04]">
        {posts.slice(0, 3).map(post => (
          <div key={post.id} className="flex items-center gap-3 px-5 py-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/50 shrink-0 w-5">
              {PLATFORM_LABELS[post.platform] ??
                post.platform.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/60 truncate">
                {post.campaignName ?? `${post.platform} post`}
              </p>
              {post.scheduledAt && (
                <p className="text-[10px] text-white/50 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  {new Date(post.scheduledAt).toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <span
              className={cn(
                'text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm border-[0.5px] shrink-0',
                post.status === 'scheduled'
                  ? 'bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20'
                  : 'bg-orange-500/[0.08] text-orange-400 border-orange-500/20'
              )}
            >
              {post.status === 'scheduled' ? 'Scheduled' : 'Draft'}
            </span>
          </div>
        ))}

        {posts.length > 3 && (
          <p className="px-5 py-2 text-[10px] text-white/50 text-center">
            +{posts.length - 3} more posts in drafts
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="border-t-[0.5px] border-white/[0.06] p-5">
        <Link
          href="/dashboard/content/drafts"
          className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-medium tracking-wide rounded-sm transition-colors bg-orange-500/[0.08] hover:bg-orange-500/[0.15] text-orange-300 border-[0.5px] border-orange-500/20"
        >
          <FileText className="h-3.5 w-3.5" />
          Review &amp; Publish Your First Posts
        </Link>
      </div>
    </div>
  );
}
