'use client';

/**
 * First Week Widget
 *
 * Shows the AI-generated kickstart content drafts created after onboarding.
 * When no kickstart drafts exist yet, shows a fallback CTA to generate them.
 * Disappears once all posts are published.
 *
 * Fetches from GET /api/onboarding/kickstart which returns status + post previews.
 */

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { Sparkles, Calendar, FileText, ArrowRight, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

// ── Platform emoji map ────────────────────────────────────────────────────────

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  twitter: '🐦',
  linkedin: '💼',
  tiktok: '🎵',
  youtube: '▶️',
  pinterest: '📌',
  reddit: '🤖',
  threads: '🧵',
};

// ── Fetcher ───────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Component ─────────────────────────────────────────────────────────────────

export function FirstWeekWidget() {
  const { data, isLoading } = useSWR<KickstartStatus>(
    '/api/onboarding/kickstart',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const { mutate } = useSWRConfig();
  const [generating, setGenerating] = useState(false);

  // Don't render while loading
  if (isLoading) {
    return null;
  }

  // ── Fallback CTA: No kickstart drafts yet ─────────────────────────────────
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
            onClick: () => window.location.assign('/dashboard/content/drafts'),
          },
          duration: 6000,
        });

        // Revalidate so the widget shows the newly created drafts
        await mutate('/api/onboarding/kickstart');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        toast.error('Could not generate content', { description: message });
      } finally {
        setGenerating(false);
      }
    };

    return (
      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Generate Your First Week of Content
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Let AI create 7 days of platform-specific posts based on your business analysis
            </p>
          </div>
        </div>
        <Button
          onClick={handleGenerateKickstart}
          disabled={generating}
          size="sm"
          className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/30 transition-all"
        >
          {generating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Generating posts…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              Generate Content Week
            </>
          )}
        </Button>
      </div>
    );
  }

  // ── Main view: Show kickstart drafts ──────────────────────────────────────
  const { draftsCount, scheduledCount, totalCount, platforms, posts } = data;
  const publishedCount = totalCount - draftsCount - scheduledCount;
  const allDone = publishedCount === totalCount;

  if (allDone) return null;

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Your First Week Content</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              AI-generated drafts ready to review and publish
            </p>
          </div>
        </div>
        <Link href="/dashboard/content/drafts">
          <Button
            size="sm"
            variant="ghost"
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 text-xs h-7"
          >
            View all
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-xl font-bold text-white">{totalCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <p className="text-xl font-bold text-amber-400">{draftsCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Drafts</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-green-500/5 border border-green-500/10">
          <p className="text-xl font-bold text-green-400">{scheduledCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Scheduled</p>
        </div>
      </div>

      {/* Platform badges */}
      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {platforms.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-gray-300"
            >
              <span>{PLATFORM_EMOJI[p] ?? '🌐'}</span>
              <span className="capitalize">{p}</span>
            </span>
          ))}
        </div>
      )}

      {/* Post previews */}
      <div className="space-y-1.5">
        {posts.slice(0, 3).map((post) => (
          <div
            key={post.id}
            className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
          >
            <span className="text-base shrink-0">{PLATFORM_EMOJI[post.platform] ?? '🌐'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {post.campaignName ?? `${post.platform} post`}
              </p>
              {post.scheduledAt && (
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  {new Date(post.scheduledAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 shrink-0',
                post.status === 'scheduled'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              )}
            >
              {post.status === 'scheduled' ? (
                <><Calendar className="h-2.5 w-2.5 mr-0.5" />Scheduled</>
              ) : (
                <><FileText className="h-2.5 w-2.5 mr-0.5" />Draft</>
              )}
            </Badge>
          </div>
        ))}

        {posts.length > 3 && (
          <p className="text-[11px] text-gray-500 text-center pt-1">
            +{posts.length - 3} more posts in drafts
          </p>
        )}
      </div>

      {/* CTA */}
      <Link href="/dashboard/content/drafts" className="block">
        <Button
          size="sm"
          className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/30 transition-all"
        >
          <FileText className="h-3.5 w-3.5 mr-2" />
          Review &amp; Publish Your First Posts
        </Button>
      </Link>
    </div>
  );
}
