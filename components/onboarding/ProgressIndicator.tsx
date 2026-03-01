'use client';

/**
 * Progress Indicator
 *
 * @description Visual progress indicator for onboarding steps
 */

import React from 'react';
import { Check } from '@/components/icons';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface Step {
  id: number;
  name: string;
  description?: string;
}

interface ProgressIndicatorProps {
  steps: readonly Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
  allowNavigation?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProgressIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  allowNavigation = false,
}: ProgressIndicatorProps) {
  const handleStepClick = (stepId: number) => {
    if (allowNavigation && onStepClick) {
      // Only allow navigation to completed steps or current step
      if (completedSteps.includes(stepId) || stepId <= currentStep) {
        onStepClick(stepId);
      }
    }
  };

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isClickable = allowNavigation && (isCompleted || step.id <= currentStep);

          return (
            <li
              key={step.id}
              className={cn(
                'relative flex-1',
                index !== steps.length - 1 && 'pr-8 sm:pr-12'
              )}
            >
              {/* Connector line */}
              {index !== steps.length - 1 && (
                <div
                  className="absolute top-4 left-0 -right-4 sm:-right-6 h-0.5 w-full"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      'h-full transition-colors duration-200',
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                </div>
              )}

              {/* Step indicator */}
              <button
                type="button"
                onClick={() => handleStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  'relative flex flex-col items-center group',
                  isClickable && 'cursor-pointer',
                  !isClickable && 'cursor-default'
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && !isCompleted && 'border-primary bg-background',
                    !isCurrent && !isCompleted && 'border-muted bg-background',
                    isClickable && 'group-hover:ring-2 group-hover:ring-primary/20'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isCurrent ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {step.id}
                    </span>
                  )}
                </span>

                {/* Step name */}
                <span
                  className={cn(
                    'mt-2 text-xs font-medium text-center transition-colors',
                    isCurrent && 'text-primary',
                    isCompleted && 'text-foreground',
                    !isCurrent && !isCompleted && 'text-muted-foreground'
                  )}
                >
                  {step.name}
                </span>

                {/* Step description (optional, visible on larger screens) */}
                {step.description && (
                  <span className="hidden sm:block mt-1 text-xs text-muted-foreground text-center max-w-[100px]">
                    {step.description}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ProgressIndicator;
