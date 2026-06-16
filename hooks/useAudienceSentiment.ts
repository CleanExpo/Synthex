/**
 * Audience Sentiment & Listening Hook
 *
 * @description Reads the existing social-listening overview endpoint
 * (`GET /api/listening`) so the Audience Insights surface can show brand
 * sentiment and recent mentions. Reuses the existing service — no new API.
 *
 * Uses SWR for data fetching with credentials: 'include' (org-scoped server
 * side via the authenticated user, same as useAudienceInsights).
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

// ============================================================================
// TYPES — mirror the `GET /api/listening` response shape
// ============================================================================

export interface ListeningSentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ListeningStats {
  total24h: number;
  total7d: number;
  total30d: number;
  sentimentBreakdown: ListeningSentimentBreakdown;
  topKeywords: Array<{
    id?: string;
    keyword?: string;
    type?: string;
    mentionCount: number;
  }>;
  topPlatforms: Array<{ platform: string; count: number }>;
  unreadCount: number;
  activeKeywordsCount: number;
}

export interface ListeningMention {
  id: string;
  platform: string;
  platformUrl: string | null;
  authorHandle: string;
  authorName: string | null;
  authorAvatar: string | null;
  content: string;
  sentiment: string | null;
  sentimentScore: number | null;
  likes: number;
  comments: number;
  shares: number;
  postedAt: string;
  keyword?: { id: string; keyword: string; type: string } | null;
}

export interface AudienceSentiment {
  stats: ListeningStats;
  recentMentions: ListeningMention[];
}

interface ApiResponse {
  success: boolean;
  stats: ListeningStats;
  recentMentions: ListeningMention[];
  error?: string;
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAudienceSentiment() {
  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<ApiResponse>('/api/listening', fetchJson, {
    revalidateOnFocus: false,
  });

  const data: AudienceSentiment | null = response?.success
    ? { stats: response.stats, recentMentions: response.recentMentions }
    : null;

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    data,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    refetch,
  };
}

export default useAudienceSentiment;
