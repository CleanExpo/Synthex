'use client';

/**
 * Onboarding Step 4: Persona Setup
 *
 * @description Create a brand persona with Synthex branding.
 * Pre-populated from AI analysis if available (suggested persona name, tone, topics).
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Brain } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator, PersonaSetup } from '@/components/onboarding';

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

export default function Step4Page() {
  const router = useRouter();
  const { data, completeStep } = useOnboarding();

  const handleNext = () => {
    completeStep(4);
    router.push('/onboarding/complete');
  };

  const isValid = data.skipPersona || (data.personaName && data.personaTone);

  // Check if persona was pre-populated from AI
  const isAiPrepopulated = data.aiAnalysis !== null && data.personaName && data.personaTone;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={4}
        completedSteps={data.completedSteps}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Brain className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Create your brand persona</h1>
        <p className="text-gray-400">
          {isAiPrepopulated
            ? 'We suggested a persona based on your website — adjust as needed'
            : 'Define your unique voice for AI-generated content'}
        </p>
      </div>

      {/* Persona Setup */}
      <div className="max-w-2xl mx-auto">
        <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm">
          <PersonaSetup />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-2xl mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding/step-3')}
          className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!isValid}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {data.skipPersona ? 'Skip & Continue' : 'Continue'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
