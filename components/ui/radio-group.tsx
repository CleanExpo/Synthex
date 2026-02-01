'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cva, type VariantProps } from 'class-variance-authority';
import { Circle } from '@/components/icons';
import { cn } from '@/lib/utils';

const radioGroupVariants = cva('grid gap-2', {
  variants: {
    orientation: {
      vertical: 'grid-flow-row',
      horizontal: 'grid-flow-col',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});

const radioGroupItemVariants = cva(
  'aspect-square rounded-full ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all',
  {
    variants: {
      variant: {
        default: 'border border-primary text-primary',
        // Premium Glassmorphism variants
        glass:
          'border border-white/[0.2] bg-white/[0.03] backdrop-blur-md data-[state=checked]:bg-white/[0.15] data-[state=checked]:border-white/[0.3]',
        'glass-solid':
          'border border-white/[0.15] bg-slate-800/80 backdrop-blur-md data-[state=checked]:bg-slate-600 data-[state=checked]:border-white/[0.25]',
        'glass-primary':
          'border border-violet-500/30 bg-violet-500/10 backdrop-blur-md data-[state=checked]:bg-violet-500/30 data-[state=checked]:border-violet-500/50',
        'glass-secondary':
          'border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md data-[state=checked]:bg-cyan-500/30 data-[state=checked]:border-cyan-500/50',
        'glass-success':
          'border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md data-[state=checked]:bg-emerald-500/30 data-[state=checked]:border-emerald-500/50',
        // Gradient variants
        'gradient-primary':
          'border border-violet-500/30 bg-white/[0.03] backdrop-blur-md data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-violet-500/50 data-[state=checked]:to-fuchsia-500/50 data-[state=checked]:border-transparent',
        'gradient-secondary':
          'border border-cyan-500/30 bg-white/[0.03] backdrop-blur-md data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-cyan-500/50 data-[state=checked]:to-blue-500/50 data-[state=checked]:border-transparent',
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

const radioGroupIndicatorVariants = cva('flex items-center justify-center', {
  variants: {
    variant: {
      default: 'text-current',
      glass: 'text-white',
      'glass-solid': 'text-white',
      'glass-primary': 'text-violet-300',
      'glass-secondary': 'text-cyan-300',
      'glass-success': 'text-emerald-300',
      'gradient-primary': 'text-white',
      'gradient-secondary': 'text-white',
    },
    size: {
      default: '[&>svg]:h-2.5 [&>svg]:w-2.5',
      sm: '[&>svg]:h-2 [&>svg]:w-2',
      lg: '[&>svg]:h-3 [&>svg]:w-3',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

// Context for passing variant to child components
const RadioGroupVariantContext = React.createContext<{
  variant?: VariantProps<typeof radioGroupItemVariants>['variant'];
  size?: VariantProps<typeof radioGroupItemVariants>['size'];
}>({});

export interface RadioGroupProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'orientation'>,
    VariantProps<typeof radioGroupVariants> {
  variant?: VariantProps<typeof radioGroupItemVariants>['variant'];
  size?: VariantProps<typeof radioGroupItemVariants>['size'];
}

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, orientation, variant, size, ...props }, ref) => (
  <RadioGroupVariantContext.Provider value={{ variant, size }}>
    <RadioGroupPrimitive.Root
      className={cn(radioGroupVariants({ orientation, className }))}
      {...props}
      ref={ref}
    />
  </RadioGroupVariantContext.Provider>
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
    VariantProps<typeof radioGroupItemVariants> {}

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, variant, size, ...props }, ref) => {
  const context = React.useContext(RadioGroupVariantContext);
  const resolvedVariant = variant ?? context.variant ?? 'default';
  const resolvedSize = size ?? context.size ?? 'default';

  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        radioGroupItemVariants({ variant: resolvedVariant, size: resolvedSize, className })
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className={cn(
          radioGroupIndicatorVariants({ variant: resolvedVariant, size: resolvedSize })
        )}
      >
        <Circle className="fill-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export {
  RadioGroup,
  RadioGroupItem,
  radioGroupVariants,
  radioGroupItemVariants,
  radioGroupIndicatorVariants,
};
