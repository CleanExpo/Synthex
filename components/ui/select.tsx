'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronDown, ChevronUp } from '@/components/icons';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const selectTriggerVariants = cva(
  'flex h-10 w-full items-center justify-between rounded-md px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 transition-all duration-200',
  {
    variants: {
      variant: {
        default:
          'border border-input bg-background focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-100 dark:focus:ring-cyan-500/50',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-white focus:bg-white/[0.06] focus:border-white/[0.15] focus:ring-2 focus:ring-white/[0.1]',
        'glass-solid':
          'bg-slate-900/80 backdrop-blur-md border border-white/[0.08] text-white focus:bg-slate-900/90 focus:border-white/[0.15] focus:ring-2 focus:ring-white/[0.1]',
        'glass-primary':
          'bg-cyan-500/10 backdrop-blur-md border border-cyan-500/20 text-white focus:bg-cyan-500/15 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-md border border-cyan-500/20 text-white focus:bg-cyan-500/15 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const selectContentVariants = cva(
  'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  {
    variants: {
      variant: {
        default:
          'border bg-popover text-popover-foreground dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100',
        glass:
          'bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        'glass-solid':
          'bg-slate-900/95 backdrop-blur-xl border border-white/[0.08] text-white shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'glass-primary':
          'bg-cyan-500/10 backdrop-blur-xl border border-cyan-500/20 text-white shadow-[0_8px_32px_rgba(6,182,212,0.15)]',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-xl border border-cyan-500/20 text-white shadow-[0_8px_32px_rgba(6,182,212,0.15)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const selectItemVariants = cva(
  'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  {
    variants: {
      variant: {
        default:
          'focus:bg-accent focus:text-accent-foreground dark:focus:bg-slate-800 dark:text-slate-200 dark:focus:text-white',
        glass: 'focus:bg-white/[0.08] text-white/90 focus:text-white',
        'glass-primary': 'focus:bg-cyan-500/20 text-white/90 focus:text-white',
        'glass-secondary': 'focus:bg-cyan-500/20 text-white/90 focus:text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Context for passing variant to child components
const SelectVariantContext = React.createContext<{
  variant?: VariantProps<typeof selectContentVariants>['variant'];
}>({});

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, variant, ...props }, ref) => {
  const isGlass = variant && variant !== 'default';

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(selectTriggerVariants({ variant, className }))}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className={cn('h-4 w-4', isGlass ? 'text-white/50' : 'opacity-50')} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(SelectVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        className
      )}
      {...props}
    >
      <ChevronUp className={cn('h-4 w-4', isGlass && 'text-white/70')} />
    </SelectPrimitive.ScrollUpButton>
  );
});
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(SelectVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        className
      )}
      {...props}
    >
      <ChevronDown className={cn('h-4 w-4', isGlass && 'text-white/70')} />
    </SelectPrimitive.ScrollDownButton>
  );
});
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

export interface SelectContentProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>,
    VariantProps<typeof selectContentVariants> {}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = 'popper', variant, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectVariantContext.Provider value={{ variant }}>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          selectContentVariants({ variant, className }),
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1'
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectVariantContext.Provider>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(SelectVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(
        'py-1.5 pl-8 pr-2 text-sm font-semibold',
        isGlass && 'text-white/70',
        className
      )}
      {...props}
    />
  );
});
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  const { variant } = React.useContext(SelectVariantContext);
  const itemVariant = variant === 'glass-primary'
    ? 'glass-primary'
    : variant === 'glass-secondary'
    ? 'glass-secondary'
    : variant && variant !== 'default'
    ? 'glass'
    : 'default';
  const isGlass = variant && variant !== 'default';

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(selectItemVariants({ variant: itemVariant, className }))}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className={cn('h-4 w-4', isGlass && 'text-white')} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(SelectVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn(
        '-mx-1 my-1 h-px',
        isGlass ? 'bg-white/[0.08]' : 'bg-muted',
        className
      )}
      {...props}
    />
  );
});
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  selectTriggerVariants,
  selectContentVariants,
  selectItemVariants,
};
