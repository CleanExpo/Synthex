'use client';

/**
 * Onboarding Step 2: Review AI-Generated Details
 *
 * @description Shows AI-analyzed business details for review/edit, or falls back
 * to manual entry if no website was provided or analysis failed.
 * Triggers analysis on mount if URL was provided but analysis hasn't run yet.
 */

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Sparkles, FileText } from '@/components/icons';
// Alias for ClipboardCheck (using FileText as visual alternative)
const ClipboardCheck = FileText;
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator } from '@/components/onboarding';
import { BusinessDetailsReview } from '@/components/onboarding/BusinessDetailsReview';
import type { ReviewedDetails } from '@/components/onboarding/BusinessDetailsReview';

// ============================================================================
// DATA
// ============================================================================

const STEPS = [
  { id: 1, name: 'Business Identity' },
  { id: 2, name: 'Vetting' },
  { id: 3, name: 'API Setup' },
  { id: 4, name: 'Review Details' },
  { id: 5, name: 'Platforms' },
  { id: 6, name: 'Persona' },
  { id: 7, name: 'Complete' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step2Page() {
  const router = useRouter();
  const { data, setReviewedDetails, triggerAnalysis, completeStep } = useOnboarding();

  // Trigger analysis if URL provided but not yet analyzed
  useEffect(() => {
    if (
      data.websiteUrl &&
      data.analysisStatus === 'idle' &&
      !data.aiAnalysis
    ) {
      triggerAnalysis();
    }
  }, [data.websiteUrl, data.analysisStatus, data.aiAnalysis, triggerAnalysis]);

  const isAiGenerated = data.analysisStatus === 'success' && data.aiAnalysis !== null;
  const isAnalyzing = data.analysisStatus === 'loading';

  // Build current details from context state
  const currentDetails: ReviewedDetails = {
    industry: data.industry,
    teamSize: data.teamSize,
    description: data.description,
    brandColors: data.brandColors,
    socialHandles: data.socialHandles,
  };

  const handleDetailsChange = useCallback((details: ReviewedDetails) => {
    setReviewedDetails(details);
  }, [setReviewedDetails]);

  const handleNext = () => {
    completeStep(4);
    router.push('/onboarding/step-3');
  };

  const isValid = Boolean(data.industry && data.teamSize);

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
          {isAiGenerated ? (
            <Sparkles className="w-7 h-7 text-cyan-400" />
          ) : (
            <ClipboardCheck className="w-7 h-7 text-cyan-400" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">
          {isAiGenerated ? 'Review your business details' : 'Enter your business details'}
        </h1>
        <p className="text-gray-400">
          {isAiGenerated
            ? 'We analyzed your website — review and confirm each field'
            : 'Tell us about your business to personalize your experience'}
        </p>
      </div>

      {/* Analyzing State */}
      {isAnalyzing && (
        <div className="max-w-md mx-auto">
          <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-white">Analyzing your website...</p>
                <p className="text-sm text-gray-400 mt-1">
                  This usually takes 10-15 seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review/Edit Form */}
      {!isAnalyzing && (
        <div className="max-w-md mx-auto">
          <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm">
            <BusinessDetailsReview
              details={currentDetails}
              isAiGenerated={isAiGenerated}
              confidence={data.aiAnalysis?.confidence}
              onChange={handleDetailsChange}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      {!isAnalyzing && (
        <div className="flex justify-between max-w-md mx-auto pt-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/onboarding/step-1')}
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
            {isAiGenerated ? 'Confirm & Continue' : 'Continue'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
