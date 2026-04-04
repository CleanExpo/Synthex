/**
 * Search Console Hook
 *
 * @description Provides Google Search Console data access.
 * - searchAnalytics: Search performance data (queries, pages, countries, devices)
 * - checkIndexingStatus: URL indexing inspection
 * - sitemapStatus: Sitemap health and status
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsData {
  rows: SearchAnalyticsRow[];
  totals: SearchAnalyticsTotals;
}

export interface IndexingInspection {
  indexingState: string;
  crawlState: string;
  lastCrawlTime: string | null;
  robotsTxtState: string;
  pageFetchState: string;
  verdict: string;
  coverageState: string;
}

export interface SitemapInfo {
  path: string;
  lastSubmitted: string | null;
  isPending: boolean;
  isSitemapsIndex: boolean;
  lastDownloaded: string | null;
  warnings: number;
  errors: number;
  contents: Array<{
    type: string;
    submitted: number;
    indexed: number;
  }>;
}

interface AnalyticsResponse {
  success: boolean;
  analytics?: SearchAnalyticsData;
  error?: string;
}

interface IndexingResponse {
  success: boolean;
  inspection?: IndexingInspection;
  error?: string;
}

interface SitemapsResponse {
  success: boolean;
  sitemaps?: SitemapInfo[];
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSearchConsole() {
  // Search Analytics state
  const [searchAnalytics, setSearchAnalytics] = useState<SearchAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Indexing Status state
  const [indexingResult, setIndexingResult] = useState<IndexingInspection | null>(null);
  const [indexingLoading, setIndexingLoading] = useState(false);
  const [indexingError, setIndexingError] = useState<string | null>(null);

  // Sitemap Status state
  const [sitemapStatus, setSitemapStatus] = useState<SitemapInfo[]>([]);
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapError, setSitemapError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch search analytics from API
   */
  const fetchAnalytics = useCallback(
    async (
      siteUrl: string,
      options?: {
        startDate?: string;
        endDate?: string;
        dimensions?: string[];
        rowLimit?: number;
      }
    ): Promise<SearchAnalyticsData | null> => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (!mountedRef.current) return null;
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      try {
        const response = await fetch('/api/seo/search-console/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            siteUrl,
            ...options,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: AnalyticsResponse = await response.json();

        if (mountedRef.current && data.analytics) {
          setSearchAnalytics(data.analytics);
        }

        return data.analytics || null;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null; // Request was cancelled
        }
        if (mountedRef.current) {
          setAnalyticsError(err instanceof Error ? err.message : String(err));
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setAnalyticsLoading(false);
        }
      }
    },
    []
  );

  /**
   * Check indexing status for a specific URL
   */
  const checkIndexingStatus = useCallback(
    async (siteUrl: string, inspectionUrl: string): Promise<IndexingInspection | null> => {
      if (!mountedRef.current) return null;
      setIndexingLoading(true);
      setIndexingError(null);
      setIndexingResult(null);

      try {
        const response = await fetch('/api/seo/search-console/indexing-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ siteUrl, inspectionUrl }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: IndexingResponse = await response.json();

        if (mountedRef.current && data.inspection) {
          setIndexingResult(data.inspection);
        }

        return data.inspection || null;
      } catch (err) {
        if (mountedRef.current) {
          setIndexingError(err instanceof Error ? err.message : String(err));
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setIndexingLoading(false);
        }
      }
    },
    []
  );

  /**
   * Fetch sitemap status
   */
  const fetchSitemaps = useCallback(async (siteUrl: string): Promise<SitemapInfo[]> => {
    if (!mountedRef.current) return [];
    setSitemapLoading(true);
    setSitemapError(null);

    try {
      const params = new URLSearchParams({ siteUrl });
      const response = await fetch(`/api/seo/search-console/sitemaps?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SitemapsResponse = await response.json();

      if (mountedRef.current) {
        setSitemapStatus(data.sitemaps || []);
      }

      return data.sitemaps || [];
    } catch (err) {
      if (mountedRef.current) {
        setSitemapError(err instanceof Error ? err.message : String(err));
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setSitemapLoading(false);
      }
    }
  }, []);

  /**
   * Clear indexing results
   */
  const clearIndexingResult = useCallback(() => {
    setIndexingResult(null);
    setIndexingError(null);
  }, []);

  /**
   * Clear analytics results
   */
  const clearAnalytics = useCallback(() => {
    setSearchAnalytics(null);
    setAnalyticsError(null);
  }, []);

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
    // Search Analytics
    searchAnalytics,
    analyticsLoading,
    analyticsError,
    fetchAnalytics,
    clearAnalytics,

    // Indexing Status
    indexingResult,
    indexingLoading,
    indexingError,
    checkIndexingStatus,
    clearIndexingResult,

    // Sitemap Status
    sitemapStatus,
    sitemapLoading,
    sitemapError,
    fetchSitemaps,

    // Convenience loading state
    isLoading: analyticsLoading || indexingLoading || sitemapLoading,
  };
}
