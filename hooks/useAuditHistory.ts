/**
 * SEO Audit History Hook
 *
 * @description Provides audit history and trend data.
 * - history: Past audit records
 * - trends: Score trend data aggregated by date for charts
 * - loadHistory: Fetch history with optional URL filter
 * - loadTrends: Fetch trend data for a specific URL
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditHistoryEntry {
  id: number;
  url: string;
  overallScore: number;
  auditType: string;
  recommendations: Array<{
    severity: string;
    title: string;
    description: string;
  }> | null;
  createdAt: string;
}

export interface AuditTrendPoint {
  date: string;
  score: number;
  url?: string;
}

export interface RegressionAlert {
  id: number;
  url: string;
  siteName: string;
  oldScore: number;
  newScore: number;
  dropPercent: number;
  severity: 'critical' | 'warning';
  topIssues: Array<{
    severity: string;
    title: string;
  }>;
  createdAt: string;
}

interface HistoryResponse {
  success: boolean;
  audits?: AuditHistoryEntry[];
  total?: number;
  message?: string;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuditHistory() {
  // History state
  const [history, setHistory] = useState<AuditHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Trends state
  const [trends, setTrends] = useState<AuditTrendPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Regressions state (derived from history)
  const [regressions, setRegressions] = useState<RegressionAlert[]>([]);

  const mountedRef = useRef(true);
  const historyControllerRef = useRef<AbortController | null>(null);
  const trendsControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch audit history
   */
  const loadHistory = useCallback(async (url?: string, limit?: number) => {
    if (historyControllerRef.current) {
      historyControllerRef.current.abort();
    }

    const controller = new AbortController();
    historyControllerRef.current = controller;

    if (!mountedRef.current) return;
    setHistoryLoading(true);

    try {
      const params = new URLSearchParams();
      if (url) params.set('url', url);
      if (limit) params.set('limit', limit.toString());
      const queryString = params.toString() ? `?${params.toString()}` : '';

      const response = await fetch(`/api/seo/audit${queryString}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: HistoryResponse = await response.json();

      if (mountedRef.current) {
        setHistory(data.audits || []);
        // Extract regressions from history (scheduled audits with significant drops)
        extractRegressions(data.audits || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('Failed to fetch audit history:', err);
    } finally {
      if (mountedRef.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  /**
   * Extract regression alerts from audit history
   * Compares consecutive audits for the same URL to find score drops
   */
  const extractRegressions = useCallback((audits: AuditHistoryEntry[]) => {
    const regressionList: RegressionAlert[] = [];

    // Group audits by URL
    const byUrl = new Map<string, AuditHistoryEntry[]>();
    for (const audit of audits) {
      const list = byUrl.get(audit.url) || [];
      list.push(audit);
      byUrl.set(audit.url, list);
    }

    // For each URL, check for regressions
    for (const [url, urlAudits] of byUrl) {
      // Sort by date descending
      const sorted = [...urlAudits].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const previous = sorted[i + 1];
        const dropPercent = Math.round(
          ((previous.overallScore - current.overallScore) / previous.overallScore) * 100
        );

        // Check if this is a significant regression (10%+ drop)
        if (dropPercent >= 10) {
          const topIssues = (current.recommendations || [])
            .filter(r => r.severity === 'critical' || r.severity === 'major')
            .slice(0, 3)
            .map(r => ({ severity: r.severity, title: r.title }));

          regressionList.push({
            id: current.id,
            url,
            siteName: new URL(url).hostname,
            oldScore: previous.overallScore,
            newScore: current.overallScore,
            dropPercent,
            severity: dropPercent >= 15 ? 'critical' : 'warning',
            topIssues,
            createdAt: current.createdAt,
          });
        }
      }
    }

    // Sort by date descending
    regressionList.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setRegressions(regressionList);
  }, []);

  /**
   * Load trends for a specific URL (aggregate history into trend points)
   */
  const loadTrends = useCallback(async (url: string, days: number = 30) => {
    if (trendsControllerRef.current) {
      trendsControllerRef.current.abort();
    }

    const controller = new AbortController();
    trendsControllerRef.current = controller;

    if (!mountedRef.current) return;
    setTrendsLoading(true);

    try {
      // Fetch history for this URL
      const params = new URLSearchParams();
      params.set('url', url);
      params.set('limit', '100'); // Get enough data for trends

      const response = await fetch(`/api/seo/audit?${params.toString()}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit data');
      }

      const data: HistoryResponse = await response.json();
      const audits = data.audits || [];

      // Filter to requested date range
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const filtered = audits.filter(a => new Date(a.createdAt) >= cutoff);

      // Aggregate by date
      const byDate = new Map<string, number[]>();
      for (const audit of filtered) {
        const date = new Date(audit.createdAt).toISOString().split('T')[0];
        const scores = byDate.get(date) || [];
        scores.push(audit.overallScore);
        byDate.set(date, scores);
      }

      // Calculate average per date
      const trendPoints: AuditTrendPoint[] = [];
      for (const [date, scores] of byDate) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        trendPoints.push({ date, score: avg, url });
      }

      // Sort by date ascending
      trendPoints.sort((a, b) => a.date.localeCompare(b.date));

      if (mountedRef.current) {
        setTrends(trendPoints);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('Failed to fetch audit trends:', err);
    } finally {
      if (mountedRef.current) {
        setTrendsLoading(false);
      }
    }
  }, []);

  /**
   * Get unique URLs from history
   */
  const getUniqueUrls = useCallback((): string[] => {
    const urls = new Set<string>();
    for (const audit of history) {
      urls.add(audit.url);
    }
    return Array.from(urls);
  }, [history]);

  // Load history on mount
  useEffect(() => {
    mountedRef.current = true;
    loadHistory();

    return () => {
      mountedRef.current = false;
      if (historyControllerRef.current) historyControllerRef.current.abort();
      if (trendsControllerRef.current) trendsControllerRef.current.abort();
    };
  }, [loadHistory]);

  return {
    // History
    history,
    historyLoading,
    loadHistory,

    // Trends
    trends,
    trendsLoading,
    loadTrends,

    // Regressions
    regressions,

    // Helpers
    getUniqueUrls,

    // Convenience
    isLoading: historyLoading || trendsLoading,
  };
}
