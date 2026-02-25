'use client';

/**
 * Onboarding Step 3: Platform Connections
 *
 * @description Connect social media platforms with Synthex branding.
 * If AI detected social handles, shows them as hints on matching platform cards.
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
  { id: 1, name: 'Business Identity' },
  { id: 2, name: 'Review Details' },
  { id: 3, name: 'Platforms' },
  { id: 4, name: 'Persona' },
  { id: 5, name: 'Complete' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step3Page() {
  const router = useRouter();
  const { data, completeStep } = useOnboarding();

  const handleNext = () => {
    completeStep(3);
    router.push('/onboarding/step-4');
  };

  const handleSkip = () => {
    // Allow skipping but warn user
    router.push('/onboarding/step-4');
  };

  const isValid = data.connectedPlatforms.length > 0;

  // Show detected social handles as a hint
  const detectedHandles = Object.entries(data.socialHandles || {});

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={3}
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

      {/* Detected Social Handles Hint */}
      {detectedHandles.length > 0 && (
        <div className="max-w-2xl mx-auto">
          <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
            <p className="text-xs text-cyan-300 font-medium mb-2">
              We detected these social accounts from your website:
            </p>
            <div className="flex flex-wrap gap-2">
              {detectedHandles.map(([platform, handle]) => (
                <span
                  key={platform}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-xs"
                >
                  <span className="text-cyan-400 capitalize">{platform}</span>
                  <span className="text-gray-400">{handle}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

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
          onClick={() => router.push('/onboarding/step-2')}
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
