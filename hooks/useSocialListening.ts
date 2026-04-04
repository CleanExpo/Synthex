/**
 * Social Listening Hook
 *
 * @description Manages social listening state and operations.
 * Provides keywords, mentions feed, stats, and actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/useCalendar.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface TrackedKeyword {
  id: string;
  keyword: string;
  type: 'keyword' | 'hashtag' | 'mention' | 'brand';
  platforms: string[];
  isActive: boolean;
  totalMentions: number;
  unreadCount: number;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface SocialMention {
  id: string;
  keywordId: string;
  platform: string;
  platformPostId: string;
  platformUrl: string | null;
  authorHandle: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorFollowers: number | null;
  content: string;
  mediaUrls: string[];
  likes: number;
  comments: number;
  shares: number;
  reach: number | null;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentimentScore: number | null;
  isInfluencer: boolean;
  isRead: boolean;
  isArchived: boolean;
  isFlagged: boolean;
  postedAt: string;
  fetchedAt: string;
  keyword?: {
    id: string;
    keyword: string;
    type: string;
  };
}

export interface ListeningStats {
  total24h: number;
  total7d: number;
  total30d: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topKeywords: Array<{
    id: string;
    keyword: string;
    type: string;
    mentionCount: number;
  }>;
  topPlatforms: Array<{
    platform: string;
    count: number;
  }>;
  unreadCount: number;
  activeKeywordsCount: number;
}

export interface UseSocialListeningOptions {
  organizationId?: string;
  keywordId?: string;
  platform?: string;
  sentiment?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

// ============================================================================
// HELPERS
// ============================================================================

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token')
  );
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSocialListening(options: UseSocialListeningOptions = {}) {
  const { keywordId, platform, sentiment, autoRefresh = false, refreshInterval = 60000 } = options;

  // Data state
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([]);
  const [mentions, setMentions] = useState<SocialMention[]>([]);
  const [stats, setStats] = useState<ListeningStats>({
    total24h: 0,
    total7d: 0,
    total30d: 0,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    topKeywords: [],
    topPlatforms: [],
    unreadCount: 0,
    activeKeywordsCount: 0,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMentions, setTotalMentions] = useState(0);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch dashboard stats and recent mentions
   */
  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/listening', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch listening stats:', err);
    }
  }, []);

  /**
   * Fetch tracked keywords
   */
  const fetchKeywords = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/listening/keywords', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        setKeywords(data.keywords);
      }
    } catch (err) {
      console.error('Failed to fetch keywords:', err);
    }
  }, []);

  /**
   * Fetch mentions with filters
   */
  const fetchMentions = useCallback(async (pageNum: number = 1): Promise<void> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: pageNum.toString(), limit: '20' });
      if (keywordId) params.set('keywordId', keywordId);
      if (platform) params.set('platform', platform);
      if (sentiment) params.set('sentiment', sentiment);

      const response = await fetch(`/api/listening/mentions?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        setMentions(data.mentions);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
        setTotalMentions(data.pagination.total);
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [keywordId, platform, sentiment]);

  /**
   * Add a new tracked keyword
   */
  const addKeyword = useCallback(async (
    keyword: string,
    type: 'keyword' | 'hashtag' | 'mention' | 'brand',
    platforms: string[]
  ): Promise<TrackedKeyword | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/listening/keywords', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ keyword, type, platforms }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        // Add to local state
        const newKeyword: TrackedKeyword = {
          ...data.keyword,
          totalMentions: 0,
          unreadCount: 0,
        };
        setKeywords(prev => [newKeyword, ...prev]);
        return newKeyword;
      }
      return null;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Remove a tracked keyword
   */
  const removeKeyword = useCallback(async (keywordIdToRemove: string): Promise<boolean> => {
    // Optimistic update
    const previousKeywords = keywords;
    setKeywords(prev => prev.filter(k => k.id !== keywordIdToRemove));

    try {
      const response = await fetch(`/api/listening/keywords?id=${keywordIdToRemove}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (err) {
      // Rollback on error
      if (mountedRef.current) {
        setKeywords(previousKeywords);
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [keywords]);

  /**
   * Mark mention as read
   */
  const markMentionRead = useCallback(async (mentionId: string): Promise<boolean> => {
    // Optimistic update
    setMentions(prev =>
      prev.map(m => m.id === mentionId ? { ...m, isRead: true } : m)
    );

    try {
      const response = await fetch('/api/listening/mentions', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mentionId, isRead: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update stats unread count
      setStats(prev => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));

      return true;
    } catch (err) {
      // Rollback
      setMentions(prev =>
        prev.map(m => m.id === mentionId ? { ...m, isRead: false } : m)
      );
      return false;
    }
  }, []);

  /**
   * Flag/unflag a mention
   */
  const flagMention = useCallback(async (mentionId: string, flagged: boolean): Promise<boolean> => {
    // Optimistic update
    setMentions(prev =>
      prev.map(m => m.id === mentionId ? { ...m, isFlagged: flagged } : m)
    );

    try {
      const response = await fetch('/api/listening/mentions', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mentionId, isFlagged: flagged }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (err) {
      // Rollback
      setMentions(prev =>
        prev.map(m => m.id === mentionId ? { ...m, isFlagged: !flagged } : m)
      );
      return false;
    }
  }, []);

  /**
   * Archive a mention
   */
  const archiveMention = useCallback(async (mentionId: string): Promise<boolean> => {
    // Optimistic update - remove from list
    const previousMentions = mentions;
    setMentions(prev => prev.filter(m => m.id !== mentionId));

    try {
      const response = await fetch('/api/listening/mentions', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mentionId, isArchived: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (err) {
      // Rollback
      setMentions(previousMentions);
      return false;
    }
  }, [mentions]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([fetchStats(), fetchKeywords(), fetchMentions(1)]);
  }, [fetchStats, fetchKeywords, fetchMentions]);

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    if (page < totalPages) {
      fetchMentions(page + 1);
    }
  }, [page, totalPages, fetchMentions]);

  /**
   * Go to previous page
   */
  const prevPage = useCallback(() => {
    if (page > 1) {
      fetchMentions(page - 1);
    }
  }, [page, fetchMentions]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchStats();
    fetchKeywords();
    fetchMentions(1);
  }, [fetchStats, fetchKeywords, fetchMentions]);

  // Re-fetch mentions when filters change
  useEffect(() => {
    fetchMentions(1);
  }, [keywordId, platform, sentiment, fetchMentions]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
      fetchMentions(page);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchStats, fetchMentions, page]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    keywords,
    mentions,
    stats,

    // Pagination
    page,
    totalPages,
    totalMentions,

    // UI state
    isLoading,
    error,
    lastRefreshedAt,

    // Actions
    addKeyword,
    removeKeyword,
    markMentionRead,
    flagMention,
    archiveMention,
    refresh,
    nextPage,
    prevPage,
    clearError,
  };
}

export default useSocialListening;
