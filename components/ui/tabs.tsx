'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const tabsListVariants = cva(
  'inline-flex items-center justify-center rounded-md p-1 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-white/70',
        'glass-solid':
          'bg-slate-900/80 backdrop-blur-md border border-white/[0.08] text-white/70',
        'glass-primary':
          'bg-violet-500/10 backdrop-blur-md border border-violet-500/20 text-violet-200/70',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-md border border-cyan-500/20 text-cyan-200/70',
        // Pill variants (no background on list)
        pill: 'bg-transparent gap-1 p-0',
        'pill-glass': 'bg-transparent gap-1 p-0',
        // Underline variant
        underline: 'bg-transparent rounded-none border-b border-white/[0.08] p-0 gap-0',
      },
      size: {
        default: 'h-10',
        sm: 'h-8',
        lg: 'h-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'rounded-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        glass:
          'rounded-sm data-[state=active]:bg-white/[0.1] data-[state=active]:text-white data-[state=active]:shadow-sm text-white/70 hover:text-white/90',
        'glass-solid':
          'rounded-sm data-[state=active]:bg-white/[0.15] data-[state=active]:text-white data-[state=active]:shadow-sm text-white/70 hover:text-white/90',
        'glass-primary':
          'rounded-sm data-[state=active]:bg-violet-500/30 data-[state=active]:text-white data-[state=active]:shadow-sm text-violet-200/70 hover:text-violet-200',
        'glass-secondary':
          'rounded-sm data-[state=active]:bg-cyan-500/30 data-[state=active]:text-white data-[state=active]:shadow-sm text-cyan-200/70 hover:text-cyan-200',
        pill:
          'rounded-full bg-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted',
        'pill-glass':
          'rounded-full bg-transparent data-[state=active]:bg-white/[0.1] data-[state=active]:text-white text-white/70 hover:bg-white/[0.05] hover:text-white/90',
        underline:
          'rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:text-white pb-3 text-white/70 hover:text-white/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Context for passing variant to child components
const TabsVariantContext = React.createContext<{
  variant?: VariantProps<typeof tabsListVariants>['variant'];
}>({});

const Tabs = TabsPrimitive.Root;

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, size, children, ...props }, ref) => (
  <TabsVariantContext.Provider value={{ variant }}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  </TabsVariantContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    Omit<VariantProps<typeof tabsTriggerVariants>, 'variant'> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(TabsVariantContext);

  // Map list variant to trigger variant
  const triggerVariant = variant === 'glass-primary'
    ? 'glass-primary'
    : variant === 'glass-secondary'
    ? 'glass-secondary'
    : variant === 'pill'
    ? 'pill'
    : variant === 'pill-glass'
    ? 'pill-glass'
    : variant === 'underline'
    ? 'underline'
    : variant === 'glass' || variant === 'glass-solid'
    ? 'glass'
    : 'default';

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(tabsTriggerVariants({ variant: triggerVariant, className }))}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
};
