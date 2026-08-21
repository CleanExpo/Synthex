'use client';

/**
 * StepProgressV2 — Shared step progress for onboarding (premium sharp style).
 */

import React from 'react';
import { cn } from '@/lib/utils';

export const ONBOARDING_STEPS_V2 = [
  { id: 1, name: 'Your Website' },
  { id: 2, name: 'Review' },
  { id: 3, name: 'Connect' },
] as const;

export function StepProgressV2({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 justify-center">
      {ONBOARDING_STEPS_V2.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-7 h-7 rounded-sm flex items-center justify-center text-xs font-medium transition-colors border-[0.5px]',
                step.id < currentStep
                  ? 'bg-orange-500 border-orange-500 text-black'
                  : step.id === currentStep
                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                    : 'bg-white/2 border-white/10 text-white/35'
              )}
            >
              {step.id < currentStep ? '\u2713' : step.id}
            </div>
            <span
              className={cn(
                'text-xs font-light tracking-wide hidden sm:block',
                step.id === currentStep ? 'text-orange-400' : 'text-white/35'
              )}
            >
              {step.name}
            </span>
          </div>
          {idx < ONBOARDING_STEPS_V2.length - 1 && (
            <div
              className={cn(
                'flex-1 h-px min-w-[28px] max-w-[72px]',
                step.id < currentStep ? 'bg-orange-500/70' : 'bg-white/10'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
