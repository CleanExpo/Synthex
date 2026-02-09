'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface UseUserReturn {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to get the current authenticated user
 * Replaces @supabase/auth-helpers-react useUser hook
 */
export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabaseBrowser();
      if (!supabase) {
        setUser(null);
        setSession(null);
        return;
      }

      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user'));
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();

    // Subscribe to auth state changes
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser]);

  return {
    user,
    session,
    isLoading,
    error,
    refetch: fetchUser,
  };
}

// Export as default for backwards compatibility
export default useUser;
