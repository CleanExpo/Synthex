/**
 * GEO Readiness Hook
 *
 * @description Provides GEO Readiness analysis functionality.
 * - analyzeReadiness: Run on-demand GEO readiness analysis for content
 * - history: Past analysis records from GEOAnalysis storage
 * - trends: Score trend data aggregated by date
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

interface HistoryResponse {
  success: boolean;
  analyses?: GeoAnalysisHistoryItem[];
  total?: number;
  isDemo?: boolean;
  error?: string;
}

interface TrendsResponse {
  success: boolean;
  trends?: GeoScoreTrend[];
  period?: { start: string; end: string; days: number };
  isDemo?: boolean;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useGeoReadiness() {
  // Analysis state
  const [result, setResult] = useState<GeoReadinessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<GeoAnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Trends state
  const [trends, setTrends] = useState<GeoScoreTrend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);

  const mountedRef = useRef(true);
  const analyzeControllerRef = useRef<AbortController | null>(null);
  const historyControllerRef = useRef<AbortController | null>(null);
  const trendsControllerRef = useRef<AbortController | null>(null);

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

      if (!mountedRef.current) return null;
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
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: AnalyzeResponse = await response.json();

        if (mountedRef.current && data.result) {
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
          return mappedResult;
        }

        return null;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  /**
   * Fetch analysis history
   */
  const loadHistory = useCallback(async (limit?: number) => {
    if (historyControllerRef.current) {
      historyControllerRef.current.abort();
    }

    const controller = new AbortController();
    historyControllerRef.current = controller;

    if (!mountedRef.current) return;
    setHistoryLoading(true);

    try {
      const params = limit ? `?limit=${limit}` : '';
      const response = await fetch(`/api/seo/geo-readiness/history${params}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: HistoryResponse = await response.json();

      if (mountedRef.current) {
        setHistory(data.analyses || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Silently fail for history — not critical
      console.warn('Failed to fetch GEO Readiness history:', err);
    } finally {
      if (mountedRef.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  /**
   * Fetch score trends
   */
  const loadTrends = useCallback(async (days?: number) => {
    if (trendsControllerRef.current) {
      trendsControllerRef.current.abort();
    }

    const controller = new AbortController();
    trendsControllerRef.current = controller;

    if (!mountedRef.current) return;
    setTrendsLoading(true);

    try {
      const params = days ? `?days=${days}` : '';
      const response = await fetch(`/api/seo/geo-readiness/trends${params}`, {
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
      console.warn('Failed to fetch GEO Readiness trends:', err);
    } finally {
      if (mountedRef.current) {
        setTrendsLoading(false);
      }
    }
  }, []);

  /**
   * Clear analysis result
   */
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // Fetch history and trends on mount
  useEffect(() => {
    mountedRef.current = true;
    loadHistory();
    loadTrends();

    return () => {
      mountedRef.current = false;
      if (analyzeControllerRef.current) analyzeControllerRef.current.abort();
      if (historyControllerRef.current) historyControllerRef.current.abort();
      if (trendsControllerRef.current) trendsControllerRef.current.abort();
    };
  }, [loadHistory, loadTrends]);

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
