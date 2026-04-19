import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12] hover:shadow-lg',
        destructive:
          'bg-red-500/20 border-[0.5px] border-red-500/30 text-red-300 hover:bg-red-500/30',
        outline:
          'border-[0.5px] border-white/[0.08] bg-white/[0.02] text-white/60 hover:bg-white/[0.05] hover:text-white/80',
        secondary:
          'border-[0.5px] border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.04] hover:text-white/80',
        ghost:
          'text-orange-400 hover:text-orange-300 hover:bg-orange-500/[0.08] border border-orange-500/[0.2]',
        link: 'text-orange-400 underline-offset-4 hover:underline',
        // Glass variants (extend shadcn pattern — single source of truth)
        'glass-primary':
          'border-[0.5px] border-orange-500/20 bg-orange-500/[0.08] text-orange-300 hover:bg-orange-500/[0.15] hover:border-orange-500/30',
        'glass-secondary':
          'border-[0.5px] border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:border-white/[0.15]',
        'glass-destructive':
          'border-[0.5px] border-red-500/20 bg-red-500/[0.08] text-red-300 hover:bg-red-500/[0.15]',
        'glass-success':
          'border-[0.5px] border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.15]',
        'premium-primary': 'bg-orange-500 text-[#050505] hover:bg-orange-400 font-semibold',
        // Candy variants
        candy:
          'bg-gradient-to-r from-[#FF6B35] to-[#FF3B5C] text-white font-semibold hover:shadow-[0_0_20px_rgba(255,107,53,0.4)] transition-all duration-300',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        xl: 'h-11 px-8 text-sm',
        // Touch-target safe icon sizes: icon-sm min 44px on coarse-pointer devices via CSS
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
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
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
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
