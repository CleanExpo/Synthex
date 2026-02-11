'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full transition-all',
  {
    variants: {
      variant: {
        default: '',
        // Premium Glassmorphism variants with ring effects
        glass: 'ring-2 ring-white/20',
        'glass-solid': 'ring-2 ring-white/30 shadow-lg',
        'glass-primary': 'ring-2 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
        'glass-secondary': 'ring-2 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
        'glass-success': 'ring-2 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        // Gradient ring variants
        'gradient-primary':
          'ring-2 ring-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]',
        'gradient-secondary':
          'ring-2 ring-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]',
      },
      size: {
        default: 'h-10 w-10',
        xs: 'h-6 w-6',
        sm: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
        '2xl': 'h-20 w-20',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const avatarFallbackVariants = cva(
  'flex h-full w-full items-center justify-center rounded-full',
  {
    variants: {
      variant: {
        default: 'bg-muted dark:bg-slate-800 dark:text-slate-200',
        glass: 'bg-white/[0.08] backdrop-blur-md text-white',
        'glass-solid': 'bg-slate-800/80 backdrop-blur-md text-white',
        'glass-primary': 'bg-cyan-500/20 backdrop-blur-md text-cyan-200',
        'glass-secondary': 'bg-cyan-500/20 backdrop-blur-md text-cyan-200',
        'glass-success': 'bg-emerald-500/20 backdrop-blur-md text-emerald-200',
        'gradient-primary':
          'bg-gradient-to-br from-cyan-500 to-cyan-500 text-white',
        'gradient-secondary':
          'bg-gradient-to-br from-cyan-500 to-blue-500 text-white',
      },
      size: {
        default: 'text-sm',
        xs: 'text-[9px] font-medium',
        sm: 'text-[11px] font-medium',
        lg: 'text-base',
        xl: 'text-lg',
        '2xl': 'text-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Context for passing variant to child components
const AvatarVariantContext = React.createContext<{
  variant?: VariantProps<typeof avatarVariants>['variant'];
  size?: VariantProps<typeof avatarVariants>['size'];
}>({});

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, variant, size, ...props }, ref) => (
  <AvatarVariantContext.Provider value={{ variant, size }}>
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ variant, size, className }))}
      {...props}
    />
  </AvatarVariantContext.Provider>
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  const { variant, size } = React.useContext(AvatarVariantContext);

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(avatarFallbackVariants({ variant, size, className }))}
      {...props}
    />
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  avatarVariants,
  avatarFallbackVariants,
};
