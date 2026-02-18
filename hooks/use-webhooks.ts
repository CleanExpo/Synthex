/**
 * Webhooks Hook
 *
 * @description Manages webhook subscription state.
 * Provides create, update, remove, and refresh actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-third-party-integrations.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface WebhookEndpoint {
  id: string;
  url: string;
  secretPreview: string; // last 4 chars
  description: string | null;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastDeliveredAt: string | null;
  failureCount: number;
}

export interface WebhookEndpointWithSecret extends WebhookEndpoint {
  secret: string; // Full secret, only returned on creation
}

export interface CreateWebhookData {
  url: string;
  events: string[];
  secret?: string;
  description?: string;
}

export interface UpdateWebhookData {
  url?: string;
  events?: string[];
  active?: boolean;
  description?: string | null;
}

/** API response shape for GET /api/webhooks/user */
interface WebhooksListResponse {
  success: boolean;
  data: WebhookEndpoint[];
  availableEvents: string[];
}

/** API response shape for POST /api/webhooks/user */
interface CreateWebhookResponse {
  success: boolean;
  message: string;
  warning?: string;
  data: WebhookEndpointWithSecret;
}

/** API response shape for PATCH /api/webhooks/user */
interface UpdateWebhookResponse {
  success: boolean;
  message: string;
  warning?: string;
  data: WebhookEndpoint;
}

/** API response shape for DELETE /api/webhooks/user */
interface DeleteWebhookResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all webhooks from API
   */
  const fetchWebhooks = useCallback(async () => {
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
      const response = await fetch('/api/webhooks/user', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: WebhooksListResponse = await response.json();

      if (mountedRef.current) {
        setWebhooks(data.data);
        setAvailableEvents(data.availableEvents);
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
   * Create a new webhook subscription
   * Returns the full webhook data including the secret (shown only once)
   */
  const create = useCallback(
    async (data: CreateWebhookData): Promise<WebhookEndpointWithSecret | null> => {
      try {
        const response = await fetch('/api/webhooks/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result: CreateWebhookResponse = await response.json();

        // Refetch all webhooks to reflect the change
        if (mountedRef.current) {
          await fetchWebhooks();
        }

        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [fetchWebhooks]
  );

  /**
   * Update an existing webhook subscription
   */
  const update = useCallback(
    async (id: string, data: UpdateWebhookData): Promise<boolean> => {
      try {
        const response = await fetch('/api/webhooks/user', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id, ...data }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: UpdateWebhookResponse = await response.json();

        // Refetch all webhooks to reflect the change
        if (mountedRef.current) {
          await fetchWebhooks();
        }

        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return false;
      }
    },
    [fetchWebhooks]
  );

  /**
   * Remove a webhook subscription
   */
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/webhooks/user?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: DeleteWebhookResponse = await response.json();

        // Refetch all webhooks to reflect the change
        if (mountedRef.current) {
          await fetchWebhooks();
        }

        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return false;
      }
    },
    [fetchWebhooks]
  );

  /**
   * Refresh the webhooks list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchWebhooks();
  }, [fetchWebhooks]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchWebhooks();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchWebhooks]);

  return {
    webhooks,
    availableEvents,
    loading,
    error,
    create,
    update,
    remove,
    refresh,
  };
}
