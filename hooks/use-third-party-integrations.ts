/**
 * Third-Party Integrations Hook
 *
 * @description Manages third-party integration state (Canva, Buffer, Zapier).
 * Provides connect, disconnect, refresh, and updateConfig actions.
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

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
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useThirdPartyIntegrations() {
  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<IntegrationsListResponse>(
    '/api/integrations/third-party',
    fetchJson,
    { revalidateOnFocus: false }
  );

  // Backward-compatible aliases
  const loading = isLoading;
  const integrations = response?.integrations ?? [];

  /**
   * Connect a provider with credentials
   */
  const connect = useCallback(
    async (
      provider: ThirdPartyProvider,
      credentials: Record<string, unknown>
    ): Promise<void> => {
      const res = await fetch(`/api/integrations/third-party/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const _data: ConnectResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Disconnect a provider
   */
  const disconnect = useCallback(
    async (provider: ThirdPartyProvider): Promise<void> => {
      const res = await fetch(`/api/integrations/third-party/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const _data: DisconnectResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Refresh / re-validate a provider's connection
   */
  const refresh = useCallback(
    async (provider: ThirdPartyProvider): Promise<void> => {
      const res = await fetch(`/api/integrations/third-party/${provider}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const _data: StatusResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Update provider-specific configuration
   */
  const updateConfig = useCallback(
    async (
      provider: ThirdPartyProvider,
      config: Record<string, unknown>
    ): Promise<void> => {
      const res = await fetch(
        `/api/integrations/third-party/${provider}/config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(config),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const _data: UpdateConfigResponse = await res.json();
    },
    []
  );

  return {
    integrations,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    connect,
    disconnect,
    refresh,
    updateConfig,
  };
}
