import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-lg text-card-foreground transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'border bg-card shadow-sm',
        // Premium Glassmorphism variants (2026 Design System)
        glass:
          'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_4px_24px_rgba(0,0,0,0.12)] hover:bg-white/[0.05] hover:border-white/[0.12]',
        'glass-solid':
          'bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_4px_24px_rgba(0,0,0,0.2)]',
        'glass-gradient':
          'bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_4px_24px_rgba(0,0,0,0.12)]',
        'glass-primary':
          'bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 backdrop-blur-xl border border-violet-500/20 shadow-[0_0_0_1px_rgba(139,92,246,0.05)_inset,0_4px_24px_rgba(139,92,246,0.1)] hover:border-violet-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
        'glass-secondary':
          'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl border border-cyan-500/20 shadow-[0_0_0_1px_rgba(6,182,212,0.05)_inset,0_4px_24px_rgba(6,182,212,0.1)] hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]',
        'glass-success':
          'bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-xl border border-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.05)_inset,0_4px_24px_rgba(16,185,129,0.1)] hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
        'glass-warning':
          'bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl border border-amber-500/20 shadow-[0_0_0_1px_rgba(245,158,11,0.05)_inset,0_4px_24px_rgba(245,158,11,0.1)] hover:border-amber-500/30 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
        'glass-destructive':
          'bg-gradient-to-br from-red-500/10 to-rose-500/10 backdrop-blur-xl border border-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.05)_inset,0_4px_24px_rgba(239,68,68,0.1)] hover:border-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]',
        // Gradient variants for premium sections
        'gradient-primary':
          'bg-gradient-to-r from-purple-900/50 to-blue-900/50 backdrop-blur-xl border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_8px_32px_rgba(139,92,246,0.15)]',
        'gradient-secondary':
          'bg-gradient-to-r from-cyan-900/50 to-teal-900/50 backdrop-blur-xl border border-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_8px_32px_rgba(6,182,212,0.15)]',
        // Interactive variants with hover lift
        interactive:
          'border bg-card shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer',
        'glass-interactive':
          'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.12)] hover:bg-white/[0.05] hover:border-white/[0.12] hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.16)] cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
};
