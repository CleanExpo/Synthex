'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const tooltipContentVariants = cva(
  'z-50 overflow-hidden rounded-md px-3 py-1.5 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        'glass-solid':
          'bg-slate-900/95 backdrop-blur-xl border border-white/[0.1] text-white shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'glass-primary':
          'bg-violet-500/20 backdrop-blur-xl border border-violet-500/30 text-white shadow-[0_8px_32px_rgba(139,92,246,0.2)]',
        'glass-secondary':
          'bg-cyan-500/20 backdrop-blur-xl border border-cyan-500/30 text-white shadow-[0_8px_32px_rgba(6,182,212,0.2)]',
        'glass-success':
          'bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/30 text-emerald-100 shadow-[0_8px_32px_rgba(16,185,129,0.2)]',
        'glass-warning':
          'bg-amber-500/20 backdrop-blur-xl border border-amber-500/30 text-amber-100 shadow-[0_8px_32px_rgba(245,158,11,0.2)]',
        'glass-destructive':
          'bg-red-500/20 backdrop-blur-xl border border-red-500/30 text-red-100 shadow-[0_8px_32px_rgba(239,68,68,0.2)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    VariantProps<typeof tooltipContentVariants> {}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, variant, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(tooltipContentVariants({ variant, className }))}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, tooltipContentVariants };
