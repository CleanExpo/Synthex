import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.08] backdrop-blur-md border-white/[0.12] text-white hover:bg-white/[0.12]',
        'glass-solid':
          'bg-slate-800/80 backdrop-blur-md border-white/[0.1] text-white hover:bg-slate-800/90',
        'glass-primary':
          'bg-violet-500/20 backdrop-blur-md border-violet-500/30 text-violet-200 hover:bg-violet-500/30',
        'glass-secondary':
          'bg-cyan-500/20 backdrop-blur-md border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30',
        'glass-success':
          'bg-emerald-500/20 backdrop-blur-md border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30',
        'glass-warning':
          'bg-amber-500/20 backdrop-blur-md border-amber-500/30 text-amber-200 hover:bg-amber-500/30',
        'glass-destructive':
          'bg-red-500/20 backdrop-blur-md border-red-500/30 text-red-200 hover:bg-red-500/30',
        // Status badges with dot indicator styling
        'status-active':
          'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-emerald-400 before:mr-1.5 before:animate-pulse',
        'status-inactive':
          'bg-slate-500/20 border-slate-500/30 text-slate-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-slate-400 before:mr-1.5',
        'status-pending':
          'bg-amber-500/20 border-amber-500/30 text-amber-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-400 before:mr-1.5 before:animate-pulse',
        'status-error':
          'bg-red-500/20 border-red-500/30 text-red-300 before:content-[""] before:w-1.5 before:h-1.5 before:rounded-full before:bg-red-400 before:mr-1.5',
        // Premium gradient badges
        'gradient-primary':
          'bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 border-violet-500/30 text-white',
        'gradient-secondary':
          'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-500/30 text-white',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
