'use client';

/**
 * Vertical step rail + split shell for premium onboarding layout.
 * Left: journey steps · Right: fields / content
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS_V2 } from './StepProgressV2';

const STEP_BLURBS: Record<number, string> = {
  1: 'Name your business, add a short description, and point us at your site.',
  2: 'Confirm what AI extracted — identity, voice, and audience.',
  3: 'Platform linking ships next. Finish setup and enter Mission Control.',
};

export function OnboardingStepRail({
  currentStep,
  className,
}: {
  currentStep: number;
  className?: string;
}) {
  return (
    <nav aria-label="Onboarding steps" className={cn('space-y-0', className)}>
      <p className="text-xs uppercase tracking-[0.28em] text-white/35 mb-5">
        Setup journey
      </p>
      <ol className="relative space-y-0">
        {ONBOARDING_STEPS_V2.map((step, idx) => {
          const done = step.id < currentStep;
          const active = step.id === currentStep;
          const last = idx === ONBOARDING_STEPS_V2.length - 1;

          return (
            <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[13px] top-8 w-px h-[calc(100%-8px)]',
                    done ? 'bg-orange-500/50' : 'bg-white/10'
                  )}
                />
              )}
              <div
                className={cn(
                  'relative z-[1] w-7 h-7 shrink-0 rounded-sm flex items-center justify-center text-xs font-medium border-[0.5px] transition-colors',
                  done && 'bg-orange-500 border-orange-500 text-black',
                  active &&
                    'bg-orange-500/15 border-orange-500/60 text-orange-400 shadow-[0_0_0_4px_rgba(249,115,22,0.08)]',
                  !done && !active && 'bg-white/2 border-white/10 text-white/35'
                )}
              >
                {done ? '\u2713' : step.id}
              </div>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    'text-sm font-light tracking-wide',
                    active
                      ? 'text-white'
                      : done
                        ? 'text-white/70'
                        : 'text-white/35'
                  )}
                >
                  {step.name}
                </p>
                <p
                  className={cn(
                    'text-xs mt-1 leading-relaxed max-w-[240px]',
                    active ? 'text-white/45' : 'text-white/25'
                  )}
                >
                  {STEP_BLURBS[step.id]}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Wide split: steps left, fields right. Stacks on mobile. */
export function OnboardingSplit({
  currentStep,
  eyebrow,
  title,
  description,
  aside,
  children,
  className,
}: {
  currentStep: number;
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-8 lg:gap-12 xl:gap-16 items-start',
        className
      )}
    >
      <aside className="lg:sticky lg:top-8 space-y-8">
        <OnboardingStepRail currentStep={currentStep} />

        <div className="space-y-3 border-t border-white/6 pt-6">
          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl xl:text-4xl font-extralight tracking-tight text-white leading-[1.15]">
            {title}
          </h1>
          {description && (
            <p className="text-sm sm:text-base text-white/40 leading-relaxed">
              {description}
            </p>
          )}
          {aside}
        </div>
      </aside>

      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
}
