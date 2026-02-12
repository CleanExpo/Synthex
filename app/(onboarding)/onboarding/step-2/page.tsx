'use client';

/**
 * Onboarding Step 2: Platform Connections
 *
 * @description Connect social media platforms with Synthex branding
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Link2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator, PlatformConnector } from '@/components/onboarding';

// ============================================================================
// DATA
// ============================================================================

const STEPS = [
  { id: 1, name: 'Organization' },
  { id: 2, name: 'Platforms' },
  { id: 3, name: 'Persona' },
  { id: 4, name: 'Complete' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step2Page() {
  const router = useRouter();
  const { data, completeStep } = useOnboarding();

  const handleNext = () => {
    completeStep(2);
    router.push('/onboarding/step-3');
  };

  const handleSkip = () => {
    // Allow skipping but warn user
    router.push('/onboarding/step-3');
  };

  const isValid = data.connectedPlatforms.length > 0;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={2}
        completedSteps={data.completedSteps}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Link2 className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Connect your platforms</h1>
        <p className="text-gray-400">
          Link your social media accounts to start publishing
        </p>
      </div>

      {/* Platform Connector */}
      <div className="max-w-2xl mx-auto">
        <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm">
          <PlatformConnector />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-2xl mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding/step-1')}
          className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          {!isValid && (
            <Button
              variant="outline"
              onClick={handleSkip}
              className="border-cyan-500/30 text-gray-300 hover:bg-cyan-500/10 hover:text-white hover:border-cyan-500/50"
            >
              Skip for now
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!isValid}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
