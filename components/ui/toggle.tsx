'use client';

import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const toggleVariants = cva(
  'inline-flex items-center justify-center rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'text-white/55 hover:bg-white/[0.04] hover:text-white/70 data-[state=on]:bg-orange-500/[0.10] data-[state=on]:text-orange-400',
        outline:
          'border-[0.5px] border-white/[0.06] bg-transparent text-white/55 hover:bg-white/[0.04] hover:text-white/70 data-[state=on]:border-orange-500/20 data-[state=on]:bg-orange-500/[0.10] data-[state=on]:text-orange-400',
        ghost:
          'text-white/55 hover:bg-white/[0.04] hover:text-white/70 data-[state=on]:bg-orange-500/[0.10] data-[state=on]:text-orange-400',
      },
      size: {
        default: 'h-9 px-3',
        sm: 'h-8 px-2 text-xs',
        lg: 'h-10 px-4',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
