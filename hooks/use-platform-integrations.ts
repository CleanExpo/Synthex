/**
 * Platform Integrations Hook
 *
 * @description Manages social platform and analytics integration state.
 * Wraps integrationsAPI (getIntegrations, connectPlatform, disconnectPlatform)
 * from lib/api/settings.ts and exposes a clean interface to the page layer.
 *
 * Follows the same pattern as hooks/use-third-party-integrations.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { integrationsAPI } from '@/lib/api/settings';

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformIntegrationStatus {
  /** Map of platform id → connected boolean */
  integrations: Record<string, boolean>;
  /** Map of platform id → detail object */
  details: Record<string, { profileName?: string }>;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePlatformIntegrations() {
  const [data, setData] = useState<PlatformIntegrationStatus>({
    integrations: {},
    details: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all platform connection statuses from the API.
   */
  const fetchIntegrations = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const result = await integrationsAPI.getIntegrations();
      if (mountedRef.current) {
        setData({
          integrations: result.integrations || {},
          details: result.details || {},
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled — do not update state
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Initiate OAuth connection for a platform.
   * Handles popup flow (and full-page redirect for Reddit).
   */
  const connect = useCallback(
    async (platformId: string): Promise<void> => {
      try {
        await integrationsAPI.connectPlatform(platformId);
        if (mountedRef.current) {
          await fetchIntegrations();
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [fetchIntegrations]
  );

  /**
   * Disconnect a platform.
   */
  const disconnect = useCallback(
    async (platformId: string): Promise<void> => {
      try {
        await integrationsAPI.disconnectPlatform(platformId);
        if (mountedRef.current) {
          await fetchIntegrations();
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [fetchIntegrations]
  );

  /**
   * Re-fetch integration statuses (e.g. after OAuth redirect completes).
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchIntegrations();
  }, [fetchIntegrations]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchIntegrations();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchIntegrations]);

  return {
    integrations: data,
    loading,
    error,
    connect,
    disconnect,
    refresh,
  };
}
