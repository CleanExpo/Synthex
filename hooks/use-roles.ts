/**
 * Roles Hook
 *
 * @description Manages organisation roles state.
 * Provides create, update, remove, grant, and revoke actions.
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

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

export function useRoles() {
  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<RolesListResponse>('/api/roles', fetchJson, {
    revalidateOnFocus: false,
  });

  // Backward-compatible aliases
  const loading = isLoading;
  const roles = response?.data ?? [];
  const availablePermissions = response?.availablePermissions ?? [];

  /**
   * Create a new role
   */
  const create = useCallback(
    async (data: CreateRoleData): Promise<Role | null> => {
      const res = await fetch('/api/roles', {
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

      const result: CreateRoleResponse = await res.json();
      await mutate();
      return result.data;
    },
    [mutate]
  );

  /**
   * Update an existing role
   */
  const update = useCallback(
    async (id: string, data: UpdateRoleData): Promise<void> => {
      const res = await fetch(`/api/roles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
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

      const _result: UpdateRoleResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Remove a role
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`/api/roles/${encodeURIComponent(id)}`, {
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

      const _result: DeleteRoleResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Grant a role to a user
   */
  const grantToUser = useCallback(
    async (roleId: string, userId: string, expiresAt?: Date): Promise<void> => {
      const res = await fetch(
        `/api/roles/${encodeURIComponent(roleId)}/users`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId,
            expiresAt: expiresAt?.toISOString(),
          }),
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

      const _result: RoleUserActionResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Revoke a role from a user
   */
  const revokeFromUser = useCallback(
    async (roleId: string, userId: string): Promise<void> => {
      const res = await fetch(
        `/api/roles/${encodeURIComponent(roleId)}/users?userId=${encodeURIComponent(userId)}`,
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

      const _result: RoleUserActionResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Get users with a specific role
   */
  const getUsersWithRole = useCallback(
    async (roleId: string): Promise<RoleUser[]> => {
      const res = await fetch(
        `/api/roles/${encodeURIComponent(roleId)}/users`,
        {
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

      const result: RoleUsersResponse = await res.json();
      return result.data;
    },
    []
  );

  /**
   * Refresh the roles list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    roles,
    availablePermissions,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    create,
    update,
    remove,
    grantToUser,
    revokeFromUser,
    getUsersWithRole,
    refresh,
  };
}
