import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-cyan-500 text-[#0a1628] hover:bg-cyan-400',
        destructive:
          'bg-red-500/20 border-[0.5px] border-red-500/30 text-red-300 hover:bg-red-500/30',
        outline:
          'border-[0.5px] border-white/[0.08] bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white/70',
        secondary:
          'border-[0.5px] border-white/[0.06] bg-white/[0.02] text-white/50 hover:bg-white/[0.04] hover:text-white/70',
        ghost:
          'text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
        link:
          'text-cyan-400 underline-offset-4 hover:underline',
        // Scientific Luxury glass variants
        glass:
          'border-[0.5px] border-white/[0.08] bg-white/[0.02] text-white/60 hover:bg-white/[0.05] hover:text-white/80',
        'glass-primary':
          'border-[0.5px] border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-300 hover:bg-cyan-500/[0.15] hover:border-cyan-500/30',
        'glass-secondary':
          'border-[0.5px] border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-300 hover:bg-cyan-500/[0.12]',
        'glass-destructive':
          'border-[0.5px] border-red-500/20 bg-red-500/[0.08] text-red-300 hover:bg-red-500/[0.15]',
        'glass-success':
          'border-[0.5px] border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.15]',
        'premium-primary':
          'bg-cyan-500 text-[#0a1628] hover:bg-cyan-400',
        'premium-secondary':
          'bg-cyan-500 text-[#0a1628] hover:bg-cyan-400',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        xl: 'h-11 px-8 text-sm',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
        'icon-lg': 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
