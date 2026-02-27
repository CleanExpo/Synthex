'use client';

/**
 * Onboarding Entry Page
 *
 * @description Welcome page that starts the onboarding flow with Synthex branding.
 * Shows a visual step preview so users know what to expect, including the
 * platform-connection requirement (UNI-645).
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Zap,
  Target,
  Brain,
  Building,
  Shield,
  Key,
  FileText,
  Link2,
  Info,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SynthexLogo } from '@/components/marketing/MarketingLayout';

// ============================================================================
// FEATURES DATA
// ============================================================================

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Setup',
    description: 'Enter your website and let AI build your business profile',
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
// STEPS PREVIEW DATA
// ============================================================================

const ONBOARDING_STEPS = [
  {
    number: 1,
    label: 'Business Identity',
    description: 'Enter your business name and website',
    icon: Building,
  },
  {
    number: 2,
    label: 'Health Checkup',
    description: 'AI analyzes your online presence',
    icon: Shield,
  },
  {
    number: 3,
    label: 'API Setup',
    description: 'Connect your AI provider keys',
    icon: Key,
  },
  {
    number: 4,
    label: 'Review Details',
    description: 'Confirm your business profile',
    icon: FileText,
  },
  {
    number: 5,
    label: 'Connect Platforms',
    description: 'Link your social media accounts',
    icon: Link2,
  },
  {
    number: 6,
    label: 'Brand Persona',
    description: 'Define your content voice and tone',
    icon: Brain,
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

      {/* Step Preview */}
      <div className="w-full max-w-3xl mx-auto mb-10">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-5">
          6 steps to get started
        </p>

        {/* Desktop: horizontal layout */}
        <div className="hidden sm:grid sm:grid-cols-6 gap-3">
          {ONBOARDING_STEPS.map((step) => (
            <div key={step.number} className="flex flex-col items-center gap-2 text-center group">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40 transition-all">
                <step.icon className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white leading-tight">{step.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight hidden lg:block">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: vertical layout */}
        <div className="sm:hidden space-y-3 max-w-xs mx-auto">
          {ONBOARDING_STEPS.map((step) => (
            <div key={step.number} className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <step.icon className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">
                  <span className="text-cyan-500 mr-1.5">{step.number}.</span>
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preparation Note */}
      <div className="w-full max-w-lg mx-auto mb-10">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/15 text-left">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300 leading-relaxed">
            You will connect at least one social media account during setup.
            <span className="text-gray-400"> Have your login details ready for platforms like Instagram, YouTube, or LinkedIn.</span>
          </p>
        </div>
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
