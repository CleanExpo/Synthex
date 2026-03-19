import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva('rounded-sm text-card-foreground transition-colors', {
  variants: {
    variant: {
      default: 'border-[0.5px] border-white/[0.06] bg-white/[0.01]',
      // Scientific Luxury glass — single pixel borders, no heavy shadows
      glass:
        'border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]',
      'glass-solid': 'border-[0.5px] border-white/[0.06] bg-[#0a0a0a]',
      'glass-gradient': 'border-[0.5px] border-white/[0.06] bg-white/[0.02]',
      'glass-primary':
        'border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] hover:border-orange-500/30',
      'glass-secondary':
        'border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] hover:border-orange-500/30',
      'glass-success':
        'border-[0.5px] border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/30',
      'glass-warning':
        'border-[0.5px] border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/30',
      'glass-destructive':
        'border-[0.5px] border-red-500/20 bg-red-500/[0.02] hover:border-red-500/30',
      'gradient-primary':
        'border-[0.5px] border-orange-500/20 bg-orange-500/[0.03]',
      'gradient-secondary':
        'border-[0.5px] border-orange-500/20 bg-orange-500/[0.02]',
      interactive:
        'border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.1] cursor-pointer',
      'glass-interactive':
        'border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.1] cursor-pointer',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
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
    className={cn('flex flex-col space-y-1 p-5', className)}
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
      'text-base font-light text-white tracking-tight leading-none',
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
    className={cn('text-xs text-white/40 leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-5 pt-0', className)}
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
