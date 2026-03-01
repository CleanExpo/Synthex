'use client';

/**
 * Onboarding Complete Page
 *
 * @description Success page after completing onboarding with Synthex branding.
 * Sends expanded payload including website, description, brand colors, social handles,
 * and AI-generated data to the API.
 *
 * UNI-631: Shows inline error state on failure with automatic retry (exponential
 * backoff, 2 retries) instead of silently redirecting to dashboard.
 * Only redirects on confirmed success (200 response).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Loader2, Sparkles, XCircle, RefreshCw } from '@/components/icons';
// Alias for PartyPopper (using Sparkles as visual alternative)
const PartyPopper = Sparkles;
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator, ONBOARDING_STEPS } from '@/components/onboarding';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of automatic retry attempts before showing error to user */
const MAX_AUTO_RETRIES = 2;

/** Base delay in ms for exponential backoff (doubles each retry) */
const BASE_RETRY_DELAY_MS = 1000;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Wait for a given number of milliseconds.
 * Returns a promise that resolves after the delay.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CompletePage() {
  const router = useRouter();
  const { data, completeStep } = useOnboarding();
  const [saving, setSaving] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Keep a ref to the latest onboarding data so doSave stays stable (no dep on data)
  const dataRef = useRef(data);
  dataRef.current = data;

  // Track whether the component is still mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * UNI-631: Save onboarding data with automatic retry and exponential backoff.
   *
   * On initial call (isManualRetry = false), the function will automatically
   * retry up to MAX_AUTO_RETRIES times with exponential backoff before
   * showing the error state. Manual retries (from the "Try Again" button)
   * also get the full retry allowance.
   */
  const doSave = useCallback(async (isManualRetry = false) => {
    if (!mountedRef.current) return;

    setSaving(true);
    setSaveError(false);
    if (isManualRetry) {
      setRetryCount(0);
    }

    const d = dataRef.current;
    let attempt = 0;
    const maxAttempts = MAX_AUTO_RETRIES + 1; // initial + retries

    while (attempt < maxAttempts) {
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

        if (res.ok) {
          // Success — confirmed 200 response
          if (!mountedRef.current) return;
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
          return; // Exit — save succeeded
        }

        // Non-ok response — log and potentially retry
        console.error('[Onboarding] Save failed with status:', res.status);
        attempt++;
        if (mountedRef.current) {
          setRetryCount(attempt);
        }

        if (attempt < maxAttempts) {
          // Exponential backoff: 1s, 2s
          const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await delay(backoffMs);
          if (!mountedRef.current) return;
        }
      } catch (error) {
        // Network error — log and potentially retry
        console.error('[Onboarding] Failed to save onboarding data:', error);
        attempt++;
        if (mountedRef.current) {
          setRetryCount(attempt);
        }

        if (attempt < maxAttempts) {
          const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await delay(backoffMs);
          if (!mountedRef.current) return;
        }
      }
    }

    // All attempts exhausted — show error state (do NOT redirect)
    if (mountedRef.current) {
      setSaveError(true);
      setSaving(false);
    }
  }, []); // stable — reads from dataRef

  useEffect(() => {
    completeStep(4);
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
        steps={ONBOARDING_STEPS}
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
                {retryCount > 0
                  ? `Retrying... (attempt ${retryCount + 1} of ${MAX_AUTO_RETRIES + 1})`
                  : 'This will only take a moment'}
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
                onClick={() => doSave(true)}
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
