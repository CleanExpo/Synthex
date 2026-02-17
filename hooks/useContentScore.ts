/**
 * useContentScore Hook
 *
 * @description Debounced React hook for real-time content scoring.
 * Calls POST /api/content/score whenever content, platform, or goal
 * changes (after debounce). Cancels pending requests with AbortController.
 *
 * Usage:
 * ```tsx
 * const { score, isLoading, error, refresh } = useContentScore({
 *   content: editorValue,
 *   platform: 'linkedin',
 *   goal: 'engagement',
 *   debounceMs: 600,
 * });
 * ```
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { ScoreResult } from '@/lib/ai/content-scorer';

// ============================================================================
// TYPES
// ============================================================================

export interface UseContentScoreOptions {
  /** The content string to score */
  content: string;
  /** Target platform */
  platform: string;
  /** Optimization goal (default: 'engagement') */
  goal?: string;
  /** Optional PromptTemplate ID for structural comparison */
  templateId?: string;
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
  /** When false, scoring is paused (default: true) */
  enabled?: boolean;
}

export interface UseContentScoreReturn {
  /** Latest score result, or null if not yet scored or content is empty */
  score: ScoreResult | null;
  /** True while a score request is in-flight */
  isLoading: boolean;
  /** Error message from last failed request, or null */
  error: string | null;
  /** Manually triggers a fresh score request, bypassing debounce */
  refresh: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_DEBOUNCE_MS = 500;
const SCORE_ENDPOINT = '/api/content/score';

// ============================================================================
// HOOK
// ============================================================================

/**
 * Debounced hook that scores content in real time via the scoring API.
 * Automatically cancels in-flight requests when inputs change or the
 * component unmounts.
 */
export function useContentScore({
  content,
  platform,
  goal = 'engagement',
  templateId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
}: UseContentScoreOptions): UseContentScoreReturn {
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the AbortController for the pending fetch
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track the debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref for triggering manual refresh
  const refreshCounterRef = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  /**
   * Perform the actual fetch to the scoring API.
   * Caller is responsible for providing an AbortSignal.
   */
  const fetchScore = useCallback(
    async (signal: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(SCORE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal,
          body: JSON.stringify({
            content,
            platform,
            goal,
            ...(templateId ? { templateId } : {}),
          }),
        });

        // Bail out if the request was cancelled
        if (signal.aborted) return;

        if (!response.ok) {
          let errorMessage = `Scoring request failed (${response.status})`;
          try {
            const data = await response.json();
            if (typeof data?.error === 'string') {
              errorMessage = data.error;
            }
          } catch {
            // Ignore JSON parse failures on error responses
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Guard against stale responses after abort
        if (signal.aborted) return;

        if (data?.success && data?.score) {
          setScore(data.score as ScoreResult);
        } else {
          throw new Error('Unexpected response shape from scoring API');
        }
      } catch (err) {
        if (signal.aborted) return;

        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        // Clear stale score on error
        setScore(null);
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [content, platform, goal, templateId]
  );

  /**
   * Cancels any pending debounce timer and aborts any in-flight request.
   */
  const cancelPending = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Core effect — runs when inputs or refreshTick changes
  useEffect(() => {
    // Guard conditions
    if (!enabled || content.trim().length === 0) {
      cancelPending();
      setIsLoading(false);
      setError(null);
      // Keep last score visible when content is cleared
      return;
    }

    // Cancel any previously scheduled request
    cancelPending();

    // Schedule the fetch after debounce
    debounceTimerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      void fetchScore(controller.signal);
    }, debounceMs);

    // Cleanup on re-render or unmount
    return () => {
      cancelPending();
    };
  }, [content, platform, goal, templateId, enabled, debounceMs, refreshTick, fetchScore, cancelPending]);

  /**
   * Immediately fires a new score request, bypassing debounce.
   * Useful for "Score now" buttons.
   */
  const refresh = useCallback(() => {
    cancelPending();
    refreshCounterRef.current += 1;
    setRefreshTick((prev) => prev + 1);
  }, [cancelPending]);

  return { score, isLoading, error, refresh };
}

export default useContentScore;
