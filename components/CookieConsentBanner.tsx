'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/hooks/use-cookie-consent';

export function CookieConsentBanner() {
  const { status, isLoading, accept, decline } = useCookieConsent();

  if (isLoading || status !== null) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      aria-live="polite"
      className="relative z-40 border-t border-white/[0.06] bg-[#1a1612]"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        {/*
         * Deliberately names no brand and uses no first person. This banner is
         * mounted from the root layout, so it renders on RestoreAssist landing
         * pages too — naming Synthex there put two brands in one surface, and
         * "help us" broke the RestoreAssist voice rule that forbids first-person
         * business language. Brand-neutral wording is correct on every surface,
         * so this needs no per-route branching.
         */}
        <p className="max-w-3xl text-sm leading-6 text-white/70">
          Optional analytics cookies help improve this site. Nothing loads
          unless you accept.{' '}
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
            size="lg"
            onClick={decline}
            className="min-h-11 border-white/20 text-white/70 hover:border-white/40 hover:text-white"
          >
            No thanks
          </Button>
          <Button
            size="lg"
            onClick={accept}
            className="min-h-11 bg-orange-700 text-white hover:bg-orange-600"
          >
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
