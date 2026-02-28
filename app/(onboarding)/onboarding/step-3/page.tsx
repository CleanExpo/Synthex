'use client';

/**
 * Onboarding Step 3: Brand Persona
 *
 * UNI-1150: Persona setup — fully skippable.
 * Uses existing PersonaSetup component. Users can configure later in Settings.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Sparkles } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator, PersonaSetup } from '@/components/onboarding';

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS = [
  { id: 1, name: 'Your Business' },
  { id: 2, name: 'Platforms' },
  { id: 3, name: 'Persona' },
  { id: 4, name: 'Complete' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step3PersonaPage() {
  const router = useRouter();
  const { data, completeStep, skipPersona } = useOnboarding();

  const handleNext = () => {
    completeStep(3);
    router.push('/onboarding/complete');
  };

  const handleSkip = () => {
    skipPersona();
    completeStep(3);
    router.push('/onboarding/complete');
  };

  const hasPersona = data.personaName && data.personaTone;

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
          <Sparkles className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Create your brand persona</h1>
        <p className="text-gray-400">
          Define how your AI-generated content sounds. This shapes the tone and
          topics for all your posts.
        </p>
      </div>

      {/* Persona Setup */}
      <div className="max-w-2xl mx-auto">
        <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm">
          <PersonaSetup />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-2xl mx-auto pt-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding/step-2')}
          className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex gap-3">
          {!hasPersona && (
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
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
          >
            {hasPersona ? 'Continue' : 'Finish Setup'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
