'use client';

/**
 * Onboarding Entry Page
 *
 * @description Welcome page that starts the onboarding flow with Synthex branding
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Zap, Target, Brain } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SynthexLogo } from '@/components/marketing/MarketingLayout';

// ============================================================================
// FEATURES DATA
// ============================================================================

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Content',
    description: 'Generate engaging posts with your unique brand voice',
  },
  {
    icon: Zap,
    title: 'Multi-Platform Publishing',
    description: 'Schedule and publish to all your social channels at once',
  },
  {
    icon: Target,
    title: 'Smart Analytics',
    description: 'Track performance and optimize your content strategy',
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function OnboardingPage() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/onboarding/step-1');
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
      {/* Logo/Brand */}
      <div className="mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mb-6 mx-auto backdrop-blur-sm">
          <SynthexLogo className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">SYNTHEX</span>
        </h1>
        <p className="text-xl text-gray-400 mt-2">
          AI-Powered Social Media Marketing
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
        {FEATURES.map((feature, index) => (
          <div
            key={index}
            className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm hover:border-cyan-500/30 transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
              <feature.icon className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="font-semibold mb-1 text-white">{feature.title}</h3>
            <p className="text-sm text-gray-400">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="space-y-4">
        <Button
          size="lg"
          onClick={handleStart}
          className="gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
        >
          Get Started
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="text-sm text-gray-500">
          Setup takes less than 5 minutes
        </p>
      </div>
    </div>
  );
}
