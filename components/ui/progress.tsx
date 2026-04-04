'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const progressVariants = cva(
  'relative w-full overflow-hidden rounded-full transition-all',
  {
    variants: {
      variant: {
        default: 'bg-secondary dark:bg-slate-800',
        // Premium Glassmorphism variants
        glass: 'bg-white/[0.08] backdrop-blur-md',
        'glass-solid': 'bg-slate-800/80 backdrop-blur-md',
        'glass-primary': 'bg-orange-500/20 backdrop-blur-md',
        'glass-secondary': 'bg-orange-500/20 backdrop-blur-md',
        'glass-success': 'bg-emerald-500/20 backdrop-blur-md',
        // Candy track variant
        candy: 'bg-white/[0.06] backdrop-blur-md',
      },
      size: {
        default: 'h-4',
        sm: 'h-2',
        md: 'h-3',
        lg: 'h-5',
        xl: 'h-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const progressIndicatorVariants = cva(
  'h-full w-full flex-1 transition-all shadow-[0_0_12px_rgba(255,107,53,0.3)]',
  {
    variants: {
      variant: {
        default: 'bg-primary dark:bg-orange-600',
        glass: 'bg-white/10',
        'glass-solid': 'bg-slate-500',
        'glass-primary': 'bg-orange-500/70',
        'glass-secondary': 'bg-orange-500/70',
        'glass-success': 'bg-emerald-500/70',
        // Gradient variants
        'gradient-primary': 'bg-gradient-to-r from-orange-500 to-orange-500',
        'gradient-secondary': 'bg-gradient-to-r from-orange-500 to-blue-500',
        'gradient-success': 'bg-gradient-to-r from-emerald-500 to-orange-500',
        'gradient-rainbow':
          'bg-gradient-to-r from-orange-500 via-orange-500 via-orange-500 via-orange-500 to-orange-500',
        // Candy gradient variants
        candy:
          'bg-gradient-to-r from-[#FF6B35] via-[#FFD60A] to-[#34D399] shadow-[0_0_20px_rgba(255,107,53,0.4)]',
      },
      animated: {
        true: 'animate-pulse',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      animated: false,
    },
  }
);

export interface ProgressProps
  extends
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  indicatorVariant?: VariantProps<typeof progressIndicatorVariants>['variant'];
  animated?: boolean;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Custom value text for screen readers (e.g., "75% complete") */
  'aria-valuetext'?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value,
      variant,
      size,
      indicatorVariant,
      animated,
      'aria-label': ariaLabel,
      'aria-valuetext': ariaValueText,
      ...props
    },
    ref
  ) => {
    // Determine indicator variant based on track variant if not explicitly set
    const resolvedIndicatorVariant =
      indicatorVariant ||
      (variant === 'glass-primary'
        ? 'glass-primary'
        : variant === 'glass-secondary'
          ? 'glass-secondary'
          : variant === 'glass-success'
            ? 'glass-success'
            : variant === 'candy'
              ? 'candy'
              : variant === 'glass' || variant === 'glass-solid'
                ? 'glass'
                : 'default');

    return (
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(progressVariants({ variant, size, className }))}
        aria-label={ariaLabel}
        aria-valuetext={
          ariaValueText ||
          (value !== undefined ? `${value}% complete` : undefined)
        }
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            progressIndicatorVariants({
              variant: resolvedIndicatorVariant,
              animated,
            })
          )}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  }
);
Progress.displayName = ProgressPrimitive.Root.displayName;

// Gradient progress component for explicit gradient styling
const GradientProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  Omit<ProgressProps, 'indicatorVariant'> & {
    gradientVariant?: 'primary' | 'secondary' | 'success' | 'rainbow';
  }
>(
  (
    { className, value, size, gradientVariant = 'primary', animated, ...props },
    ref
  ) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(progressVariants({ variant: 'glass', size, className }))}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          progressIndicatorVariants({
            variant: `gradient-${gradientVariant}` as VariantProps<
              typeof progressIndicatorVariants
            >['variant'],
            animated,
          })
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
);
GradientProgress.displayName = 'GradientProgress';

export {
  Progress,
  GradientProgress,
  progressVariants,
  progressIndicatorVariants,
};
