'use client';

/**
 * Onboarding Step 6: API Credentials Setup
 *
 * @description Form for users to enter their API keys for OpenAI, Anthropic, Google, and
 * OpenRouter. This is mandatory as users pay for their own AI usage. Keys are validated
 * and encrypted before being stored.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator, APIKeySetup } from '@/components/onboarding';

// ============================================================================
// DATA
// ============================================================================

const STEPS = [
  { id: 1, name: 'Business Identity' },
  { id: 2, name: 'Review Details' },
  { id: 3, name: 'Platforms' },
  { id: 4, name: 'Persona' },
  { id: 5, name: 'Vetting' },
  { id: 6, name: 'API Setup' },
  { id: 7, name: 'Complete' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step6APISetupPage() {
  const router = useRouter();
  const { data, completeStep } = useOnboarding();
  const [apiCredentials, setApiCredentials] = useState<Record<string, string> | null>(null);

  const handleAPIsComplete = (credentials: Record<string, string>) => {
    setApiCredentials(credentials);
    completeStep(6);

    // Small delay to allow state to update, then navigate to Review Details
    setTimeout(() => {
      router.push('/onboarding/step-2');
    }, 300);
  };

  const hasCredentials = data.apiCredentials && Object.keys(data.apiCredentials).length > 0;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={6}
        completedSteps={data.completedSteps}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Key className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Connect Your AI Providers</h1>
        <p className="text-gray-400">
          Enter your API keys to enable AI-powered features across SYNTHEX
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto">
        <div className="p-8 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm">
          <APIKeySetup minProviders={1} onComplete={handleAPIsComplete} />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-2xl mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding/step-5')}
          className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        {/* Next button only appears after credentials are configured */}
        {hasCredentials && (
          <Button
            onClick={() => {
              completeStep(6);
              router.push('/onboarding/step-2');
            }}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
