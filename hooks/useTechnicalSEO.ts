/**
 * Technical SEO Hook
 *
 * @description Provides technical SEO analysis functionality.
 * - cwvHistory: Core Web Vitals history from stored audits
 * - checkMobileParity: Compare mobile vs desktop performance
 * - validateRobotsTxt: Validate robots.txt and AI bot access
 */

'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';

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
// FETCHER
// ============================================================================

async function fetchCwvHistory(url: string): Promise<CwvHistoryEntry[]> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `HTTP ${res.status}: ${res.statusText}`
    );
  }
  const data: CwvHistoryResponse = await res.json();
  return data.history || [];
}

// ============================================================================
// HOOK
// ============================================================================

export function useTechnicalSEO() {
  // CWV History via SWR
  const {
    data: cwvHistory = [],
    isLoading: cwvHistoryLoading,
    error: cwvHistoryErrorRaw,
    mutate: mutateCwvHistory,
  } = useSWR<CwvHistoryEntry[]>(
    '/api/seo/technical/cwv-history',
    fetchCwvHistory,
    { revalidateOnFocus: false }
  );

  const cwvHistoryError = cwvHistoryErrorRaw
    ? cwvHistoryErrorRaw instanceof Error
      ? cwvHistoryErrorRaw.message
      : String(cwvHistoryErrorRaw)
    : null;

  // Mobile Parity state — on-demand POST
  const [mobileParityResult, setMobileParityResult] =
    useState<MobileParityResult | null>(null);
  const [mobileParityLoading, setMobileParityLoading] = useState(false);
  const [mobileParityError, setMobileParityError] = useState<string | null>(
    null
  );

  // Robots.txt state — on-demand POST
  const [robotsTxtResult, setRobotsTxtResult] =
    useState<RobotsTxtResult | null>(null);
  const [robotsTxtLoading, setRobotsTxtLoading] = useState(false);
  const [robotsTxtError, setRobotsTxtError] = useState<string | null>(null);

  /**
   * Check mobile/desktop parity for a URL
   */
  const checkMobileParity = useCallback(
    async (url: string): Promise<MobileParityResult | null> => {
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
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: MobileParityResponse = await response.json();

        setMobileParityResult(data.mobileParity);
        return data.mobileParity;
      } catch (err) {
        setMobileParityError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setMobileParityLoading(false);
      }
    },
    []
  );

  /**
   * Validate robots.txt for a URL
   */
  const validateRobotsTxt = useCallback(
    async (url: string): Promise<RobotsTxtResult | null> => {
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
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: RobotsTxtResponse = await response.json();

        setRobotsTxtResult(data.robotsTxt);
        return data.robotsTxt;
      } catch (err) {
        setRobotsTxtError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setRobotsTxtLoading(false);
      }
    },
    []
  );

  /**
   * Refresh CWV history
   */
  const refreshCwvHistory = useCallback(async (): Promise<void> => {
    await mutateCwvHistory();
  }, [mutateCwvHistory]);

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
