'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 transition-colors',
  {
    variants: {
      variant: {
        default: 'text-foreground dark:text-slate-200',
        // Premium Glassmorphism variants
        glass: 'text-white/90',
        'glass-muted': 'text-white/60',
        'glass-primary': 'text-violet-200',
        'glass-secondary': 'text-cyan-200',
        'glass-success': 'text-emerald-200',
        'glass-warning': 'text-amber-200',
        'glass-destructive': 'text-red-200',
      },
      size: {
        default: 'text-sm',
        sm: 'text-xs',
        lg: 'text-base',
      },
      required: {
        true: "after:content-['*'] after:ml-0.5 after:text-red-400 dark:after:text-red-500",
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      required: false,
    },
  }
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, variant, size, required, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(labelVariants({ variant, size, required, className }))}
      {...props}
    />
  )
);
Label.displayName = LabelPrimitive.Root.displayName;

export { Label, labelVariants };
