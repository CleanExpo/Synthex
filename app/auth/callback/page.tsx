'use client';

/**
 * OAuth Callback Page
 *
 * This page is a pass-through for OAuth flows. The actual OAuth callback
 * is handled server-side by /api/auth/oauth/google/callback which:
 * 1. Exchanges the authorization code for tokens
 * 2. Creates/updates the user
 * 3. Sets auth cookies
 * 4. Redirects to /dashboard
 *
 * This client-side page exists as a fallback for:
 * - Supabase OAuth redirects (legacy flow)
 * - Any direct navigations to /auth/callback
 *
 * It checks for auth-token cookie presence and redirects accordingly.
 */

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Loader2 } from '@/components/icons';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleCallback = () => {
      // Check for errors from OAuth provider
      const error = searchParams.get('error');
      if (error) {
        const errorDescription = searchParams.get('error_description');
        console.error('[OAuth Callback] Error:', error, errorDescription);
        router.replace(`/login?error=${encodeURIComponent(errorDescription || error)}`);
        return;
      }

      // The real OAuth callback is handled by the API route at
      // /api/auth/oauth/google/callback which sets httpOnly cookies and
      // redirects to /dashboard. This page is only hit by:
      // 1. Legacy Supabase OAuth redirects
      // 2. Direct navigations
      //
      // NOTE: auth-token is httpOnly so document.cookie can't see it.
      // Use user-info cookie (non-httpOnly) as the client-visible indicator.
      const hasUserInfo = document.cookie.includes('user-info');

      if (hasUserInfo) {
        // Cookies already set by API callback — redirect to dashboard
        router.replace('/dashboard');
      } else {
        // Check for success indicator in URL (API callback adds ?auth=success)
        const authSuccess = searchParams.get('auth');
        if (authSuccess === 'success') {
          router.replace('/dashboard');
        } else {
          // No auth and no error — this was likely a stale navigation
          // Wait a moment in case cookies are still being set, then redirect
          setTimeout(() => {
            const hasUserInfoNow = document.cookie.includes('user-info');
            if (hasUserInfoNow) {
              router.replace('/dashboard');
            } else {
              router.replace('/login');
            }
          }, 2000);
        }
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900">
      <Card className="liquid-glass p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
          <h2 className="text-2xl font-semibold text-white">Completing Sign In...</h2>
          <p className="text-gray-400 text-center">
            Please wait while we complete your authentication.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900">
        <Card className="liquid-glass p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
            <h2 className="text-2xl font-semibold text-white">Loading...</h2>
          </div>
        </Card>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
