'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check } from '@/components/icons';
import { cn } from '@/lib/utils';

const checkboxVariants = cva(
  'peer shrink-0 rounded-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
  {
    variants: {
      variant: {
        default:
          'border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:border-slate-600 dark:data-[state=checked]:bg-cyan-600 dark:data-[state=checked]:text-white',
        // Premium Glassmorphism variants
        glass:
          'border border-white/[0.15] bg-white/[0.03] backdrop-blur-md data-[state=checked]:bg-white/[0.15] data-[state=checked]:text-white',
        'glass-solid':
          'border border-white/[0.1] bg-slate-800/80 backdrop-blur-md data-[state=checked]:bg-slate-600 data-[state=checked]:text-white',
        'glass-primary':
          'border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md data-[state=checked]:bg-cyan-500/50 data-[state=checked]:text-white',
        'glass-secondary':
          'border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md data-[state=checked]:bg-cyan-500/50 data-[state=checked]:text-white',
        'glass-success':
          'border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md data-[state=checked]:bg-emerald-500/50 data-[state=checked]:text-white',
        // Gradient variants
        'gradient-primary':
          'border border-cyan-500/30 bg-white/[0.03] backdrop-blur-md data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-cyan-500 data-[state=checked]:to-cyan-500 data-[state=checked]:text-white data-[state=checked]:border-transparent',
        'gradient-secondary':
          'border border-cyan-500/30 bg-white/[0.03] backdrop-blur-md data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-cyan-500 data-[state=checked]:to-blue-500 data-[state=checked]:text-white data-[state=checked]:border-transparent',
      },
      size: {
        default: 'h-4 w-4',
        sm: 'h-3.5 w-3.5',
        lg: 'h-5 w-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const checkboxIndicatorVariants = cva('flex items-center justify-center text-current', {
  variants: {
    size: {
      default: '[&>svg]:h-3 [&>svg]:w-3',
      sm: '[&>svg]:h-2.5 [&>svg]:w-2.5',
      lg: '[&>svg]:h-3.5 [&>svg]:w-3.5',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, variant, size, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(checkboxVariants({ variant, size, className }))}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn(checkboxIndicatorVariants({ size }))}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox, checkboxVariants, checkboxIndicatorVariants };
