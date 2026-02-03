'use client';

/**
 * Onboarding Complete Page
 *
 * @description Success page after completing onboarding
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Loader2, PartyPopper } from 'lucide-react';
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
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Setting up your workspace...</h1>
              <p className="text-muted-foreground mt-2">
                This will only take a moment
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mx-auto">
              <PartyPopper className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">You&apos;re all set!</h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Welcome to SYNTHEX, {data.organizationName}
              </p>
            </div>

            {/* Summary */}
            <div className="max-w-md mx-auto mt-8 p-6 bg-muted/50 rounded-xl text-left space-y-4">
              <h3 className="font-semibold text-center mb-4">Your Setup Summary</h3>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Organization</p>
                  <p className="text-sm text-muted-foreground">{data.organizationName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Platforms Connected</p>
                  <p className="text-sm text-muted-foreground">
                    {data.connectedPlatforms.length > 0
                      ? data.connectedPlatforms.join(', ')
                      : 'None yet — connect later in settings'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Brand Persona</p>
                  <p className="text-sm text-muted-foreground">
                    {data.skipPersona
                      ? 'Skipped — set up later in settings'
                      : `${data.personaName} (${data.personaTone})`}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Button variant="outline" size="lg" onClick={handleStartTour}>
                Take a quick tour
              </Button>
              <Button size="lg" onClick={handleGoToDashboard}>
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
