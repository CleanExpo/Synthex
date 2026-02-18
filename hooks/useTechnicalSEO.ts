/**
 * Technical SEO Hook
 *
 * @description Provides technical SEO analysis functionality.
 * - cwvHistory: Core Web Vitals history from stored audits
 * - checkMobileParity: Compare mobile vs desktop performance
 * - validateRobotsTxt: Validate robots.txt and AI bot access
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface CwvHistoryEntry {
  date: string;
  url: string;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fid: number | null;
  overallScore: number;
}

export interface MobileParityResult {
  contentMatch: number;
  structureMatch: number;
  issues: MobileParityIssue[];
  recommendations: string[];
  mobileScore: number;
  desktopScore: number;
  mobileMetrics: {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fid: number | null;
  };
  desktopMetrics: {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fid: number | null;
  };
}

export interface MobileParityIssue {
  type: 'content' | 'structure' | 'performance' | 'accessibility';
  severity: 'critical' | 'major' | 'minor';
  title: string;
  description: string;
  mobileValue?: string | number;
  desktopValue?: string | number;
}

export interface RobotsTxtResult {
  valid: boolean;
  rawContent: string;
  directives: RobotsTxtDirective[];
  aiBotsBlocked: string[];
  aiBotsAllowed: string[];
  issues: RobotsTxtIssue[];
  sitemapUrls: string[];
  crawlDelay: number | null;
}

export interface RobotsTxtDirective {
  userAgent: string;
  rules: Array<{
    type: 'allow' | 'disallow';
    path: string;
  }>;
  crawlDelay?: number;
}

export interface RobotsTxtIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  description: string;
  recommendation: string;
}

interface CwvHistoryResponse {
  success: boolean;
  history: CwvHistoryEntry[];
  total: number;
  message?: string;
  error?: string;
}

interface MobileParityResponse {
  success: boolean;
  mobileParity: MobileParityResult;
  error?: string;
}

interface RobotsTxtResponse {
  success: boolean;
  robotsTxt: RobotsTxtResult;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useTechnicalSEO() {
  // CWV History state
  const [cwvHistory, setCwvHistory] = useState<CwvHistoryEntry[]>([]);
  const [cwvHistoryLoading, setCwvHistoryLoading] = useState(true);
  const [cwvHistoryError, setCwvHistoryError] = useState<string | null>(null);

  // Mobile Parity state
  const [mobileParityResult, setMobileParityResult] = useState<MobileParityResult | null>(null);
  const [mobileParityLoading, setMobileParityLoading] = useState(false);
  const [mobileParityError, setMobileParityError] = useState<string | null>(null);

  // Robots.txt state
  const [robotsTxtResult, setRobotsTxtResult] = useState<RobotsTxtResult | null>(null);
  const [robotsTxtLoading, setRobotsTxtLoading] = useState(false);
  const [robotsTxtError, setRobotsTxtError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch CWV history from API
   */
  const fetchCwvHistory = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!mountedRef.current) return;
    setCwvHistoryLoading(true);
    setCwvHistoryError(null);

    try {
      const response = await fetch('/api/seo/technical/cwv-history', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CwvHistoryResponse = await response.json();

      if (mountedRef.current) {
        setCwvHistory(data.history || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }
      if (mountedRef.current) {
        setCwvHistoryError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setCwvHistoryLoading(false);
      }
    }
  }, []);

  /**
   * Check mobile/desktop parity for a URL
   */
  const checkMobileParity = useCallback(async (url: string): Promise<MobileParityResult | null> => {
    if (!mountedRef.current) return null;
    setMobileParityLoading(true);
    setMobileParityError(null);
    setMobileParityResult(null);

    try {
      const response = await fetch('/api/seo/technical/mobile-parity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: MobileParityResponse = await response.json();

      if (mountedRef.current) {
        setMobileParityResult(data.mobileParity);
      }

      return data.mobileParity;
    } catch (err) {
      if (mountedRef.current) {
        setMobileParityError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setMobileParityLoading(false);
      }
    }
  }, []);

  /**
   * Validate robots.txt for a URL
   */
  const validateRobotsTxt = useCallback(async (url: string): Promise<RobotsTxtResult | null> => {
    if (!mountedRef.current) return null;
    setRobotsTxtLoading(true);
    setRobotsTxtError(null);
    setRobotsTxtResult(null);

    try {
      const response = await fetch('/api/seo/technical/robots-txt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RobotsTxtResponse = await response.json();

      if (mountedRef.current) {
        setRobotsTxtResult(data.robotsTxt);
      }

      return data.robotsTxt;
    } catch (err) {
      if (mountedRef.current) {
        setRobotsTxtError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setRobotsTxtLoading(false);
      }
    }
  }, []);

  /**
   * Refresh CWV history
   */
  const refreshCwvHistory = useCallback(async (): Promise<void> => {
    await fetchCwvHistory();
  }, [fetchCwvHistory]);

  /**
   * Clear mobile parity results
   */
  const clearMobileParityResult = useCallback(() => {
    setMobileParityResult(null);
    setMobileParityError(null);
  }, []);

  /**
   * Clear robots.txt results
   */
  const clearRobotsTxtResult = useCallback(() => {
    setRobotsTxtResult(null);
    setRobotsTxtError(null);
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchCwvHistory();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchCwvHistory]);

  return {
    // CWV History
    cwvHistory,
    cwvHistoryLoading,
    cwvHistoryError,
    refreshCwvHistory,

    // Mobile Parity
    mobileParityResult,
    mobileParityLoading,
    mobileParityError,
    checkMobileParity,
    clearMobileParityResult,

    // Robots.txt
    robotsTxtResult,
    robotsTxtLoading,
    robotsTxtError,
    validateRobotsTxt,
    clearRobotsTxtResult,

    // Convenience loading state
    isLoading: cwvHistoryLoading || mobileParityLoading || robotsTxtLoading,
  };
}
