/**
 * PageSpeed Insights Hook
 *
 * @description Provides PageSpeed Insights analysis functionality.
 * - analyzeUrl: Run on-demand PageSpeed analysis for a URL
 * - history: Past analysis records from SEOAudit storage
 * - trends: Performance trend data aggregated by date
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import useSWR from 'swr';

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

// ============================================================================
// FETCHERS
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `HTTP ${res.status}: ${res.statusText}`
    );
  }
  return res.json() as Promise<T>;
}

async function fetchHistory(url: string): Promise<PageSpeedHistoryEntry[]> {
  const data = await fetchJson<{
    success: boolean;
    history?: PageSpeedHistoryEntry[];
  }>(url);
  return data.history || [];
}

async function fetchTrends(url: string): Promise<PerformanceTrendPoint[]> {
  const data = await fetchJson<{
    success: boolean;
    trends?: PerformanceTrendPoint[];
  }>(url);
  return data.trends || [];
}

// ============================================================================
// HOOK
// ============================================================================

export function usePageSpeed() {
  // Analysis state — remains manual (POST with body)
  const [analysis, setAnalysis] = useState<PageSpeedAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const analyzeControllerRef = useRef<AbortController | null>(null);

  // History via SWR
  const {
    data: history = [],
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useSWR<PageSpeedHistoryEntry[]>(
    '/api/seo/pagespeed/history',
    fetchHistory,
    { revalidateOnFocus: false }
  );

  // Trends via SWR
  const {
    data: trends = [],
    isLoading: trendsLoading,
    mutate: mutateTrends,
  } = useSWR<PerformanceTrendPoint[]>(
    '/api/seo/pagespeed/trends',
    fetchTrends,
    { revalidateOnFocus: false }
  );

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
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: AnalyzeResponse = await response.json();

        if (data.analysis) {
          setAnalysis(data.analysis);
          // Refresh history after new analysis
          void mutateHistory();
        }

        return data.analysis || null;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setAnalysisError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setAnalysisLoading(false);
      }
    },
    [mutateHistory]
  );

  const refetchHistory = useCallback(
    async (_days?: number) => {
      await mutateHistory();
    },
    [mutateHistory]
  );

  const refetchTrends = useCallback(
    async (_days?: number) => {
      await mutateTrends();
    },
    [mutateTrends]
  );

  /**
   * Clear analysis result
   */
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setAnalysisError(null);
  }, []);

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
    fetchHistory: refetchHistory,

    // Trends
    trends,
    trendsLoading,
    fetchTrends: refetchTrends,

    // Convenience loading state
    isLoading: analysisLoading || historyLoading || trendsLoading,
  };
}
