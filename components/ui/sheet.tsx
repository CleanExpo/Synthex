'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from '@/components/icons';
import { cn } from '@/lib/utils';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const sheetOverlayVariants = cva(
  'fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  {
    variants: {
      variant: {
        default: 'bg-background/80 backdrop-blur-sm',
        glass: 'bg-black/40 backdrop-blur-md',
        'glass-solid': 'bg-slate-950/60 backdrop-blur-lg',
        'glass-primary': 'bg-violet-950/40 backdrop-blur-md',
        'glass-secondary': 'bg-cyan-950/40 backdrop-blur-md',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface SheetOverlayProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>,
    VariantProps<typeof sheetOverlayVariants> {}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  SheetOverlayProps
>(({ className, variant, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(sheetOverlayVariants({ variant, className }))}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetContentVariants = cva(
  'fixed z-50 gap-4 p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      variant: {
        default: 'bg-background border',
        // Premium Glassmorphism variants
        glass:
          'bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] text-white',
        'glass-solid':
          'bg-slate-900/95 backdrop-blur-xl border border-white/[0.08] text-white',
        'glass-primary':
          'bg-violet-500/10 backdrop-blur-xl border border-violet-500/20 text-white',
        'glass-secondary':
          'bg-cyan-500/10 backdrop-blur-xl border border-cyan-500/20 text-white',
      },
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      side: 'right',
    },
  }
);

const sheetCloseVariants = cva(
  'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'data-[state=open]:bg-secondary',
        glass: 'text-white hover:bg-white/10',
        'glass-solid': 'text-white hover:bg-white/10',
        'glass-primary': 'text-violet-200 hover:bg-violet-500/20',
        'glass-secondary': 'text-cyan-200 hover:bg-cyan-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Context for passing variant to child components
const SheetVariantContext = React.createContext<{
  variant?: VariantProps<typeof sheetContentVariants>['variant'];
}>({});

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetContentVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', variant, className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay
      variant={
        variant === 'glass' || variant === 'glass-solid'
          ? 'glass'
          : variant === 'glass-primary'
          ? 'glass-primary'
          : variant === 'glass-secondary'
          ? 'glass-secondary'
          : 'default'
      }
    />
    <SheetVariantContext.Provider value={{ variant }}>
      <SheetPrimitive.Content
        ref={ref}
        className={cn(sheetContentVariants({ side, variant, className }))}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className={cn(
            sheetCloseVariants({
              variant:
                variant === 'glass' || variant === 'glass-solid'
                  ? 'glass'
                  : variant === 'glass-primary'
                  ? 'glass-primary'
                  : variant === 'glass-secondary'
                  ? 'glass-secondary'
                  : 'default',
            })
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetVariantContext.Provider>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(SheetVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <SheetPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold', isGlass ? 'text-white' : 'text-foreground', className)}
      {...props}
    />
  );
});
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(SheetVariantContext);
  const isGlass = variant && variant !== 'default';

  return (
    <SheetPrimitive.Description
      ref={ref}
      className={cn('text-sm', isGlass ? 'text-white/70' : 'text-muted-foreground', className)}
      {...props}
    />
  );
});
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  sheetOverlayVariants,
  sheetContentVariants,
  sheetCloseVariants,
};
