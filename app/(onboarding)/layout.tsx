'use client';

import { useState, useEffect } from 'react';
import { OnboardingProvider } from '@/components/onboarding';
import { SynthexLogo } from '@/components/marketing/MarketingLayout';
import Link from 'next/link';

/**
 * Onboarding Layout
 *
 * @description Wraps all onboarding pages with the onboarding provider and Synthex branding
 */

// Fixed positions used during SSR to avoid hydration mismatch
const FIXED_POSITIONS = Array.from({ length: 15 }, (_, i) => ({
  left: ((i * 17 + 7) % 100),
  top: ((i * 23 + 13) % 100),
  delay: (i * 0.33) % 5,
  duration: 5 + ((i * 0.67) % 10),
}));

// Floating Particles for onboarding
function OnboardingParticles() {
  const [positions, setPositions] = useState(FIXED_POSITIONS);

  useEffect(() => {
    setPositions(
      Array.from({ length: 15 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 10,
      }))
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {positions.map((pos, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/20 rounded-full animate-float"
          style={{
            left: `${pos.left}%`,
            top: `${pos.top}%`,
            animationDelay: `${pos.delay}s`,
            animationDuration: `${pos.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-[#0a1628] text-white overflow-hidden">
        {/* Deep Navy Gradient Background */}
        <div className="fixed inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f172a] to-[#0a1628]" />

        {/* Subtle Grid Pattern */}
        <div
          className="fixed inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Floating Particles */}
        <OnboardingParticles />

        {/* Glow Effects */}
        <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[150px] pointer-events-none" />

        {/* Header with Logo */}
        <header className="relative z-20 border-b border-cyan-500/10 bg-[#0a1628]/80 backdrop-blur-md">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <Link href="/" className="flex items-center space-x-3 w-fit group">
              <SynthexLogo className="w-8 h-8 transition-transform group-hover:scale-110" />
              <span className="text-xl font-bold tracking-tight text-white">
                SYNTHEX
              </span>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
          {children}
        </div>
      </div>
    </OnboardingProvider>
  );
}
