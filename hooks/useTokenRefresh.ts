'use client';

/**
 * Token Refresh Hook
 * Automatically refreshes the JWT token before expiration.
 *
 * This hook runs a background check every 30 minutes and attempts
 * to refresh the token. The server will only issue a new token if
 * the current one is near expiration or recently expired (within 24h).
 *
 * USAGE:
 *   import { useTokenRefresh } from '@/hooks/useTokenRefresh';
 *
 *   // In your root layout or main app component
 *   function App() {
 *     useTokenRefresh();
 *     return <YourApp />;
 *   }
 *
 * BEHAVIOR:
 * - Runs initial check 5 seconds after mount
 * - Subsequent checks every 30 minutes
 * - Redirects to login on 401 (session expired)
 * - Silently fails on network errors (will retry next interval)
 * - Prevents concurrent refresh attempts
 *
 * @module hooks/useTokenRefresh
 */

import { useEffect, useRef } from 'react';

const REFRESH_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const INITIAL_DELAY = 5000; // 5 seconds after mount

export function useTokenRefresh() {
  const refreshing = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function refreshToken() {
      // Prevent concurrent refresh attempts
      if (refreshing.current) {
        return;
      }

      refreshing.current = true;

      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include', // Include httpOnly cookies
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          // If refresh fails with 401, user needs to re-login
          if (res.status === 401) {
            if (mounted.current) {
              // Only redirect if we're still mounted (user hasn't navigated away)
              window.location.href = '/auth/login?reason=session_expired';
            }
          }
          // For other errors (500, 503, etc.), silently fail and retry next interval
        } else {
          // Successfully refreshed - token is now updated in httpOnly cookie
          const data = await res.json();
          if (data.expiresAt) {
            // Optional: Store expiry time in localStorage for client-side checks
            try {
              localStorage.setItem('token-expires-at', data.expiresAt);
            } catch {
              // Ignore localStorage errors (might be disabled)
            }
          }
        }
      } catch (error) {
        // Network error or CORS issue - will retry next interval
        // Don't redirect here as it might be a temporary network issue
        console.warn('[TokenRefresh] Network error during token refresh:', error);
      } finally {
        refreshing.current = false;
      }
    }

    // Initial check after a small delay to avoid racing with initial auth
    const initialTimeout = setTimeout(() => {
      if (mounted.current) {
        refreshToken();
      }
    }, INITIAL_DELAY);

    // Set up periodic check
    const interval = setInterval(() => {
      if (mounted.current) {
        refreshToken();
      }
    }, REFRESH_CHECK_INTERVAL);

    // Cleanup on unmount
    return () => {
      mounted.current = false;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);
}
