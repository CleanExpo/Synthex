'use client';

/**
 * Onboarding Complete Page
 *
 * @description Success page after completing onboarding with Synthex branding
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Loader2, Sparkles } from '@/components/icons';
// Alias for PartyPopper (using Sparkles as visual alternative)
const PartyPopper = Sparkles;
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator } from '@/components/onboarding';

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

export default function CompletePage() {
  const router = useRouter();
  const { data, completeStep } = useOnboarding();
  const [saving, setSaving] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Mark step 4 as complete
    completeStep(4);

    // Simulate saving to backend
    const saveOnboarding = async () => {
      try {
        // In production, this would be an API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setSaving(false);
        setSaved(true);

        // Trigger confetti (dynamically imported)
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#06b6d4', '#22d3ee', '#0891b2', '#67e8f9'],
          });
        } catch {
          // Confetti not available, continue without it
        }
      } catch (error) {
        console.error('Failed to save onboarding data:', error);
        setSaving(false);
      }
    };

    saveOnboarding();
  }, [completeStep]);

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleStartTour = () => {
    // In production, this would trigger an interactive tour
    router.push('/dashboard?tour=true');
  };

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={4}
        completedSteps={[...data.completedSteps, 4]}
      />

      {/* Content */}
      <div className="text-center space-y-6 py-8">
        {saving ? (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto backdrop-blur-sm">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Setting up your workspace...</h1>
              <p className="text-gray-400 mt-2">
                This will only take a moment
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30">
              <PartyPopper className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">You&apos;re all set!</h1>
              <p className="text-gray-400 mt-2 text-lg">
                Welcome to <span className="text-cyan-400 font-semibold">SYNTHEX</span>, {data.organizationName}
              </p>
            </div>

            {/* Summary */}
            <div className="max-w-md mx-auto mt-8 p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm text-left space-y-4">
              <h3 className="font-semibold text-center mb-4 text-white">Your Setup Summary</h3>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Organization</p>
                  <p className="text-sm text-gray-400">{data.organizationName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Platforms Connected</p>
                  <p className="text-sm text-gray-400">
                    {data.connectedPlatforms.length > 0
                      ? data.connectedPlatforms.join(', ')
                      : 'None yet — connect later in settings'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Brand Persona</p>
                  <p className="text-sm text-gray-400">
                    {data.skipPersona
                      ? 'Skipped — set up later in settings'
                      : `${data.personaName} (${data.personaTone})`}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={handleStartTour}
                className="border-cyan-500/30 text-gray-300 hover:bg-cyan-500/10 hover:text-white hover:border-cyan-500/50"
              >
                Take a quick tour
              </Button>
              <Button
                size="lg"
                onClick={handleGoToDashboard}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
