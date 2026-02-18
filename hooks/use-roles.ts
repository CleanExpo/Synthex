/**
 * Roles Hook
 *
 * @description Manages organization roles state.
 * Provides create, update, remove, grant, and revoke actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-webhooks.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isDefault: boolean;
  isSystem: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
}

export type Permission = string;

export interface CreateRoleData {
  name: string;
  permissions: string[];
  description?: string;
  isDefault?: boolean;
}

export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  permissions?: string[];
  isDefault?: boolean;
}

export interface RoleUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  grantedAt: string;
  expiresAt: string | null;
}

/** API response shape for GET /api/roles */
interface RolesListResponse {
  success: boolean;
  data: Role[];
  availablePermissions: string[];
}

/** API response shape for POST /api/roles */
interface CreateRoleResponse {
  success: boolean;
  message: string;
  data: Role;
}

/** API response shape for PATCH /api/roles/[id] */
interface UpdateRoleResponse {
  success: boolean;
  message: string;
  data: Role;
}

/** API response shape for DELETE /api/roles/[id] */
interface DeleteRoleResponse {
  success: boolean;
  message: string;
}

/** API response shape for GET /api/roles/[id]/users */
interface RoleUsersResponse {
  success: boolean;
  data: RoleUser[];
}

/** API response shape for POST/DELETE /api/roles/[id]/users */
interface RoleUserActionResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all roles from API
   */
  const fetchRoles = useCallback(async () => {
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
      const response = await fetch('/api/roles', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RolesListResponse = await response.json();

      if (mountedRef.current) {
        setRoles(data.data);
        setAvailablePermissions(data.availablePermissions);
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
   * Create a new role
   */
  const create = useCallback(
    async (data: CreateRoleData): Promise<Role | null> => {
      try {
        const response = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result: CreateRoleResponse = await response.json();

        // Refetch all roles to reflect the change
        if (mountedRef.current) {
          await fetchRoles();
        }

        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [fetchRoles]
  );

  /**
   * Update an existing role
   */
  const update = useCallback(
    async (id: string, data: UpdateRoleData): Promise<void> => {
      try {
        const response = await fetch(`/api/roles/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: UpdateRoleResponse = await response.json();

        // Refetch all roles to reflect the change
        if (mountedRef.current) {
          await fetchRoles();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
    [fetchRoles]
  );

  /**
   * Remove a role
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        const response = await fetch(`/api/roles/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: DeleteRoleResponse = await response.json();

        // Refetch all roles to reflect the change
        if (mountedRef.current) {
          await fetchRoles();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
    [fetchRoles]
  );

  /**
   * Grant a role to a user
   */
  const grantToUser = useCallback(
    async (roleId: string, userId: string, expiresAt?: Date): Promise<void> => {
      try {
        const response = await fetch(`/api/roles/${encodeURIComponent(roleId)}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId,
            expiresAt: expiresAt?.toISOString(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: RoleUserActionResponse = await response.json();

        // Refetch all roles to update user counts
        if (mountedRef.current) {
          await fetchRoles();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
    [fetchRoles]
  );

  /**
   * Revoke a role from a user
   */
  const revokeFromUser = useCallback(
    async (roleId: string, userId: string): Promise<void> => {
      try {
        const response = await fetch(
          `/api/roles/${encodeURIComponent(roleId)}/users?userId=${encodeURIComponent(userId)}`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: RoleUserActionResponse = await response.json();

        // Refetch all roles to update user counts
        if (mountedRef.current) {
          await fetchRoles();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
    [fetchRoles]
  );

  /**
   * Get users with a specific role
   */
  const getUsersWithRole = useCallback(
    async (roleId: string): Promise<RoleUser[]> => {
      try {
        const response = await fetch(`/api/roles/${encodeURIComponent(roleId)}/users`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result: RoleUsersResponse = await response.json();
        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
    []
  );

  /**
   * Refresh the roles list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchRoles();
  }, [fetchRoles]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchRoles();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRoles]);

  return {
    roles,
    availablePermissions,
    loading,
    error,
    create,
    update,
    remove,
    grantToUser,
    revokeFromUser,
    getUsersWithRole,
    refresh,
  };
}
