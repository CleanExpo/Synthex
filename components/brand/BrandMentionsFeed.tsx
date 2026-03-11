'use client';

/**
 * Brand Builder — Brand Mentions Feed Component (Phase 91)
 *
 * Chronological feed of brand mentions with sentiment badges, poll button,
 * and load-more pagination.
 *
 * @module components/brand/BrandMentionsFeed
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Search, AlertCircle, Loader2, ExternalLink } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useMutation } from '@/hooks/use-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandMention {
  id: string;
  url: string;
  title: string;
  description?: string | null;
  publishedAt?: string | null;
  source: string;
  apiSource: string;
  sentiment: string;
  createdAt: string;
}

interface MentionsResponse {
  mentions: BrandMention[];
  total: number;
  page: number;
  limit: number;
}

interface BrandMentionsFeedProps {
  brandId: string;
}

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sentimentBadge(sentiment: string): { label: string; className: string } {
  switch (sentiment) {
    case 'positive': return { label: 'Positive', className: 'bg-green-500/20 text-green-300 border-green-500/30' };
    case 'negative': return { label: 'Negative', className: 'bg-red-500/20 text-red-300 border-red-500/30' };
    default:         return { label: 'Neutral',  className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  }
}

function apiSourceLabel(source: string): string {
  switch (source) {
    case 'newsdata': return 'NewsData.io';
    case 'gdelt':    return 'GDELT';
    case 'gnews':    return 'GNews';
    case 'guardian': return 'The Guardian';
    default:         return source;
  }
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown date';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandMentionsFeed({ brandId }: BrandMentionsFeedProps) {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, error, isLoading, mutate } = useSWR<MentionsResponse>(
    `/api/brand/mentions?brandId=${brandId}&page=${page}&limit=${limit}`,
    fetchJson
  );

  const { mutate: triggerPoll, isLoading: polling } = useMutation<{ newCount: number; totalFetched: number }, { brandId: string }>(
    async (vars) => {
      const res = await fetch('/api/brand/mentions/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error('Poll failed');
      return res.json();
    }
  );

  const handlePoll = async () => {
    await triggerPoll({ brandId });
    await mutate(); // refresh mentions after polling
  };

  return (
    <div className="space-y-4">
      {/* Header + Poll Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Brand Mentions</h3>
        <button
          onClick={handlePoll}
          disabled={polling}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {polling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Poll for new mentions
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 text-gray-500 mx-auto animate-spin" />
          <p className="text-sm text-gray-500 mt-3">Loading mentions…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">Failed to load mentions. Please try again.</p>
        </div>
      )}

      {/* Empty State */}
      {data && data.mentions.length === 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
          <Search className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No mentions found</p>
          <p className="text-xs text-gray-500 mt-1">Click "Poll for new mentions" to search for brand mentions across NewsData.io and GDELT.</p>
        </div>
      )}

      {/* Mentions Feed */}
      {data && data.mentions.length > 0 && (
        <div className="space-y-3">
          {data.mentions.map(mention => {
            const badge = sentimentBadge(mention.sentiment);
            return (
              <div
                key={mention.id}
                className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <a
                      href={mention.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-white hover:text-blue-300 transition-colors flex items-start gap-1.5"
                    >
                      <span className="line-clamp-2">{mention.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
                    </a>
                    {mention.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {mention.description.slice(0, 120)}{mention.description.length > 120 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border shrink-0', badge.className)}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{mention.source}</span>
                  <span>·</span>
                  <span>{formatRelativeDate(mention.publishedAt ?? mention.createdAt)}</span>
                  <span>·</span>
                  <span className="bg-white/[0.05] px-2 py-0.5 rounded-full">{apiSourceLabel(mention.apiSource)}</span>
                </div>
              </div>
            );
          })}

          {/* Load More */}
          {data.total > page * limit && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-sm text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl transition-colors"
            >
              Load more ({data.total - page * limit} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
