/**
 * Personas Hook
 *
 * @description Manages persona state and operations (CRUD + training).
 * Provides create, update, delete, startTraining, and getTrainingStatus actions.
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

// ============================================================================
// TYPES
// ============================================================================

export interface Persona {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'training' | 'active' | 'archived';
  tone: string;
  style: string;
  vocabulary: string;
  emotion: string;
  trainingSourcesCount: number;
  trainingWordsCount: number;
  trainingSamplesCount: number;
  accuracy: number;
  lastTrained: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSource {
  type: 'text' | 'social_post' | 'document' | 'website' | 'conversation';
  content: string;
  metadata?: {
    platform?: string;
    engagement?: number;
    date?: string;
    url?: string;
  };
}

export interface CreatePersonaData {
  name: string;
  description?: string;
  tone?: 'professional' | 'casual' | 'authoritative' | 'friendly' | 'humorous';
  style?:
    | 'formal'
    | 'conversational'
    | 'thought-provoking'
    | 'educational'
    | 'inspirational';
  vocabulary?: 'simple' | 'standard' | 'technical' | 'sophisticated';
  emotion?: 'neutral' | 'friendly' | 'confident' | 'inspiring' | 'empathetic';
}

export interface UpdatePersonaData {
  name?: string;
  description?: string | null;
  status?: 'draft' | 'training' | 'active' | 'archived';
  tone?: string;
  style?: string;
  vocabulary?: string;
  emotion?: string;
}

export interface TrainingStatus {
  status: 'idle' | 'training';
  message?: string;
  persona?: {
    id: string;
    name: string;
    status: string;
    lastTrained?: string | null;
    trainingStats?: {
      sourcesCount: number;
      wordsCount: number;
      samplesCount: number;
      accuracy: number;
    };
  };
}

/** API response shape for GET /api/personas */
interface PersonasListResponse {
  data: Persona[];
}

/** API response shape for POST /api/personas */
interface CreatePersonaResponse {
  data: Persona;
}

/** API response shape for PATCH /api/personas */
interface UpdatePersonaResponse {
  data: Persona;
}

/** API response shape for DELETE /api/personas */
interface DeletePersonaResponse {
  success: boolean;
}

/** API response shape for POST /api/personas/[id]/train */
interface StartTrainingResponse {
  success: boolean;
  message: string;
  personaId: string;
  sourcesCount: number;
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

export function usePersonas() {
  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<PersonasListResponse>('/api/personas', fetchJson, {
    revalidateOnFocus: false,
  });

  // Backward-compatible aliases
  const loading = isLoading;
  const personas = response?.data ?? [];

  /**
   * Create a new persona
   */
  const createPersona = useCallback(
    async (data: CreatePersonaData): Promise<Persona | null> => {
      try {
        const res = await fetch('/api/personas', {
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

        const result: CreatePersonaResponse = await res.json();
        await mutate();
        return result.data;
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [mutate]
  );

  /**
   * Update an existing persona
   */
  const updatePersona = useCallback(
    async (id: string, data: UpdatePersonaData): Promise<Persona | null> => {
      try {
        const res = await fetch('/api/personas', {
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

        const result: UpdatePersonaResponse = await res.json();
        await mutate();
        return result.data;
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [mutate]
  );

  /**
   * Delete a persona
   */
  const deletePersona = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/personas?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
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

        const _result: DeletePersonaResponse = await res.json();
        await mutate();
        return true;
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [mutate]
  );

  /**
   * Start training a persona with provided sources
   */
  const startTraining = useCallback(
    async (id: string, sources: TrainingSource[]): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/personas/${encodeURIComponent(id)}/train`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sources }),
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

        const _result: StartTrainingResponse = await res.json();
        // Refetch to reflect the change (persona status → 'training')
        await mutate();
        return true;
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [mutate]
  );

  /**
   * Get training status for a persona
   */
  const getTrainingStatus = useCallback(
    async (id: string): Promise<TrainingStatus | null> => {
      const res = await fetch(`/api/personas/${encodeURIComponent(id)}/train`, {
        method: 'GET',
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

      return res.json() as Promise<TrainingStatus>;
    },
    []
  );

  /**
   * Refresh the personas list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  /**
   * Clear error state — no-op in SWR (included for backward compatibility)
   */
  const clearError = useCallback(() => {
    // SWR manages error state; call mutate() to retry
  }, []);

  return {
    personas,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    refresh,
    clearError,
    createPersona,
    updatePersona,
    deletePersona,
    startTraining,
    getTrainingStatus,
  };
}
