/**
 * Webhooks Hook
 *
 * @description Manages webhook subscription state.
 * Provides create, update, remove, and refresh actions.
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

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

export function useWebhooks() {
  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<WebhooksListResponse>('/api/webhooks/user', fetchJson, {
    revalidateOnFocus: false,
  });

  // Backward-compatible aliases
  const loading = isLoading;
  const webhooks = response?.data ?? [];
  const availableEvents = response?.availableEvents ?? [];

  /**
   * Create a new webhook subscription
   * Returns the full webhook data including the secret (shown only once)
   */
  const create = useCallback(
    async (
      data: CreateWebhookData
    ): Promise<WebhookEndpointWithSecret | null> => {
      const res = await fetch('/api/webhooks/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const result: CreateWebhookResponse = await res.json();
      await mutate();
      return result.data;
    },
    [mutate]
  );

  /**
   * Update an existing webhook subscription
   */
  const update = useCallback(
    async (id: string, data: UpdateWebhookData): Promise<boolean> => {
      const res = await fetch('/api/webhooks/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, ...data }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const _result: UpdateWebhookResponse = await res.json();
      await mutate();
      return true;
    },
    [mutate]
  );

  /**
   * Remove a webhook subscription
   */
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await fetch(
        `/api/webhooks/user?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
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

      const _result: DeleteWebhookResponse = await res.json();
      await mutate();
      return true;
    },
    [mutate]
  );

  /**
   * Refresh the webhooks list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    webhooks,
    availableEvents,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    create,
    update,
    remove,
    refresh,
  };
}
