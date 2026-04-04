/**
 * Scheduled SEO Audits Hook
 *
 * @description Provides scheduled audit target management functionality.
 * - targets: List of scheduled audit targets
 * - createTarget: Add new scheduled audit
 * - updateTarget: Modify target settings
 * - deleteTarget: Remove a target
 * - runManualAudit: Trigger immediate audit
 */

'use client';

import useSWR from 'swr';
import { useCallback, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ScheduledAuditTarget {
  id: string;
  userId: string;
  url: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  alertThreshold: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastScore: number | null;
  createdAt: string;
  updatedAt: string;
  latestAudit?: {
    id: number;
    overallScore: number;
    createdAt: string;
  } | null;
}

export interface CreateTargetData {
  url: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  alertThreshold?: number;
}

export interface UpdateTargetData {
  name?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  alertThreshold?: number;
  enabled?: boolean;
}

interface TargetsResponse {
  success: boolean;
  targets?: ScheduledAuditTarget[];
  total?: number;
  error?: string;
  upgradeRequired?: boolean;
}

interface SingleTargetResponse {
  success: boolean;
  target?: ScheduledAuditTarget;
  error?: string;
}

interface AuditResponse {
  success: boolean;
  audit?: {
    url: string;
    score: number;
    lighthouse: {
      performance: number;
      seo: number;
      accessibility: number;
      bestPractices: number;
    };
    issues: {
      critical: number;
      major: number;
      minor: number;
      info: number;
    };
  };
  error?: string;
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if ((errorData as { upgradeRequired?: boolean }).upgradeRequired) {
      throw new Error('Scheduled audits require a Professional subscription');
    }
    throw new Error(
      (errorData as { error?: string }).error ||
        `HTTP ${res.status}: ${res.statusText}`
    );
  }
  const data: TargetsResponse = await res.json();
  return (data.targets ?? []) as T;
}

// ============================================================================
// HOOK
// ============================================================================

export function useScheduledAudits() {
  const [error, setError] = useState<string | null>(null);

  // Operation states
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);

  const {
    data: targets = [],
    isLoading: loading,
    mutate,
  } = useSWR<ScheduledAuditTarget[]>('/api/seo/scheduled-audits', fetchJson, {
    revalidateOnFocus: false,
  });

  const loadTargets = useCallback(async () => {
    await mutate();
  }, [mutate]);

  /**
   * Create a new scheduled audit target
   */
  const createTarget = useCallback(
    async (data: CreateTargetData): Promise<ScheduledAuditTarget | null> => {
      setCreating(true);
      setError(null);

      try {
        const response = await fetch('/api/seo/scheduled-audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const result: SingleTargetResponse = await response.json();

        if (result.target) {
          await mutate();
          return result.target;
        }

        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setCreating(false);
      }
    },
    [mutate]
  );

  /**
   * Update an existing target
   */
  const updateTarget = useCallback(
    async (
      id: string,
      data: UpdateTargetData
    ): Promise<ScheduledAuditTarget | null> => {
      setUpdating(true);
      setError(null);

      try {
        const response = await fetch(`/api/seo/scheduled-audits/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const result: SingleTargetResponse = await response.json();

        if (result.target) {
          await mutate();
          return result.target;
        }

        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setUpdating(false);
      }
    },
    [mutate]
  );

  /**
   * Delete a target
   */
  const deleteTarget = useCallback(
    async (id: string): Promise<boolean> => {
      setDeleting(true);
      setError(null);

      try {
        const response = await fetch(`/api/seo/scheduled-audits/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        await mutate();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [mutate]
  );

  /**
   * Run a manual audit for a URL (immediate)
   */
  const runManualAudit = useCallback(
    async (url: string): Promise<AuditResponse['audit'] | null> => {
      setAuditRunning(true);
      setError(null);

      try {
        const response = await fetch('/api/seo/audit', {
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

        const result: AuditResponse = await response.json();

        // Refresh targets to get updated lastScore
        await mutate();

        return result.audit || null;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setAuditRunning(false);
      }
    },
    [mutate]
  );

  /**
   * Toggle target enabled state
   */
  const toggleEnabled = useCallback(
    async (id: string, enabled: boolean): Promise<boolean> => {
      const result = await updateTarget(id, { enabled });
      return result !== null;
    },
    [updateTarget]
  );

  return {
    // Data
    targets,
    loading,
    error,

    // CRUD operations
    loadTargets,
    createTarget,
    updateTarget,
    deleteTarget,
    toggleEnabled,

    // Manual audit
    runManualAudit,
    auditRunning,

    // Operation states
    creating,
    updating,
    deleting,

    // Convenience
    isOperating: creating || updating || deleting || auditRunning,
  };
}
