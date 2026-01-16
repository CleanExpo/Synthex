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
        default: 'bg-secondary',
        // Premium Glassmorphism variants
        glass: 'bg-white/[0.08] backdrop-blur-md',
        'glass-solid': 'bg-slate-800/80 backdrop-blur-md',
        'glass-primary': 'bg-violet-500/20 backdrop-blur-md',
        'glass-secondary': 'bg-cyan-500/20 backdrop-blur-md',
        'glass-success': 'bg-emerald-500/20 backdrop-blur-md',
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

const progressIndicatorVariants = cva('h-full w-full flex-1 transition-all', {
  variants: {
    variant: {
      default: 'bg-primary',
      glass: 'bg-white/40',
      'glass-solid': 'bg-slate-500',
      'glass-primary': 'bg-violet-500/70',
      'glass-secondary': 'bg-cyan-500/70',
      'glass-success': 'bg-emerald-500/70',
      // Gradient variants
      'gradient-primary': 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
      'gradient-secondary': 'bg-gradient-to-r from-cyan-500 to-blue-500',
      'gradient-success': 'bg-gradient-to-r from-emerald-500 to-teal-500',
      'gradient-rainbow':
        'bg-gradient-to-r from-violet-500 via-fuchsia-500 via-pink-500 via-orange-500 to-amber-500',
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
});

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  indicatorVariant?: VariantProps<typeof progressIndicatorVariants>['variant'];
  animated?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant, size, indicatorVariant, animated, ...props }, ref) => {
  // Determine indicator variant based on track variant if not explicitly set
  const resolvedIndicatorVariant =
    indicatorVariant ||
    (variant === 'glass-primary'
      ? 'glass-primary'
      : variant === 'glass-secondary'
      ? 'glass-secondary'
      : variant === 'glass-success'
      ? 'glass-success'
      : variant === 'glass' || variant === 'glass-solid'
      ? 'glass'
      : 'default');

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(progressVariants({ variant, size, className }))}
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
});
Progress.displayName = ProgressPrimitive.Root.displayName;

// Gradient progress component for explicit gradient styling
const GradientProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  Omit<ProgressProps, 'indicatorVariant'> & {
    gradientVariant?: 'primary' | 'secondary' | 'success' | 'rainbow';
  }
>(({ className, value, size, gradientVariant = 'primary', animated, ...props }, ref) => (
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
));
GradientProgress.displayName = 'GradientProgress';

export {
  Progress,
  GradientProgress,
  progressVariants,
  progressIndicatorVariants,
};
