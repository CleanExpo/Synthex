'use client';

/**
 * StepProgressV2 — Shared step progress indicator for V2 onboarding flow
 *
 * Used by: keys, audit, goals, and socials onboarding pages.
 * Extracted to eliminate copy-paste duplication across 4 files.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export const ONBOARDING_STEPS_V2 = [
  { id: 1, name: 'API Keys' },
  { id: 2, name: 'Website Audit' },
  { id: 3, name: 'Your Goals' },
  { id: 4, name: 'Social Profiles' },
] as const;

export function StepProgressV2({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {ONBOARDING_STEPS_V2.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                step.id < currentStep
                  ? 'bg-cyan-500 text-white'
                  : step.id === currentStep
                  ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                  : 'bg-white/5 border border-white/10 text-gray-500',
              )}
            >
              {step.id < currentStep ? '\u2713' : step.id}
            </div>
            <span
              className={cn(
                'text-xs font-medium hidden sm:block',
                step.id === currentStep ? 'text-cyan-400' : 'text-gray-500',
              )}
            >
              {step.name}
            </span>
          </div>
          {idx < ONBOARDING_STEPS_V2.length - 1 && (
            <div
              className={cn(
                'flex-1 h-px max-w-[40px]',
                step.id < currentStep ? 'bg-cyan-500' : 'bg-white/10',
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
