'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const switchVariants = cva(
  'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=checked]:bg-violet-600 dark:data-[state=unchecked]:bg-slate-700',
        // Premium Glassmorphism variants
        glass:
          'data-[state=checked]:bg-white/30 data-[state=unchecked]:bg-white/[0.08] backdrop-blur-md border-white/[0.1]',
        'glass-solid':
          'data-[state=checked]:bg-slate-600 data-[state=unchecked]:bg-slate-800/80 backdrop-blur-md border-white/[0.08]',
        'glass-primary':
          'data-[state=checked]:bg-violet-500/60 data-[state=unchecked]:bg-violet-500/20 backdrop-blur-md border-violet-500/30',
        'glass-secondary':
          'data-[state=checked]:bg-cyan-500/60 data-[state=unchecked]:bg-cyan-500/20 backdrop-blur-md border-cyan-500/30',
        'glass-success':
          'data-[state=checked]:bg-emerald-500/60 data-[state=unchecked]:bg-emerald-500/20 backdrop-blur-md border-emerald-500/30',
        // Gradient variants
        'gradient-primary':
          'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-fuchsia-500 data-[state=unchecked]:bg-white/[0.08] backdrop-blur-md',
        'gradient-secondary':
          'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-cyan-500 data-[state=checked]:to-blue-500 data-[state=unchecked]:bg-white/[0.08] backdrop-blur-md',
      },
      size: {
        default: 'h-6 w-11',
        sm: 'h-5 w-9',
        lg: 'h-7 w-14',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const switchThumbVariants = cva(
  'pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform',
  {
    variants: {
      variant: {
        default: '',
        glass: 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]',
        'glass-solid': 'bg-white',
        'glass-primary': 'bg-white shadow-[0_0_10px_rgba(139,92,246,0.3)]',
        'glass-secondary': 'bg-white shadow-[0_0_10px_rgba(6,182,212,0.3)]',
        'glass-success': 'bg-white shadow-[0_0_10px_rgba(16,185,129,0.3)]',
        'gradient-primary': 'bg-white shadow-[0_0_10px_rgba(139,92,246,0.3)]',
        'gradient-secondary': 'bg-white shadow-[0_0_10px_rgba(6,182,212,0.3)]',
      },
      size: {
        default: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        sm: 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        lg: 'h-6 w-6 data-[state=checked]:translate-x-7 data-[state=unchecked]:translate-x-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>,
    VariantProps<typeof switchVariants> {}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, variant, size, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(switchVariants({ variant, size, className }))}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(switchThumbVariants({ variant, size }))}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch, switchVariants, switchThumbVariants };
