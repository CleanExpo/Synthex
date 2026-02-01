'use client';

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const separatorVariants = cva('shrink-0', {
  variants: {
    variant: {
      default: 'bg-border',
      // Premium Glassmorphism variants
      glass: 'bg-white/[0.08]',
      'glass-solid': 'bg-white/[0.15]',
      'glass-primary': 'bg-violet-500/30',
      'glass-secondary': 'bg-cyan-500/30',
      'glass-success': 'bg-emerald-500/30',
      // Gradient variants
      'gradient-primary': 'bg-gradient-to-r from-transparent via-violet-500/50 to-transparent',
      'gradient-secondary': 'bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent',
      'gradient-fade': 'bg-gradient-to-r from-transparent via-white/20 to-transparent',
    },
    orientation: {
      horizontal: 'h-[1px] w-full',
      vertical: 'h-full w-[1px]',
    },
  },
  defaultVariants: {
    variant: 'default',
    orientation: 'horizontal',
  },
  compoundVariants: [
    {
      variant: 'gradient-primary',
      orientation: 'vertical',
      className: 'bg-gradient-to-b from-transparent via-violet-500/50 to-transparent',
    },
    {
      variant: 'gradient-secondary',
      orientation: 'vertical',
      className: 'bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent',
    },
    {
      variant: 'gradient-fade',
      orientation: 'vertical',
      className: 'bg-gradient-to-b from-transparent via-white/20 to-transparent',
    },
  ],
});

export interface SeparatorProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>, 'orientation'>,
    VariantProps<typeof separatorVariants> {}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(({ className, orientation = 'horizontal', decorative = true, variant, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation ?? undefined}
    className={cn(separatorVariants({ variant, orientation, className }))}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator, separatorVariants };
