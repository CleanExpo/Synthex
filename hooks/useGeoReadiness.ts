/**
 * GEO Readiness Hook
 *
 * @description Provides GEO Readiness analysis functionality.
 * - analyzeReadiness: Run on-demand GEO readiness analysis for content
 * - history: Past analysis records from GEOAnalysis storage
 * - trends: Score trend data aggregated by date
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import type {
  GEOScore,
  CitablePassage,
  PlatformScore,
  GEORecommendation,
  SchemaIssue,
} from '@/lib/geo/types';

// ============================================================================
// TYPES
// ============================================================================

export interface GeoReadinessResult {
  score: GEOScore;
  readinessTier: string;
  readinessSummaries: Record<string, string>;
  platformReadiness: Record<string, boolean>;
  citablePassages: CitablePassage[];
  platformScores: PlatformScore[];
  recommendations: GEORecommendation[];
  schemaIssues: SchemaIssue[];
  metadata: {
    wordCount: number;
    citationCount: number;
    citationDensity: number;
    passageCount: number;
    optimalPassageCount: number;
    analyzedAt: string;
  };
}

export interface GeoAnalysisHistoryItem {
  id: number;
  contentUrl: string | null;
  platform: string;
  overallScore: number;
  citabilityScore: number;
  structureScore: number;
  multiModalScore: number;
  authorityScore: number;
  technicalScore: number;
  createdAt: string;
}

export interface GeoScoreTrend {
  date: string;
  overall: number;
  citability: number;
  structure: number;
  multiModal: number;
  authority: number;
  technical: number;
}

interface AnalyzeResponse {
  success: boolean;
  result?: {
    score: GEOScore;
    readiness: {
      tier: string;
      summaries: Record<string, string>;
      platformReadiness: Record<string, boolean>;
    };
    citablePassages: CitablePassage[];
    platformScores: PlatformScore[];
    recommendations: GEORecommendation[];
    schemaIssues: SchemaIssue[];
    metadata: {
      wordCount: number;
      citationCount: number;
      citationDensity: number;
      passageCount: number;
      optimalPassageCount: number;
      analyzedAt: string;
    };
  };
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
  const data = await res.json();
  return data as T;
}

async function fetchHistory(url: string): Promise<GeoAnalysisHistoryItem[]> {
  const data = await fetchJson<{
    success: boolean;
    analyses?: GeoAnalysisHistoryItem[];
  }>(url);
  return data.analyses || [];
}

async function fetchTrends(url: string): Promise<GeoScoreTrend[]> {
  const data = await fetchJson<{ success: boolean; trends?: GeoScoreTrend[] }>(
    url
  );
  return data.trends || [];
}

// ============================================================================
// HOOK
// ============================================================================

export function useGeoReadiness() {
  // Analysis state — remains manual (POST with body)
  const [result, setResult] = useState<GeoReadinessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeControllerRef = useRef<AbortController | null>(null);

  // History via SWR
  const {
    data: history = [],
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useSWR<GeoAnalysisHistoryItem[]>(
    '/api/seo/geo-readiness/history',
    fetchHistory,
    { revalidateOnFocus: false }
  );

  // Trends via SWR
  const {
    data: trends = [],
    isLoading: trendsLoading,
    mutate: mutateTrends,
  } = useSWR<GeoScoreTrend[]>('/api/seo/geo-readiness/trends', fetchTrends, {
    revalidateOnFocus: false,
  });

  /**
   * Run GEO Readiness analysis on content
   */
  const analyzeReadiness = useCallback(
    async (
      contentText: string,
      contentUrl?: string,
      platform?: string
    ): Promise<GeoReadinessResult | null> => {
      // Cancel any in-flight analysis request
      if (analyzeControllerRef.current) {
        analyzeControllerRef.current.abort();
      }

      const controller = new AbortController();
      analyzeControllerRef.current = controller;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await fetch('/api/seo/geo-readiness/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ contentText, contentUrl, platform }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: AnalyzeResponse = await response.json();

        if (data.result) {
          const mappedResult: GeoReadinessResult = {
            score: data.result.score,
            readinessTier: data.result.readiness.tier,
            readinessSummaries: data.result.readiness.summaries,
            platformReadiness: data.result.readiness.platformReadiness,
            citablePassages: data.result.citablePassages,
            platformScores: data.result.platformScores,
            recommendations: data.result.recommendations,
            schemaIssues: data.result.schemaIssues,
            metadata: data.result.metadata,
          };
          setResult(mappedResult);
          // Refresh history after new analysis
          void mutateHistory();
          return mappedResult;
        }

        return null;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [mutateHistory]
  );

  /**
   * Reload history with optional limit param
   */
  const loadHistory = useCallback(
    async (limit?: number) => {
      if (limit) {
        // Re-fetch with limit param — revalidate full key
        await mutateHistory();
      } else {
        await mutateHistory();
      }
    },
    [mutateHistory]
  );

  /**
   * Reload trends with optional days param
   */
  const loadTrends = useCallback(
    async (_days?: number) => {
      await mutateTrends();
    },
    [mutateTrends]
  );

  /**
   * Clear analysis result
   */
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    // Analysis
    result,
    loading,
    error,
    analyzeReadiness,
    clearResult,

    // History
    history,
    historyLoading,
    loadHistory,

    // Trends
    trends,
    trendsLoading,
    loadTrends,

    // Convenience loading state
    isLoading: loading || historyLoading || trendsLoading,
  };
}
