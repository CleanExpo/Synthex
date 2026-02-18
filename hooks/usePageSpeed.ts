/**
 * PageSpeed Insights Hook
 *
 * @description Provides PageSpeed Insights analysis functionality.
 * - analyzeUrl: Run on-demand PageSpeed analysis for a URL
 * - history: Past analysis records from SEOAudit storage
 * - trends: Performance trend data aggregated by date
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface FieldMetrics {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fid: number | null;
  source: 'field';
}

export interface LabMetrics {
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  speedIndex: number | null;
  fcp: number | null;
  source: 'lab';
}

export interface PageSpeedOpportunity {
  title: string;
  description: string;
  savings: string | null;
}

export interface PageSpeedDiagnostic {
  title: string;
  description: string;
  displayValue: string | null;
}

export interface PageSpeedAnalysis {
  url: string;
  strategy: 'mobile' | 'desktop';
  fetchedAt: string;
  isDemo: boolean;
  scores: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  };
  fieldMetrics: FieldMetrics | null;
  labMetrics: LabMetrics;
  opportunities: PageSpeedOpportunity[];
  diagnostics: PageSpeedDiagnostic[];
}

export interface PageSpeedHistoryEntry {
  id: number;
  url: string;
  date: string;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
}

export interface PerformanceTrendPoint {
  date: string;
  avgPerformance: number;
  avgLcp: number | null;
  avgCls: number | null;
  avgInp: number | null;
}

interface AnalyzeResponse {
  success: boolean;
  analysis?: PageSpeedAnalysis;
  error?: string;
}

interface HistoryResponse {
  success: boolean;
  history?: PageSpeedHistoryEntry[];
  total?: number;
  message?: string;
  error?: string;
}

interface TrendsResponse {
  success: boolean;
  trends?: PerformanceTrendPoint[];
  days?: number;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePageSpeed() {
  // Analysis state
  const [analysis, setAnalysis] = useState<PageSpeedAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<PageSpeedHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Trends state
  const [trends, setTrends] = useState<PerformanceTrendPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);

  const mountedRef = useRef(true);
  const analyzeControllerRef = useRef<AbortController | null>(null);
  const historyControllerRef = useRef<AbortController | null>(null);
  const trendsControllerRef = useRef<AbortController | null>(null);

  /**
   * Run PageSpeed analysis on a URL
   */
  const analyzeUrl = useCallback(
    async (
      url: string,
      strategy: 'mobile' | 'desktop' = 'mobile'
    ): Promise<PageSpeedAnalysis | null> => {
      // Cancel any in-flight analysis request
      if (analyzeControllerRef.current) {
        analyzeControllerRef.current.abort();
      }

      const controller = new AbortController();
      analyzeControllerRef.current = controller;

      if (!mountedRef.current) return null;
      setAnalysisLoading(true);
      setAnalysisError(null);
      setAnalysis(null);

      try {
        const response = await fetch('/api/seo/pagespeed/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ url, strategy }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: AnalyzeResponse = await response.json();

        if (mountedRef.current && data.analysis) {
          setAnalysis(data.analysis);
        }

        return data.analysis || null;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        if (mountedRef.current) {
          setAnalysisError(err instanceof Error ? err.message : String(err));
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setAnalysisLoading(false);
        }
      }
    },
    []
  );

  /**
   * Fetch analysis history
   */
  const fetchHistory = useCallback(async () => {
    if (historyControllerRef.current) {
      historyControllerRef.current.abort();
    }

    const controller = new AbortController();
    historyControllerRef.current = controller;

    if (!mountedRef.current) return;
    setHistoryLoading(true);

    try {
      const response = await fetch('/api/seo/pagespeed/history', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: HistoryResponse = await response.json();

      if (mountedRef.current) {
        setHistory(data.history || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Silently fail for history — not critical
      console.warn('Failed to fetch PageSpeed history:', err);
    } finally {
      if (mountedRef.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  /**
   * Fetch performance trends
   */
  const fetchTrends = useCallback(async (days?: number) => {
    if (trendsControllerRef.current) {
      trendsControllerRef.current.abort();
    }

    const controller = new AbortController();
    trendsControllerRef.current = controller;

    if (!mountedRef.current) return;
    setTrendsLoading(true);

    try {
      const params = days ? `?days=${days}` : '';
      const response = await fetch(`/api/seo/pagespeed/trends${params}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TrendsResponse = await response.json();

      if (mountedRef.current) {
        setTrends(data.trends || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('Failed to fetch PageSpeed trends:', err);
    } finally {
      if (mountedRef.current) {
        setTrendsLoading(false);
      }
    }
  }, []);

  /**
   * Clear analysis result
   */
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setAnalysisError(null);
  }, []);

  // Fetch history and trends on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchHistory();
    fetchTrends();

    return () => {
      mountedRef.current = false;
      if (analyzeControllerRef.current) analyzeControllerRef.current.abort();
      if (historyControllerRef.current) historyControllerRef.current.abort();
      if (trendsControllerRef.current) trendsControllerRef.current.abort();
    };
  }, [fetchHistory, fetchTrends]);

  return {
    // Analysis
    analysis,
    analysisLoading,
    analysisError,
    analyzeUrl,
    clearAnalysis,

    // History
    history,
    historyLoading,
    fetchHistory,

    // Trends
    trends,
    trendsLoading,
    fetchTrends,

    // Convenience loading state
    isLoading: analysisLoading || historyLoading || trendsLoading,
  };
}
