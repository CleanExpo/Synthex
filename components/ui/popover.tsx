'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const popoverContentVariants = cva(
  'z-50 w-72 rounded-md p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  {
    variants: {
      variant: {
        default: 'border bg-popover text-popover-foreground',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        'glass-solid':
          'bg-slate-900/95 backdrop-blur-xl border border-white/[0.08] text-white shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'glass-primary':
          'bg-violet-500/10 backdrop-blur-xl border border-violet-500/20 text-white shadow-[0_8px_32px_rgba(139,92,246,0.15)]',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-xl border border-cyan-500/20 text-white shadow-[0_8px_32px_rgba(6,182,212,0.15)]',
      },
    },
    defaultVariants: {
      variant: 'glass',
    },
  }
);

export interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>,
    VariantProps<typeof popoverContentVariants> {}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({ className, align = 'center', sideOffset = 4, variant, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(popoverContentVariants({ variant, className }))}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, popoverContentVariants };
