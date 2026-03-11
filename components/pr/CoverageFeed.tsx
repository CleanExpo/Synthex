'use client';

/**
 * PR Journalist CRM — Coverage Feed Component (Phase 92)
 *
 * Chronological list of editorial coverage with outlet, journalist linkage,
 * pitch attribution, and sentiment badge. "Poll Coverage" button triggers
 * mention polling and auto-link to pitches.
 *
 * @module components/pr/CoverageFeed
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Globe, Loader2, AlertCircle, Plus, ArrowRight } from '@/components/icons';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoverageItem {
  id: string;
  url: string;
  title: string;
  outlet: string;
  outletDomain: string;
  description?: string | null;
  publishedAt?: string | null;
  apiSource: string;
  sentiment: string;
  createdAt: string;
  journalist?: { id: string; name: string; outlet: string } | null;
  pitch?: { id: string; subject: string; status: string } | null;
}

interface CoverageResponse {
  coverage: CoverageItem[];
}

interface PollResult {
  polled: number;
  linked: number;
  created: number;
  message?: string;
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

const SENTIMENT_STYLES: Record<string, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  neutral:  { label: 'Neutral',  className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  negative: { label: 'Negative', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown date';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoverageFeed() {
  const [brandName, setBrandName] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<PollResult | null>(null);

  const { data, isLoading, error, mutate } = useSWR<CoverageResponse>(
    '/api/pr/coverage',
    fetchJson
  );

  const coverage = data?.coverage ?? [];

  const handlePoll = async () => {
    if (!brandName.trim()) return;
    setPolling(true);
    setPollResult(null);
    try {
      const res = await fetch('/api/pr/coverage/poll', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: brandName.trim() }),
      });
      if (!res.ok) throw new Error('Request failed');
      const result: PollResult = await res.json();
      setPollResult(result);
      await mutate();
    } catch {
      setPollResult({ polled: 0, linked: 0, created: 0, message: 'Polling failed. Please try again.' });
    } finally {
      setPolling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading coverage...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-8">
        <AlertCircle className="h-5 w-5" />
        Failed to load coverage. Please try again.
      </div>
    );
  }

  return (
    <div>
      {/* Poll controls */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
        <Globe className="h-5 w-5 text-cyan-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white mb-2">Poll for New Coverage</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Your brand name (e.g. Acme Corp)"
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handlePoll()}
            />
            <button
              onClick={handlePoll}
              disabled={polling || !brandName.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {polling ? 'Polling...' : 'Poll'}
            </button>
          </div>
          {pollResult && (
            <p className={cn('text-xs mt-2', pollResult.message ? 'text-red-400' : 'text-green-400')}>
              {pollResult.message
                ? pollResult.message
                : `Polled ${pollResult.polled} mentions · ${pollResult.created} new · ${pollResult.linked} linked to pitches`}
            </p>
          )}
        </div>
      </div>

      {/* Coverage list */}
      {coverage.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No coverage yet. Poll for mentions or add manually.
        </div>
      ) : (
        <div className="space-y-3">
          {coverage.map((item) => {
            const sentiment = SENTIMENT_STYLES[item.sentiment] ?? SENTIMENT_STYLES.neutral;
            return (
              <div
                key={item.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-white hover:text-cyan-300 transition-colors line-clamp-2"
                    >
                      {item.title}
                    </a>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 font-medium">{item.outlet}</span>
                      {item.journalist && (
                        <>
                          <span className="text-gray-600">·</span>
                          <span className="text-xs text-cyan-300">{item.journalist.name}</span>
                        </>
                      )}
                      {item.pitch && (
                        <>
                          <span className="text-gray-600">·</span>
                          <span className="text-xs text-purple-300 truncate max-w-[200px]">
                            via pitch: {item.pitch.subject}
                          </span>
                        </>
                      )}
                      <span className="text-gray-600">·</span>
                      <span className="text-xs text-gray-500">{formatDate(item.publishedAt ?? item.createdAt)}</span>
                    </div>
                  </div>
                  <span className={cn('text-xs px-2 py-1 rounded-full border flex-shrink-0', sentiment.className)}>
                    {sentiment.label}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{item.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Manual add button */}
      <div className="mt-4">
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <Plus className="h-4 w-4" />
          Add coverage manually
        </button>
      </div>
    </div>
  );
}
