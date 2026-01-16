import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 transition-all',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.03] backdrop-blur-md border-white/[0.08] text-white [&>svg]:text-white/70',
        'glass-solid':
          'bg-slate-900/80 backdrop-blur-md border-white/[0.08] text-white [&>svg]:text-white/70',
        'glass-primary':
          'bg-violet-500/10 backdrop-blur-md border-violet-500/20 text-violet-100 [&>svg]:text-violet-300',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-md border-cyan-500/20 text-cyan-100 [&>svg]:text-cyan-300',
        'glass-success':
          'bg-emerald-500/10 backdrop-blur-md border-emerald-500/20 text-emerald-100 [&>svg]:text-emerald-300',
        'glass-warning':
          'bg-amber-500/10 backdrop-blur-md border-amber-500/20 text-amber-100 [&>svg]:text-amber-300',
        'glass-destructive':
          'bg-red-500/10 backdrop-blur-md border-red-500/20 text-red-100 [&>svg]:text-red-300',
        'glass-info':
          'bg-blue-500/10 backdrop-blur-md border-blue-500/20 text-blue-100 [&>svg]:text-blue-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const alertTitleVariants = cva('mb-1 font-medium leading-none tracking-tight', {
  variants: {
    variant: {
      default: '',
      glass: 'text-white',
      'glass-primary': 'text-violet-100',
      'glass-secondary': 'text-cyan-100',
      'glass-success': 'text-emerald-100',
      'glass-warning': 'text-amber-100',
      'glass-destructive': 'text-red-100',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
