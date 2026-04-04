'use client';

/**
 * ContentSuggestionsWidget — Sprint 3
 * Shows 3 AI-powered content recommendations on the dashboard.
 * Renders nothing if no recommendations are available.
 */

import useSWR from 'swr';
import { Sparkles, Loader2, Copy, AlertCircle } from '@/components/icons';
import { toast } from 'sonner';

interface Recommendation {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  platform?: string;
  content?: string;
  reasoning?: string;
  priority?: number;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  total: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export function ContentSuggestionsWidget({
  className,
}: {
  className?: string;
}) {
  const { data, isLoading, error, mutate } = useSWR<RecommendationsResponse>(
    '/api/recommendations?limit=3',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const recommendations = data?.recommendations ?? [];

  if (error) {
    return (
      <div
        className={`border-[0.5px] border-orange-500/20 bg-orange-500/[0.04] rounded-sm p-6 text-center ${className ?? ''}`}
      >
        <AlertCircle className="h-5 w-5 text-orange-400 mx-auto mb-2" />
        <p className="text-white/50 text-sm">Couldn&apos;t load suggestions</p>
        <button
          onClick={() => mutate()}
          className="mt-3 text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!isLoading && recommendations.length === 0) {
    return (
      <div
        className={`border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5 space-y-4 ${className ?? ''}`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
            Content Suggestions
          </span>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-3 space-y-2">
          <p className="text-xs text-white/70 leading-relaxed">
            AI-powered content suggestions will appear here once you&apos;ve
            connected a social platform.
          </p>
          <a
            href="/dashboard/platforms"
            className="inline-block mt-1 text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-sm border-[0.5px] border-orange-500/30 bg-orange-500/[0.08] text-orange-400 hover:bg-orange-500/[0.12] transition-colors"
          >
            Connect Platform
          </a>
        </div>
      </div>
    );
  }

  function handleCopy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success('Copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy');
      });
  }

  return (
    <div
      className={`border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5 space-y-4 ${className ?? ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
          Content Suggestions
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 text-white/50 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-3 space-y-1.5 group hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {rec.platform && (
                    <span className="inline-block text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm bg-orange-500/[0.08] text-orange-400 border-[0.5px] border-orange-500/20 mb-1.5">
                      {rec.platform}
                    </span>
                  )}
                  <p className="text-xs text-white/70 leading-relaxed">
                    {rec.title ??
                      rec.description ??
                      rec.content ??
                      'Content idea'}
                  </p>
                  {rec.reasoning && (
                    <p className="text-[10px] text-white/50 mt-1 line-clamp-1">
                      {rec.reasoning}
                    </p>
                  )}
                </div>
                {(rec.content ?? rec.description) && (
                  <button
                    onClick={() =>
                      handleCopy(rec.content ?? rec.description ?? '')
                    }
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm hover:bg-white/[0.06] text-white/50 hover:text-white/60"
                    aria-label="Copy suggestion to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
