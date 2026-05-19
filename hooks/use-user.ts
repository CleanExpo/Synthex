'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

// Custom user type matching the API response
export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastLogin: string;
  preferences: Record<string, unknown>;
  organizationId: string | null;
  organization: unknown | null;
  // Multi-business owner fields
  isMultiBusinessOwner: boolean;
  activeOrganizationId: string | null;
  ownedBusinessCount?: number;
  // SYN-525/526/527: First Win + conversion copy variant
  first_win_detected?: boolean;
  first_win_detected_at?: string | null;
  conversion_copy_variant?: 'win' | 'control' | null;
}

interface ApiUserResponse {
  success: boolean;
  user: AppUser;
}

interface UseUserOptions {
  /** If true, redirect to /login when the API returns 401 (session expired). Default: false. */
  redirectOnUnauth?: boolean;
  /** If false, skip fetching the current user. Useful for static review routes. */
  enabled?: boolean;
}

interface UseUserReturn {
  user: AppUser | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

async function fetchUser(url: string): Promise<ApiUserResponse> {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (res.status === 401) {
    // Throw a special error so the hook can detect it
    const err = new Error('Unauthorised');
    (err as Error & { status: number }).status = 401;
    throw err;
  }

  if (!res.ok) {
    throw new Error('Failed to fetch user');
  }

  return res.json() as Promise<ApiUserResponse>;
}

/**
 * Custom hook to get the current authenticated user.
 * Uses SWR + the custom JWT auth API.
 *
 * @param options.redirectOnUnauth If true, redirect to login on 401 (use in dashboard pages)
 */
export function useUser({
  redirectOnUnauth = false,
  enabled = true,
}: UseUserOptions = {}): UseUserReturn {
  const routeAllowsUserFetch =
    typeof window === 'undefined' ||
    !window.location.pathname.startsWith('/dashboard/marketing-agency');
  const shouldFetch = enabled && routeAllowsUserFetch;

  const { data, error, isLoading, mutate } = useSWR<ApiUserResponse>(
    shouldFetch ? '/api/auth/user' : null,
    fetchUser,
    {
      revalidateOnFocus: false,
      onError(err) {
        if (
          redirectOnUnauth &&
          typeof window !== 'undefined' &&
          (err as Error & { status?: number }).status === 401
        ) {
          window.location.href = '/login?reason=session_expired';
        }
      },
    }
  );

  const user = data?.success && data?.user ? data.user : null;

  // Treat 401 as "no user", not a hard error
  const resolvedError =
    error && (error as Error & { status?: number }).status !== 401
      ? error instanceof Error
        ? error
        : new Error(String(error))
      : null;

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    user,
    isLoading,
    error: resolvedError,
    refetch,
  };
}

// Export as default for backwards compatibility
export default useUser;
