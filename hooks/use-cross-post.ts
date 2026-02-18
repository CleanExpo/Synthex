/**
 * Cross-Post Hook
 *
 * @description Manages cross-post state and operations.
 * Provides preview and publish functionality for multi-platform content posting.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-personas.ts.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type { SupportedPlatform } from '@/lib/social';
import type { PlatformVariant, AdaptedContent } from '@/lib/ai/multi-format-adapter';

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformPostResult {
  platform: SupportedPlatform;
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  dbPostId?: string;
}

export interface CrossPostSummary {
  publishedCount: number;
  scheduledCount: number;
  failedCount: number;
  totalCount: number;
}

export interface CrossPostResponse {
  success: boolean;
  mode: 'preview' | 'publish';
  source: {
    content: string;
    platform?: string;
  };
  variants: PlatformVariant[];
  results?: PlatformPostResult[];
  summary?: CrossPostSummary;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ALL_PLATFORMS: SupportedPlatform[] = [
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
];

export const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'playful', label: 'Playful' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'friendly', label: 'Friendly' },
] as const;

export const GOAL_OPTIONS = [
  { value: 'engagement', label: 'Engagement' },
  { value: 'reach', label: 'Reach' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
] as const;

export type ToneOption = typeof TONE_OPTIONS[number]['value'];
export type GoalOption = typeof GOAL_OPTIONS[number]['value'];

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

export function useCrossPost() {
  // Content state
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<Set<SupportedPlatform>>(new Set());
  const [tone, setTone] = useState<ToneOption | undefined>(undefined);
  const [goal, setGoal] = useState<GoalOption | undefined>(undefined);
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);

  // Preview/publish state
  const [variants, setVariants] = useState<PlatformVariant[] | null>(null);
  const [results, setResults] = useState<PlatformPostResult[] | null>(null);
  const [summary, setSummary] = useState<CrossPostSummary | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'preview' | 'results'>('input');

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Toggle a platform selection
   */
  const togglePlatform = useCallback((platform: SupportedPlatform) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }, []);

  /**
   * Select all platforms
   */
  const selectAllPlatforms = useCallback(() => {
    setPlatforms(new Set(ALL_PLATFORMS));
  }, []);

  /**
   * Clear all platform selections
   */
  const clearPlatforms = useCallback(() => {
    setPlatforms(new Set());
  }, []);

  /**
   * Preview content adaptations without posting
   */
  const preview = useCallback(async (): Promise<boolean> => {
    if (content.trim().length < 10 || platforms.size === 0) {
      setError('Please enter content and select at least one platform.');
      return false;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/content/cross-post', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          content,
          platforms: Array.from(platforms),
          tone,
          goal,
          personaId,
          mode: 'preview',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CrossPostResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Preview failed');
      }

      if (mountedRef.current) {
        setVariants(data.variants);
        setPhase('preview');
      }

      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [content, platforms, tone, goal, personaId]);

  /**
   * Publish content to all selected platforms
   */
  const publish = useCallback(async (): Promise<boolean> => {
    if (content.trim().length < 10 || platforms.size === 0) {
      setError('Please enter content and select at least one platform.');
      return false;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/content/cross-post', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          content,
          platforms: Array.from(platforms),
          tone,
          goal,
          personaId,
          scheduledAt: scheduledAt?.toISOString(),
          mode: 'publish',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CrossPostResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Publish failed');
      }

      if (mountedRef.current) {
        setVariants(data.variants);
        setResults(data.results || null);
        setSummary(data.summary || null);
        setPhase('results');
      }

      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [content, platforms, tone, goal, personaId, scheduledAt]);

  /**
   * Reset all state to start over
   */
  const reset = useCallback(() => {
    setContent('');
    setPlatforms(new Set());
    setTone(undefined);
    setGoal(undefined);
    setPersonaId(undefined);
    setScheduledAt(undefined);
    setVariants(null);
    setResults(null);
    setSummary(null);
    setError(null);
    setPhase('input');
  }, []);

  /**
   * Go back to input phase
   */
  const backToInput = useCallback(() => {
    setVariants(null);
    setResults(null);
    setSummary(null);
    setError(null);
    setPhase('input');
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed values
  const selectedPlatforms = Array.from(platforms);
  const hasVariants = variants !== null && variants.length > 0;
  const publishedCount = summary?.publishedCount ?? 0;
  const scheduledCount = summary?.scheduledCount ?? 0;
  const failedCount = summary?.failedCount ?? 0;
  const canPreview = content.trim().length >= 10 && platforms.size > 0 && !isLoading;
  const canPublish = hasVariants && !isLoading;

  return {
    // Content state
    content,
    setContent,
    platforms,
    selectedPlatforms,
    togglePlatform,
    selectAllPlatforms,
    clearPlatforms,
    tone,
    setTone,
    goal,
    setGoal,
    personaId,
    setPersonaId,
    scheduledAt,
    setScheduledAt,

    // Preview/publish state
    variants,
    results,
    summary,

    // UI state
    isLoading,
    error,
    phase,

    // Actions
    preview,
    publish,
    reset,
    backToInput,
    clearError,

    // Computed
    hasVariants,
    publishedCount,
    scheduledCount,
    failedCount,
    canPreview,
    canPublish,
  };
}
