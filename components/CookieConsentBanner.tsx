'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/hooks/use-cookie-consent';

export function CookieConsentBanner() {
  const { status, isLoading, accept, decline } = useCookieConsent();

  if (isLoading || status !== null) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#1a1612]/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/70">
          We use cookies to improve your experience and analyse site traffic. By
          clicking &ldquo;Accept All&rdquo;, you consent to our use of cookies.{' '}
          <Link
            href="/privacy"
            className="text-orange-400 underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={decline}
            className="border-white/20 text-white/70 hover:border-white/40 hover:text-white"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="bg-orange-700 text-white hover:bg-orange-600"
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
