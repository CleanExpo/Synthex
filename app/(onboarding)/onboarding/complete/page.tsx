'use client';

/**
 * Onboarding Complete Page
 *
 * @description Success page after completing onboarding with Synthex branding.
 * Sends expanded payload including website, description, brand colors, social handles,
 * and AI-generated data to the API.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Loader2, Sparkles, XCircle, RefreshCw } from '@/components/icons';
// Alias for PartyPopper (using Sparkles as visual alternative)
const PartyPopper = Sparkles;
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator } from '@/components/onboarding';

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

export default function CompletePage() {
  const router = useRouter();
  const { data, completeStep } = useOnboarding();
  const [saving, setSaving] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Keep a ref to the latest onboarding data so doSave stays stable (no dep on data)
  const dataRef = useRef(data);
  dataRef.current = data;

  const doSave = useCallback(async () => {
    setSaving(true);
    setSaveError(false);
    const d = dataRef.current;

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationName: d.organizationName || d.businessName,
          website: d.websiteUrl || '',
          industry: d.industry,
          teamSize: d.teamSize,
          description: d.description,
          brandColors: d.brandColors,
          socialHandles: d.socialHandles,
          aiGeneratedData: d.aiAnalysis || undefined,
          connectedPlatforms: d.connectedPlatforms,
          personaName: d.personaName,
          personaTone: d.personaTone,
          personaTopics: d.personaTopics,
          skipPersona: d.skipPersona,
        }),
      });

      if (!res.ok) {
        console.error('[Onboarding] Save failed with status:', res.status);
        setSaveError(true);
        setSaving(false);
        return;
      }

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
      console.error('[Onboarding] Failed to save onboarding data:', error);
      setSaveError(true);
      setSaving(false);
    }
  }, []); // stable — reads from dataRef

  useEffect(() => {
    completeStep(5);
    doSave();
  }, [completeStep, doSave]);

  const handleGoToDashboard = (takeTour: boolean = false) => {
    if (takeTour) {
      localStorage.removeItem('hasSeenTour');
      localStorage.setItem('showTourOnDashboard', 'true');
    }
    localStorage.setItem('onboardingComplete', 'true');
    localStorage.setItem('onboardingCompletedAt', new Date().toISOString());
    router.push('/dashboard');
  };

  const d = data;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={5}
        completedSteps={[...data.completedSteps, 5]}
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
        ) : saveError ? (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/20 flex items-center justify-center mx-auto backdrop-blur-sm">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Couldn&apos;t save your setup</h1>
              <p className="text-gray-400 mt-2">
                Something went wrong saving your preferences. Your account was created — please try again.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
              <Button
                onClick={doSave}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => handleGoToDashboard(false)}
                className="border-cyan-500/30 text-gray-300 hover:bg-cyan-500/10 hover:text-white hover:border-cyan-500/50"
              >
                Skip to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              You can update your preferences later in Settings
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30">
              <PartyPopper className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">You&apos;re all set!</h1>
              <p className="text-gray-400 mt-2 text-lg">
                Welcome to <span className="text-cyan-400 font-semibold">SYNTHEX</span>, {d.organizationName || d.businessName}
              </p>
            </div>

            {/* Summary */}
            <div className="max-w-md mx-auto mt-8 p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm text-left space-y-4">
              <h3 className="font-semibold text-center mb-4 text-white">Your Setup Summary</h3>

              {/* Business */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Business</p>
                  <p className="text-sm text-gray-400">
                    {d.organizationName || d.businessName}
                    {d.websiteUrl && (
                      <span className="text-gray-500"> &middot; {d.websiteUrl}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Industry & Details */}
              {d.industry && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Details</p>
                    <p className="text-sm text-gray-400 capitalize">
                      {d.industry} &middot; {d.teamSize}
                      {d.description && (
                        <span className="block text-gray-500 mt-0.5 line-clamp-1">{d.description}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Platforms */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Platforms Connected</p>
                  <p className="text-sm text-gray-400">
                    {d.connectedPlatforms.length > 0
                      ? d.connectedPlatforms.join(', ')
                      : 'None yet — connect later in settings'}
                  </p>
                </div>
              </div>

              {/* Persona */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Brand Persona</p>
                  <p className="text-sm text-gray-400">
                    {d.skipPersona
                      ? 'Skipped — set up later in settings'
                      : `${d.personaName} (${d.personaTone})`}
                  </p>
                </div>
              </div>

              {/* Brand Color */}
              {d.brandColors?.primary && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                    <div
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: d.brandColors.primary }}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-white">Brand Color</p>
                    <p className="text-sm text-gray-400">{d.brandColors.primary}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Button
                size="lg"
                onClick={() => handleGoToDashboard(true)}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Take a Quick Tour
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleGoToDashboard(false)}
                className="border-cyan-500/30 text-gray-300 hover:bg-cyan-500/10 hover:text-white hover:border-cyan-500/50"
              >
                Skip to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              You can always take the tour later from the Help menu
            </p>
          </>
        )}
      </div>
    </div>
  );
}
