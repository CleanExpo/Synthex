'use client';

/**
 * Onboarding Entry Page
 *
 * UNI-1150: Simplified to a brief welcome with immediate CTA.
 * No 6-step preview — just get the user started.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from '@/components/icons';
import { Button } from '@/components/ui/button';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 py-8">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
        <Sparkles className="w-10 h-10 text-white" />
      </div>

      <div className="space-y-3 max-w-md">
        <h1 className="text-3xl font-bold text-white">
          Welcome to SYNTHEX
        </h1>
        <p className="text-gray-400 text-lg">
          Let&apos;s set up your workspace in under 2 minutes.
          We just need a few details about your business.
        </p>
      </div>

      <Button
        size="lg"
        onClick={() => router.push('/onboarding/keys')}
        className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all mt-4"
      >
        Get Started
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>

      <p className="text-xs text-gray-500 mt-2">
        4 quick steps &middot; You can always update everything later in Settings
      </p>
    </div>
  );
}
