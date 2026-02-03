'use client';

/**
 * Onboarding Step 3: Persona Setup
 *
 * @description Create a brand persona
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator, PersonaSetup } from '@/components/onboarding';

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

export default function Step3Page() {
  const router = useRouter();
  const { data, completeStep, canProceed } = useOnboarding();

  const handleNext = () => {
    completeStep(3);
    router.push('/onboarding/complete');
  };

  const isValid = data.skipPersona || (data.personaName && data.personaTone);

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
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Create your brand persona</h1>
        <p className="text-muted-foreground">
          Define your unique voice for AI-generated content
        </p>
      </div>

      {/* Persona Setup */}
      <div className="max-w-2xl mx-auto">
        <PersonaSetup />
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-2xl mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding/step-2')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleNext} disabled={!isValid}>
          {data.skipPersona ? 'Skip & Continue' : 'Continue'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
