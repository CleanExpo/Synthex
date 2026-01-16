'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const sliderTrackVariants = cva(
  'relative w-full grow overflow-hidden rounded-full transition-all',
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
        default: 'h-2',
        sm: 'h-1.5',
        lg: 'h-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const sliderRangeVariants = cva('absolute h-full transition-all', {
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
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const sliderThumbVariants = cva(
  'block rounded-full ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-2 border-primary bg-background',
        // Premium Glassmorphism variants
        glass:
          'border-2 border-white/30 bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]',
        'glass-solid': 'border-2 border-white/20 bg-white shadow-lg',
        'glass-primary':
          'border-2 border-violet-500/50 bg-white shadow-[0_0_10px_rgba(139,92,246,0.4)]',
        'glass-secondary':
          'border-2 border-cyan-500/50 bg-white shadow-[0_0_10px_rgba(6,182,212,0.4)]',
        'glass-success':
          'border-2 border-emerald-500/50 bg-white shadow-[0_0_10px_rgba(16,185,129,0.4)]',
        // Gradient variants
        'gradient-primary':
          'border-0 bg-gradient-to-br from-violet-400 to-fuchsia-400 shadow-[0_0_12px_rgba(139,92,246,0.5)]',
        'gradient-secondary':
          'border-0 bg-gradient-to-br from-cyan-400 to-blue-400 shadow-[0_0_12px_rgba(6,182,212,0.5)]',
      },
      size: {
        default: 'h-5 w-5',
        sm: 'h-4 w-4',
        lg: 'h-6 w-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    VariantProps<typeof sliderTrackVariants> {}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, variant, size, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className={cn(sliderTrackVariants({ variant, size }))}>
      <SliderPrimitive.Range
        className={cn(
          sliderRangeVariants({
            variant:
              variant === 'glass-primary' || variant === 'glass-secondary'
                ? variant
                : variant === 'glass' || variant === 'glass-solid'
                ? 'glass'
                : variant === 'glass-success'
                ? 'glass-success'
                : 'default',
          })
        )}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className={cn(sliderThumbVariants({ variant, size }))} />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

// Additional component for gradient slider with explicit gradient range
const GradientSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps & { gradientVariant?: 'primary' | 'secondary' }
>(({ className, size, gradientVariant = 'primary', ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className={cn(sliderTrackVariants({ variant: 'glass', size }))}>
      <SliderPrimitive.Range
        className={cn(
          sliderRangeVariants({
            variant: gradientVariant === 'primary' ? 'gradient-primary' : 'gradient-secondary',
          })
        )}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        sliderThumbVariants({
          variant: gradientVariant === 'primary' ? 'gradient-primary' : 'gradient-secondary',
          size,
        })
      )}
    />
  </SliderPrimitive.Root>
));
GradientSlider.displayName = 'GradientSlider';

export {
  Slider,
  GradientSlider,
  sliderTrackVariants,
  sliderRangeVariants,
  sliderThumbVariants,
};
