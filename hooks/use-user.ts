'use client';

import { useEffect, useState, useCallback } from 'react';

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
}

interface UseUserReturn {
  user: AppUser | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to get the current authenticated user
 * Uses the custom JWT auth API instead of Supabase Auth
 */
export function useUser(): UseUserReturn {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - this is a valid state
          setUser(null);
          return;
        }
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user'));
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser,
  };
}

// Export as default for backwards compatibility
export default useUser;
