'use client';

/**
 * Onboarding Entry Page
 *
 * @description Welcome page that starts the onboarding flow
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, Zap, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// FEATURES DATA
// ============================================================================

const FEATURES = [
  {
    icon: Sparkles,
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
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 mx-auto">
          <span className="text-3xl font-bold text-primary-foreground">S</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to <span className="text-primary">SYNTHEX</span>
        </h1>
        <p className="text-xl text-muted-foreground mt-2">
          AI-Powered Social Media Marketing
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
        {FEATURES.map((feature, index) => (
          <div
            key={index}
            className="p-6 rounded-xl border bg-card text-card-foreground"
          >
            <feature.icon className="w-8 h-8 text-primary mb-3 mx-auto" />
            <h3 className="font-semibold mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="space-y-4">
        <Button size="lg" onClick={handleStart} className="gap-2">
          Get Started
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="text-sm text-muted-foreground">
          Setup takes less than 5 minutes
        </p>
      </div>
    </div>
  );
}
