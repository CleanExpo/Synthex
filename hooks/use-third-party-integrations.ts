/**
 * Third-Party Integrations Hook
 *
 * @description Manages third-party integration state (Canva, Buffer, Zapier).
 * Provides connect, disconnect, refresh, and updateConfig actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-report-templates.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ThirdPartyProvider = 'canva' | 'buffer' | 'zapier';

export interface ThirdPartyConfig {
  provider: ThirdPartyProvider;
  category: 'design' | 'scheduling' | 'automation';
  name: string;
  description: string;
  icon: string;
  requiredFields: string[];
  optionalFields: string[];
  webhookSupported: boolean;
  oauthSupported: boolean;
}

export interface ThirdPartyIntegration {
  connected: boolean;
  provider: ThirdPartyProvider;
  config: ThirdPartyConfig;
  lastSync?: string | null;
  error?: string | null;
}

/** API response shape for GET /api/integrations/third-party */
interface IntegrationsListResponse {
  integrations: ThirdPartyIntegration[];
}

/** API response shape for POST /api/integrations/third-party/[provider] */
interface ConnectResponse {
  success: boolean;
  connection: {
    id: string;
    provider: string;
    connected: boolean;
    lastSync: string | null;
  };
  message: string;
}

/** API response shape for DELETE /api/integrations/third-party/[provider] */
interface DisconnectResponse {
  success: boolean;
  message: string;
}

/** API response shape for GET /api/integrations/third-party/[provider] */
interface StatusResponse {
  connected: boolean;
  provider: string;
  lastSync?: string | null;
  tokenValid?: boolean;
  error?: string | null;
}

/** API response shape for PUT /api/integrations/third-party/[provider]/config */
interface UpdateConfigResponse {
  success: boolean;
  provider: string;
  userConfig: Record<string, unknown>;
  message: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useThirdPartyIntegrations() {
  const [integrations, setIntegrations] = useState<ThirdPartyIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all integrations from API
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
      const response = await fetch('/api/integrations/third-party', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: IntegrationsListResponse = await response.json();

      if (mountedRef.current) {
        setIntegrations(data.integrations);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
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
   * Connect a provider with credentials
   */
  const connect = useCallback(
    async (provider: ThirdPartyProvider, credentials: Record<string, unknown>): Promise<void> => {
      try {
        const response = await fetch(`/api/integrations/third-party/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _data: ConnectResponse = await response.json();

        // Refetch all integrations to reflect the change
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
   * Disconnect a provider
   */
  const disconnect = useCallback(
    async (provider: ThirdPartyProvider): Promise<void> => {
      try {
        const response = await fetch(`/api/integrations/third-party/${provider}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _data: DisconnectResponse = await response.json();

        // Refetch all integrations to reflect the change
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
   * Refresh / re-validate a provider's connection
   */
  const refresh = useCallback(
    async (provider: ThirdPartyProvider): Promise<void> => {
      try {
        const response = await fetch(`/api/integrations/third-party/${provider}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _data: StatusResponse = await response.json();

        // Refetch all integrations to reflect any status changes
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
   * Update provider-specific configuration
   */
  const updateConfig = useCallback(
    async (provider: ThirdPartyProvider, config: Record<string, unknown>): Promise<void> => {
      try {
        const response = await fetch(`/api/integrations/third-party/${provider}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _data: UpdateConfigResponse = await response.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    []
  );

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
    integrations,
    loading,
    error,
    connect,
    disconnect,
    refresh,
    updateConfig,
  };
}
