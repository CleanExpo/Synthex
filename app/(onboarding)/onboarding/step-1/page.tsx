'use client';

/**
 * Onboarding Step 1: Business Identity
 *
 * @description Collects Business Name (required) and Website URL (optional).
 * If URL provided, triggers AI website analysis before advancing to step 2.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Building } from '@/components/icons';
const Building2 = Building;
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboarding, ProgressIndicator } from '@/components/onboarding';
import { WebsiteAnalyzer } from '@/components/onboarding/WebsiteAnalyzer';

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

export default function Step1Page() {
  const router = useRouter();
  const { data, setBusinessIdentity, triggerAnalysis, completeStep } = useOnboarding();

  const [name, setName] = useState(data.businessName || data.organizationName);
  const [websiteUrl, setWebsiteUrl] = useState(data.websiteUrl);

  const handleNext = async () => {
    // Save business identity to context
    setBusinessIdentity(name, websiteUrl);
    completeStep(1);

    // Navigate to vetting (step-5) for health checks
    router.push('/onboarding/step-5');
  };

  const isValid = name.trim().length > 0;
  const isLoading = data.analysisStatus === 'loading';

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={1}
        completedSteps={data.completedSteps}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Building2 className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Tell us about your business</h1>
        <p className="text-gray-400">
          Enter your details and we&apos;ll use AI to set up your profile
        </p>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto space-y-6">
        {/* Form Card */}
        <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm space-y-6">
          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="business-name" className="text-gray-300">
              Business Name
            </Label>
            <Input
              id="business-name"
              placeholder="Enter your business or brand name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className="bg-[#0a1628]/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 disabled:opacity-50"
            />
          </div>

          {/* Website URL (with analyzer) */}
          <WebsiteAnalyzer
            url={websiteUrl}
            onUrlChange={setWebsiteUrl}
            status={data.analysisStatus}
            error={data.analysisError}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-md mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding')}
          className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!isValid || isLoading}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
