'use client';

/**
 * Onboarding Step 2: Platform Connections
 *
 * @description Connect social media platforms
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Link2 } from 'lucide-react';
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
  const { data, completeStep, canProceed } = useOnboarding();

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
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Link2 className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Connect your platforms</h1>
        <p className="text-muted-foreground">
          Link your social media accounts to start publishing
        </p>
      </div>

      {/* Platform Connector */}
      <div className="max-w-2xl mx-auto">
        <PlatformConnector />
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-2xl mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding/step-1')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          {!isValid && (
            <Button variant="outline" onClick={handleSkip}>
              Skip for now
            </Button>
          )}
          <Button onClick={handleNext} disabled={!isValid}>
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
