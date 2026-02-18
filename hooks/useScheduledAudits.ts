/**
 * Scheduled SEO Audits Hook
 *
 * @description Provides scheduled audit target management functionality.
 * - targets: List of scheduled audit targets
 * - createTarget: Add new scheduled audit
 * - updateTarget: Modify target settings
 * - deleteTarget: Remove a target
 * - runManualAudit: Trigger immediate audit
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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
// HOOK
// ============================================================================

export function useScheduledAudits() {
  // Targets state
  const [targets, setTargets] = useState<ScheduledAuditTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Operation states
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);

  const mountedRef = useRef(true);
  const loadControllerRef = useRef<AbortController | null>(null);

  /**
   * Load all scheduled audit targets
   */
  const loadTargets = useCallback(async () => {
    if (loadControllerRef.current) {
      loadControllerRef.current.abort();
    }

    const controller = new AbortController();
    loadControllerRef.current = controller;

    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/seo/scheduled-audits', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.upgradeRequired) {
          throw new Error('Scheduled audits require a Professional subscription');
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TargetsResponse = await response.json();

      if (mountedRef.current) {
        setTargets(data.targets || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
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
   * Create a new scheduled audit target
   */
  const createTarget = useCallback(async (data: CreateTargetData): Promise<ScheduledAuditTarget | null> => {
    if (!mountedRef.current) return null;
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
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: SingleTargetResponse = await response.json();

      if (mountedRef.current && result.target) {
        setTargets(prev => [result.target!, ...prev]);
        return result.target;
      }

      return null;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setCreating(false);
      }
    }
  }, []);

  /**
   * Update an existing target
   */
  const updateTarget = useCallback(async (id: string, data: UpdateTargetData): Promise<ScheduledAuditTarget | null> => {
    if (!mountedRef.current) return null;
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
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: SingleTargetResponse = await response.json();

      if (mountedRef.current && result.target) {
        setTargets(prev => prev.map(t => t.id === id ? result.target! : t));
        return result.target;
      }

      return null;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setUpdating(false);
      }
    }
  }, []);

  /**
   * Delete a target
   */
  const deleteTarget = useCallback(async (id: string): Promise<boolean> => {
    if (!mountedRef.current) return false;
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/seo/scheduled-audits/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (mountedRef.current) {
        setTargets(prev => prev.filter(t => t.id !== id));
      }

      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setDeleting(false);
      }
    }
  }, []);

  /**
   * Run a manual audit for a URL (immediate)
   */
  const runManualAudit = useCallback(async (url: string): Promise<AuditResponse['audit'] | null> => {
    if (!mountedRef.current) return null;
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
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: AuditResponse = await response.json();

      // Refresh targets to get updated lastScore
      if (mountedRef.current) {
        loadTargets();
      }

      return result.audit || null;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setAuditRunning(false);
      }
    }
  }, [loadTargets]);

  /**
   * Toggle target enabled state
   */
  const toggleEnabled = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    const result = await updateTarget(id, { enabled });
    return result !== null;
  }, [updateTarget]);

  // Load targets on mount
  useEffect(() => {
    mountedRef.current = true;
    loadTargets();

    return () => {
      mountedRef.current = false;
      if (loadControllerRef.current) loadControllerRef.current.abort();
    };
  }, [loadTargets]);

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
