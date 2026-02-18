/**
 * Personas Hook
 *
 * @description Manages persona state and operations (CRUD + training).
 * Provides create, update, delete, startTraining, and getTrainingStatus actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-approvals.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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
  style?: 'formal' | 'conversational' | 'thought-provoking' | 'educational' | 'inspirational';
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
// HELPERS
// ============================================================================

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token')
  );
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all personas from API
   */
  const fetchPersonas = useCallback(async () => {
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
      const response = await fetch('/api/personas', {
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PersonasListResponse = await response.json();

      if (mountedRef.current) {
        setPersonas(data.data);
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
   * Create a new persona
   */
  const createPersona = useCallback(
    async (data: CreatePersonaData): Promise<Persona | null> => {
      try {
        const response = await fetch('/api/personas', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const result: CreatePersonaResponse = await response.json();

        // Refetch to reflect the change
        if (mountedRef.current) {
          await fetchPersonas();
        }

        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [fetchPersonas]
  );

  /**
   * Update an existing persona
   */
  const updatePersona = useCallback(
    async (id: string, data: UpdatePersonaData): Promise<Persona | null> => {
      try {
        const response = await fetch('/api/personas', {
          method: 'PATCH',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({ id, ...data }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const result: UpdatePersonaResponse = await response.json();

        // Refetch to reflect the change
        if (mountedRef.current) {
          await fetchPersonas();
        }

        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [fetchPersonas]
  );

  /**
   * Delete a persona
   */
  const deletePersona = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/personas?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const _result: DeletePersonaResponse = await response.json();

        // Refetch to reflect the change
        if (mountedRef.current) {
          await fetchPersonas();
        }

        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return false;
      }
    },
    [fetchPersonas]
  );

  /**
   * Start training a persona with provided sources
   */
  const startTraining = useCallback(
    async (id: string, sources: TrainingSource[]): Promise<boolean> => {
      try {
        const response = await fetch(`/api/personas/${encodeURIComponent(id)}/train`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({ sources }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const _result: StartTrainingResponse = await response.json();

        // Refetch to reflect the change (persona status → 'training')
        if (mountedRef.current) {
          await fetchPersonas();
        }

        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return false;
      }
    },
    [fetchPersonas]
  );

  /**
   * Get training status for a persona
   */
  const getTrainingStatus = useCallback(async (id: string): Promise<TrainingStatus | null> => {
    try {
      const response = await fetch(`/api/personas/${encodeURIComponent(id)}/train`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const result: TrainingStatus = await response.json();
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    }
  }, []);

  /**
   * Refresh the personas list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchPersonas();
  }, [fetchPersonas]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchPersonas();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPersonas]);

  return {
    personas,
    loading,
    error,
    refresh,
    clearError,
    createPersona,
    updatePersona,
    deletePersona,
    startTraining,
    getTrainingStatus,
  };
}
