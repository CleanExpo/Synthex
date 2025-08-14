'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { handleOAuthCallback } from '@/lib/auth/oauth-handler';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const processCallback = async () => {
      // Get OAuth parameters
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const platform = searchParams.get('platform') || detectPlatformFromState(state);

      if (error) {
        console.error('OAuth error:', error);
        const errorDescription = searchParams.get('error_description');
        
        // Store error in session storage for the login page to display
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('oauth_error', errorDescription || error);
        }
        
        // Redirect to login with error
        router.push('/login?error=oauth_failed');
        return;
      }

      if (!code || !state) {
        console.error('Missing OAuth parameters');
        router.push('/login?error=invalid_callback');
        return;
      }

      if (!platform) {
        console.error('Could not determine OAuth platform');
        router.push('/login?error=unknown_platform');
        return;
      }

      // Process the OAuth callback
      await handleOAuthCallback(platform, code, state);
    };

    processCallback();
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

function detectPlatformFromState(state: string | null): string | null {
  if (!state) return null;
  
  try {
    // Try to decode the state parameter
    const decoded = JSON.parse(atob(state));
    return decoded.platform || null;
  } catch {
    // If state isn't base64 JSON, try to extract platform from URL or referrer
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      if (referrer.includes('google')) return 'google';
      if (referrer.includes('github')) return 'github';
      if (referrer.includes('twitter')) return 'twitter';
      if (referrer.includes('linkedin')) return 'linkedin';
      if (referrer.includes('facebook')) return 'facebook';
    }
    return null;
  }
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