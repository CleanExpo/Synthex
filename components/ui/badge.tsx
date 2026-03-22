import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-700',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 dark:bg-red-600 dark:text-white dark:hover:bg-red-700',
        outline: 'text-foreground dark:text-slate-200 dark:border-slate-700',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.08] backdrop-blur-md border-white/[0.12] text-white hover:bg-white/[0.12]',
        'glass-solid':
          'bg-slate-800/80 backdrop-blur-md border-white/[0.1] text-white hover:bg-slate-800/90',
        'glass-primary':
          'bg-orange-500/20 backdrop-blur-md border-orange-500/30 text-orange-200 hover:bg-orange-500/30',
        'glass-secondary':
          'bg-orange-500/20 backdrop-blur-md border-orange-500/30 text-orange-200 hover:bg-orange-500/30',
        'glass-success':
          'bg-emerald-500/20 backdrop-blur-md border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30',
        'glass-warning':
          'bg-orange-500/20 backdrop-blur-md border-orange-500/30 text-orange-200 hover:bg-orange-500/30',
        'glass-destructive':
          'bg-red-500/20 backdrop-blur-md border-red-500/30 text-red-200 hover:bg-red-500/30',
        // Status badges with dot indicator styling
        'status-active':
          'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-emerald-400 before:mr-1.5 before:animate-pulse',
        'status-inactive':
          'bg-slate-500/20 border-slate-500/30 text-slate-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-slate-400 before:mr-1.5',
        'status-pending':
          'bg-orange-500/20 border-orange-500/30 text-orange-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-orange-400 before:mr-1.5 before:animate-pulse',
        'status-error':
          'bg-red-500/20 border-red-500/30 text-red-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-red-400 before:mr-1.5',
        // Premium gradient badges
        'gradient-primary':
          'bg-gradient-to-r from-orange-500/30 to-orange-500/30 border-orange-500/30 text-white',
        'gradient-secondary':
          'bg-gradient-to-r from-orange-500/30 to-blue-500/30 border-orange-500/30 text-white',
        // Candy variants
        candy:
          'bg-gradient-to-r from-[#FF6B35] to-[#FFD60A] border-transparent text-[#0A0A12] font-semibold shadow-[0_0_12px_rgba(255,107,53,0.3)]',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-4 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
