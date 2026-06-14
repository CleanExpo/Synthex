/**
 * Universal API Data Fetching Hook
 *
 * @description SWR-inspired data fetching with:
 * - Automatic caching and revalidation
 * - Optimistic updates
 * - Error handling with retry
 * - Loading states
 * - Refetch on window focus
 * - Polling support
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_APP_URL: Application base URL (PUBLIC)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkApiKeyRequired } from '@/lib/utils/api-key-interceptor';

// ============================================================================
// TYPES
// ============================================================================

export interface UseApiOptions<T> {
  /** Initial data before fetch completes */
  initialData?: T;
  /** Cache time in milliseconds (default: 5 minutes) */
  cacheTime?: number;
  /** Stale time before revalidation (default: 30 seconds) */
  staleTime?: number;
  /** Enable polling with interval in ms */
  pollingInterval?: number;
  /** Refetch on window focus */
  revalidateOnFocus?: boolean;
  /** Refetch on reconnect */
  revalidateOnReconnect?: boolean;
  /** Number of retry attempts on error */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Skip fetching (for conditional fetching) */
  skip?: boolean;
  /** Called on successful fetch */
  onSuccess?: (data: T) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Transform response data */
  transform?: (data: unknown) => T;
  /** Dependencies that trigger refetch */
  deps?: unknown[];
}

export interface UseApiResult<T> {
  /** Fetched data */
  data: T | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Whether data is being revalidated */
  isValidating: boolean;
  /** Manually trigger refetch */
  refetch: () => Promise<void>;
  /** Mutate data optimistically */
  mutate: (data: T | ((prev: T | undefined) => T)) => void;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// ----------------------------------------------------------------------------
// MULTI-BRAND (SYN-908 follow-up): active-org scoping
// ----------------------------------------------------------------------------
// `useApi` keeps its OWN module-level cache, separate from SWR. It was keyed by
// URL only, so when a multi-business owner switched their active org via
// `useActiveBusiness.switchBusiness`, every `useApi` widget kept serving the
// PREVIOUS org's response (until a window blur→focus + staleness elapsed).
//
// Fix: scope every cache key by the currently-active organization id. A brand
// switch becomes a different key, so consumers naturally refetch instead of
// reading the prior org's entry. The active org is published here by
// `useActiveBusiness` (one-directional: useActiveBusiness → use-api) to avoid a
// circular import (use-dashboard → use-api, and useActiveBusiness pulls in SWR +
// use-user). Consumers read it reactively via `useActiveOrgKey()` below.

let activeOrgId: string | null = null;
const activeOrgListeners = new Set<() => void>();

/**
 * Publish the currently-active organization id into the use-api layer.
 * Called by `useActiveBusiness` whenever the active org is known/changes.
 * No-ops (and notifies nothing) when the value is unchanged, so re-renders of
 * the publishing hook don't trigger a refetch storm.
 */
export function setUseApiActiveOrg(orgId: string | null): void {
  if (orgId === activeOrgId) return;
  activeOrgId = orgId;
  activeOrgListeners.forEach(listener => listener());
}

export function getUseApiActiveOrg(): string | null {
  return activeOrgId;
}

/**
 * Build the org-scoped cache key for a request URL.
 * Pure + exported for unit testing. When no active org is known the key falls
 * back to the bare URL (unchanged behaviour for single-org / unauthenticated).
 */
export function buildCacheKey(url: string, orgId: string | null): string {
  return orgId ? `org:${orgId}|${url}` : url;
}

/**
 * Drop cached entries for the current/previous org. Called on brand switch so
 * the old org's data can never be served, even on the bare-URL fallback key.
 * Without an argument it clears the whole map (used by `switchBusiness`).
 */
export function clearUseApiCache(): void {
  cache.clear();
}

/**
 * Subscribe a `useApi` consumer to active-org changes so a brand switch
 * re-runs its fetch effect (the active org is part of the cache key).
 */
function useActiveOrgKey(): string | null {
  const [org, setOrg] = useState<string | null>(activeOrgId);
  useEffect(() => {
    // Sync in case the value changed between render and effect.
    setOrg(activeOrgId);
    const listener = () => setOrg(activeOrgId);
    activeOrgListeners.add(listener);
    return () => {
      activeOrgListeners.delete(listener);
    };
  }, []);
  return org;
}

function getCached<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined;
}

function setCache<T>(key: string, data: T, cacheTime: number, staleTime: number): void {
  const now = Date.now();
  cache.set(key, {
    data,
    timestamp: now,
    staleAt: now + staleTime,
  });

  // Auto-expire after cacheTime
  setTimeout(() => {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp >= cacheTime) {
      cache.delete(key);
    }
  }, cacheTime);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * @deprecated Auth tokens are now stored in httpOnly cookies (security fix UNI-523)
 * This function returns null as tokens are no longer stored in localStorage.
 * Use credentials: 'include' in fetch requests instead.
 */
function getAuthToken(): string | null {
  // Security fix UNI-523: Auth tokens are now in httpOnly cookies only
  // Return null - callers should migrate to credentials: 'include'
  return null;
}

async function fetchWithAuth<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Authentication is handled via httpOnly cookies (credentials: 'include')
  // No Authorization header needed - cookies are sent automatically
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    credentials: 'include', // Send httpOnly auth cookies automatically
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    // Global 402 interception: prompt user to add AI API key
    checkApiKeyRequired(response);
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useApi<T>(
  url: string | null,
  options: UseApiOptions<T> = {}
): UseApiResult<T> {
  const {
    initialData,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 30 * 1000, // 30 seconds
    pollingInterval,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    retryCount = 3,
    retryDelay = 1000,
    skip = false,
    onSuccess,
    onError,
    transform,
    deps = [],
  } = options;

  // Active org scopes the cache key so a brand switch is a different key and
  // naturally refetches instead of serving the previous org's response.
  const orgKey = useActiveOrgKey();
  const cacheKey = url ? buildCacheKey(url, orgKey) : null;

  const [data, setData] = useState<T | undefined>(() => {
    if (initialData) return initialData;
    if (cacheKey) {
      const cached = getCached<T>(cacheKey);
      if (cached) return cached.data;
    }
    return undefined;
  });
  const [isLoading, setIsLoading] = useState(!data && !skip);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(async (isRevalidation = false) => {
    if (!url || skip) return;

    if (!isRevalidation) {
      setIsLoading(true);
    } else {
      setIsValidating(true);
    }
    setError(null);

    try {
      const fetchedData = await fetchWithAuth<T>(url);
      let result: T = fetchedData;

      if (transform) {
        result = transform(fetchedData as unknown);
      }

      if (mountedRef.current) {
        setData(result);
        if (cacheKey) setCache(cacheKey, result, cacheTime, staleTime);
        retryCountRef.current = 0;
        onSuccess?.(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (mountedRef.current) {
        // Retry logic
        if (retryCountRef.current < retryCount) {
          retryCountRef.current++;
          setTimeout(() => fetchData(isRevalidation), retryDelay * retryCountRef.current);
          return;
        }

        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsValidating(false);
      }
    }
  }, [url, cacheKey, skip, transform, cacheTime, staleTime, retryCount, retryDelay, onSuccess, onError]);

  const refetch = useCallback(async () => {
    retryCountRef.current = 0;
    await fetchData(false);
  }, [fetchData]);

  const mutate = useCallback((newData: T | ((prev: T | undefined) => T)) => {
    setData((prev: T | undefined) => {
      const result = typeof newData === 'function'
        ? (newData as (prev: T | undefined) => T)(prev)
        : newData;

      if (cacheKey) {
        setCache(cacheKey, result as T, cacheTime, staleTime);
      }

      return result;
    });
  }, [cacheKey, cacheTime, staleTime]);

  // Initial fetch — re-runs when the active org changes (cacheKey), so a brand
  // switch refetches against the now-active org instead of serving stale data.
  useEffect(() => {
    if (skip || !cacheKey) return;

    const cached = getCached<T>(cacheKey);

    if (cached) {
      setData(cached.data);

      // Revalidate if stale
      if (Date.now() > cached.staleAt) {
        fetchData(true);
      }
    } else {
      // No entry for this org yet (e.g. just switched): show nothing stale and
      // fetch fresh for the active org.
      setData(undefined);
      fetchData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, skip, ...deps]);

  // Polling
  useEffect(() => {
    if (!pollingInterval || skip || !url) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingInterval, skip, url, fetchData]);

  // Revalidate on focus
  useEffect(() => {
    if (!revalidateOnFocus || typeof window === 'undefined') return;

    const handleFocus = () => {
      const cached = cacheKey ? getCached<T>(cacheKey) : undefined;
      if (cached && Date.now() > cached.staleAt) {
        fetchData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateOnFocus, cacheKey, fetchData]);

  // Revalidate on reconnect
  useEffect(() => {
    if (!revalidateOnReconnect || typeof window === 'undefined') return;

    const handleOnline = () => {
      fetchData(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [revalidateOnReconnect, fetchData]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, isLoading, error, isValidating, refetch, mutate };
}

// ============================================================================
// MUTATION HOOK
// ============================================================================

export interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}

export interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: Error | null;
  data: TData | undefined;
  reset: () => void;
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
  const { onSuccess, onError, onSettled } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mutationFn(variables);
      setData(result);
      onSuccess?.(result, variables);
      onSettled?.(result, null, variables);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error, variables);
      onSettled?.(undefined, error, variables);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mutationFn, onSuccess, onError, onSettled]);

  const mutate = useCallback((variables: TVariables): Promise<TData> => {
    return mutateAsync(variables).catch(() => undefined as unknown as TData);
  }, [mutateAsync]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(undefined);
  }, []);

  return { mutate, mutateAsync, isLoading, error, data, reset };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { fetchWithAuth, getAuthToken };
export default useApi;
