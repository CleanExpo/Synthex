/**
 * Sponsor CRM Hook
 *
 * @description Fetches sponsor CRM data and manages CRUD operations for
 * sponsors, deals, and deliverables.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Sponsor,
  SponsorDeal,
  DealDeliverable,
  PipelineSummary,
  SponsorStatus,
  DealStage,
  DeliverableType,
  DeliverableStatus,
  CreateSponsorInput,
  UpdateSponsorInput,
  CreateDealInput,
  UpdateDealInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
} from '@/lib/sponsors/sponsor-service';

// Re-export types for consumers
export type {
  Sponsor,
  SponsorDeal,
  DealDeliverable,
  PipelineSummary,
  SponsorStatus,
  DealStage,
  DeliverableType,
  DeliverableStatus,
  CreateSponsorInput,
  UpdateSponsorInput,
  CreateDealInput,
  UpdateDealInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
};

// Re-export constants
export {
  SPONSOR_STATUSES,
  DEAL_STAGES,
  DELIVERABLE_TYPES,
  DELIVERABLE_STATUSES,
  STATUS_LABELS,
  STAGE_LABELS,
  TYPE_LABELS,
  DELIVERABLE_STATUS_LABELS,
} from '@/lib/sponsors/sponsor-service';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSponsorCRMOptions {
  sponsorStatus?: SponsorStatus;
  dealStage?: DealStage;
}

export interface SponsorCRMData {
  sponsors: Sponsor[];
  pipeline: PipelineSummary;
}

// ============================================================================
// HELPERS
// ============================================================================

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };

  const token =
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token');

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSponsorCRM(options: UseSponsorCRMOptions = {}) {
  const { sponsorStatus } = options;

  // State
  const [data, setData] = useState<SponsorCRMData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch sponsor CRM data (sponsors + pipeline)
  const fetchCRM = useCallback(async () => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // Build query params for sponsors
      const params = new URLSearchParams();
      if (sponsorStatus) params.set('status', sponsorStatus);

      // Fetch both sponsors and pipeline in parallel
      const [sponsorsRes, pipelineRes] = await Promise.all([
        fetch(`/api/sponsors?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
          signal: controller.signal,
        }),
        fetch('/api/sponsors/pipeline', {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
          signal: controller.signal,
        }),
      ]);

      if (!sponsorsRes.ok) {
        throw new Error(`HTTP ${sponsorsRes.status}`);
      }
      if (!pipelineRes.ok) {
        throw new Error(`HTTP ${pipelineRes.status}`);
      }

      const [sponsorsResult, pipelineResult] = await Promise.all([
        sponsorsRes.json(),
        pipelineRes.json(),
      ]);

      if (!sponsorsResult.success) {
        throw new Error(sponsorsResult.error || 'Failed to fetch sponsors');
      }
      if (!pipelineResult.success) {
        throw new Error(pipelineResult.error || 'Failed to fetch pipeline');
      }

      if (mountedRef.current) {
        setData({
          sponsors: sponsorsResult.data,
          pipeline: pipelineResult.data,
        });
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
        setIsLoading(false);
      }
    }
  }, [sponsorStatus]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchCRM();
  }, [fetchCRM]);

  // ===========================================================================
  // SPONSOR MUTATIONS
  // ===========================================================================

  const createSponsor = useCallback(async (input: CreateSponsorInput): Promise<Sponsor> => {
    setIsMutating(true);
    try {
      const response = await fetch('/api/sponsors', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create sponsor');
      }

      await fetchCRM();
      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  const updateSponsor = useCallback(async (id: string, input: UpdateSponsorInput): Promise<Sponsor> => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/sponsors/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update sponsor');
      }

      await fetchCRM();
      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  const deleteSponsor = useCallback(async (id: string): Promise<void> => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/sponsors/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete sponsor');
      }

      await fetchCRM();
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  // ===========================================================================
  // DEAL MUTATIONS
  // ===========================================================================

  const createDeal = useCallback(async (sponsorId: string, input: CreateDealInput): Promise<SponsorDeal> => {
    setIsMutating(true);
    try {
      const body: Record<string, unknown> = { ...input };
      if (input.startDate instanceof Date) body.startDate = input.startDate.toISOString();
      if (input.endDate instanceof Date) body.endDate = input.endDate.toISOString();

      const response = await fetch(`/api/sponsors/${sponsorId}/deals`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create deal');
      }

      await fetchCRM();
      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  const updateDeal = useCallback(async (sponsorId: string, dealId: string, input: UpdateDealInput): Promise<SponsorDeal> => {
    setIsMutating(true);
    try {
      const body: Record<string, unknown> = { ...input };
      if (input.startDate instanceof Date) body.startDate = input.startDate.toISOString();
      if (input.endDate instanceof Date) body.endDate = input.endDate.toISOString();
      if (input.paidAt instanceof Date) body.paidAt = input.paidAt.toISOString();

      const response = await fetch(`/api/sponsors/${sponsorId}/deals/${dealId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update deal');
      }

      await fetchCRM();
      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  const deleteDeal = useCallback(async (sponsorId: string, dealId: string): Promise<void> => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/sponsors/${sponsorId}/deals/${dealId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete deal');
      }

      await fetchCRM();
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  // ===========================================================================
  // DELIVERABLE MUTATIONS
  // ===========================================================================

  const createDeliverable = useCallback(async (
    sponsorId: string,
    dealId: string,
    input: CreateDeliverableInput
  ): Promise<DealDeliverable> => {
    setIsMutating(true);
    try {
      const body: Record<string, unknown> = { ...input };
      if (input.dueDate instanceof Date) body.dueDate = input.dueDate.toISOString();

      const response = await fetch(`/api/sponsors/${sponsorId}/deals/${dealId}/deliverables`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create deliverable');
      }

      await fetchCRM();
      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  const updateDeliverable = useCallback(async (
    sponsorId: string,
    dealId: string,
    deliverableId: string,
    input: UpdateDeliverableInput
  ): Promise<DealDeliverable> => {
    setIsMutating(true);
    try {
      // Note: Using a dedicated deliverable endpoint would be cleaner,
      // but for now we use the nested route structure
      const body: Record<string, unknown> = { ...input };
      if (input.dueDate instanceof Date) body.dueDate = input.dueDate.toISOString();
      if (input.completedAt instanceof Date) body.completedAt = input.completedAt.toISOString();

      // For update/delete deliverable, we'd need a dedicated route
      // For now, we'll use a generic approach
      const response = await fetch(`/api/sponsors/${sponsorId}/deals/${dealId}/deliverables/${deliverableId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      // If route doesn't exist yet, fallback behavior
      if (response.status === 404) {
        throw new Error('Deliverable update endpoint not implemented');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update deliverable');
      }

      await fetchCRM();
      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  const deleteDeliverable = useCallback(async (
    sponsorId: string,
    dealId: string,
    deliverableId: string
  ): Promise<void> => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/sponsors/${sponsorId}/deals/${dealId}/deliverables/${deliverableId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      // If route doesn't exist yet, fallback behavior
      if (response.status === 404) {
        throw new Error('Deliverable delete endpoint not implemented');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete deliverable');
      }

      await fetchCRM();
    } finally {
      setIsMutating(false);
    }
  }, [fetchCRM]);

  // Initial fetch
  useEffect(() => {
    fetchCRM();
  }, [fetchCRM]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    data,
    sponsors: data?.sponsors ?? [],
    pipeline: data?.pipeline ?? null,

    // State
    isLoading,
    error,
    isMutating,

    // Actions
    refetch,

    // Sponsor mutations
    createSponsor,
    updateSponsor,
    deleteSponsor,

    // Deal mutations
    createDeal,
    updateDeal,
    deleteDeal,

    // Deliverable mutations
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
  };
}

export default useSponsorCRM;
