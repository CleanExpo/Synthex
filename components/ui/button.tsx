import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:text-white dark:hover:bg-red-800 focus-visible:ring-red-500',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:border-slate-700 dark:bg-transparent dark:hover:bg-slate-800 dark:hover:text-slate-100',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-slate-800 dark:hover:text-slate-100',
        link: 'text-primary underline-offset-4 hover:underline dark:text-violet-400',
        // Premium Glassmorphism variants (2026 Design System)
        glass:
          'bg-white/[0.05] backdrop-blur-md border border-white/10 text-white hover:bg-white/[0.1] hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 dark:bg-white/[0.03] dark:border-white/[0.08] dark:hover:bg-white/[0.08] dark:hover:border-white/[0.15]',
        'glass-primary':
          'bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 backdrop-blur-md border border-violet-500/30 text-white hover:from-violet-500/30 hover:to-fuchsia-500/30 hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:-translate-y-0.5 active:translate-y-0',
        'glass-secondary':
          'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-md border border-cyan-500/30 text-white hover:from-cyan-500/30 hover:to-blue-500/30 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:-translate-y-0.5 active:translate-y-0',
        'glass-destructive':
          'bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-100 hover:bg-red-500/30 hover:border-red-500/50 hover:-translate-y-0.5 active:translate-y-0',
        'glass-success':
          'bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/30 hover:border-emerald-500/50 hover:-translate-y-0.5 active:translate-y-0',
        // Premium solid variants
        'premium-primary':
          'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg hover:from-violet-700 hover:to-blue-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0',
        'premium-secondary':
          'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg hover:from-fuchsia-700 hover:to-violet-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-12 rounded-lg px-10 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
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